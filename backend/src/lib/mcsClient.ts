// backend/src/lib/mcsClient.ts
// ──────────────────────────────────────────────────────────────────────────────
// Minimal HTTP client for the MCS daemon (ctx-daemon on localhost:4040).
// All calls are fire-and-forget safe: returns null on ANY failure.
// Never throws — Clairity must still work if MCS is unavailable.
//
// MCS pack endpoint:
//   GET /pack?target=<claude|gpt|gemini>&task=<text>&budget=<n>&format=json
//
// MCS ContextPack response shape (graph.nodes[]):
//   { id, type, label, content, provenance: { truthTier, ... }, createdAt }
// ──────────────────────────────────────────────────────────────────────────────

import { logger } from "./logger.js";

/** Standardized failure types for MCS integration */
export type McsErrorType =
    | "config_error"
    | "connection_error"
    | "timeout_error"
    | "invalid_payload"
    | "unsupported_target"
    | "empty_context";
import {
    MCS_ENABLED,
    MCS_BASE_URL,
    MCS_TIMEOUT_MS,
    MCS_CONTEXT_MODE,
    MCS_MAX_ITEMS,
    MCS_MAX_CONTEXT_TOKENS,
    MCS_PINNED_CATEGORIES,
    type McsContextMode,
} from "./featureFlags.js";

// ─── Target mapping ─────────────────────────────────────────────────────────
// Clairity uses context.site = "chatgpt" | "claude" | "gemini"
// MCS /pack target accepts  = "gpt"     | "claude" | "gemini"

const SITE_TO_TARGET: Record<string, string> = {
    chatgpt: "gpt",
    claude: "claude",
    gemini: "gemini",
};

// ─── Types ───────────────────────────────────────────────────────────────────

export interface McsContextParams {
    /** User prompt (truncated to 200 chars for the MCS "task" query param) */
    prompt: string;
    /** AI site from Clairity context — mapped to MCS target (chatgpt→gpt) */
    site?: string;
    /** Explicit MCS target override (skips site mapping) */
    target?: string;
    /** Workspace scope identifier */
    workspaceId?: string;
    /** Project scope identifier */
    projectId?: string;
    /** Conversation scope */
    conversationId?: string;
    /** Source application identifier */
    sourceApp?: string;
    /** Override context mode per-request */
    contextMode?: McsContextMode;
    /** Pinned category filters (only used in "pinned" mode) */
    pinnedCategories?: string[];
}

export interface McsContextItem {
    /** Content text from the graph node */
    content: string;
    /** Node label (short description) */
    label?: string;
    /** Node type from MCS graph (Task, Decision, Artifact, etc.) */
    nodeType?: string;
    /** Truth tier (VERIFIED, CONFIRMED, EXTRACTED, RAW) */
    truthTier?: string;
}

export interface McsContextResult {
    /** Assembled context text, ready for injection into additional_context */
    contextSnippet: string;
    /** Structured list of individual context items */
    items: McsContextItem[];
    /** Number of items returned */
    itemCount: number;
    /** Total characters in the assembled snippet */
    snippetLength: number;
    /** MCS target used (gpt, claude, gemini) */
    target: string;
    /** Always "mcs-daemon" */
    source: "mcs-daemon";
    /** Whether the result was trimmed to fit MCS_MAX_CONTEXT_TOKENS */
    truncated: boolean;
}

/** GraphNode shape from MCS ContextPack.graph.nodes[] */
interface McsGraphNode {
    id?: string;
    type?: string;       // Task, Decision, Constraint, Knowledge, Artifact, Conversation
    label?: string;
    content?: string;
    provenance?: {
        truthTier?: string;  // VERIFIED, CONFIRMED, EXTRACTED, RAW
        derivedFromEventIds?: string[];
    };
    createdAt?: string;
    updatedAt?: string;
}

/** MCS ContextPack response (subset we care about) */
interface McsPackResponse {
    version?: string;
    target?: string;
    task?: string;
    instructions?: string;
    graph?: {
        nodes?: McsGraphNode[];
        edges?: unknown[];
        stats?: Record<string, unknown>;
    };
    meta?: {
        selectedNodes?: number;
        droppedNodes?: number;
        finalTokenEstimate?: number;
        budgetRespected?: boolean;
        rankingStrategy?: string;
        [key: string]: unknown;
    };
}

// ─── Internal helpers ────────────────────────────────────────────────────────

function resolveTarget(params: McsContextParams): string {
    // Explicit target override
    if (params.target) return params.target;
    // Map from Clairity site name
    if (params.site && SITE_TO_TARGET[params.site]) return SITE_TO_TARGET[params.site]!;
    // Default to claude
    return "claude";
}

async function mcsGet<T>(path: string, timeoutMs: number = MCS_TIMEOUT_MS): Promise<T | null> {
    const url = `${MCS_BASE_URL}${path}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    logger.info({ url, timeoutMs }, "MCS → calling");

    try {
        const res = await fetch(url, {
            method: "GET",
            headers: { "Accept": "application/json" },
            signal: controller.signal,
        });

        logger.info({ url, status: res.status }, "MCS ← response");

        if (!res.ok) {
            logger.warn({ url, status: res.status }, "MCS request returned non-200");
            return null;
        }

        return (await res.json()) as T;
    } catch (err: unknown) {
        const isAbort = err instanceof DOMException && err.name === "AbortError";
        const isConnRefused = err instanceof TypeError && /fetch failed|ECONNREFUSED/i.test(String(err));

        if (isAbort) {
            logger.warn({ url, timeoutMs, errorType: "timeout_error" }, "MCS request timed out — fallback to no-context rewrite");
        } else if (isConnRefused) {
            logger.warn({ url, errorType: "connection_error" }, "MCS daemon not reachable (connection refused) — fallback to no-context rewrite");
        } else {
            logger.warn(
                { url, errorType: "connection_error", error: err instanceof Error ? err.message : String(err) },
                "MCS request failed — fallback to no-context rewrite"
            );
        }
        return null;
    } finally {
        clearTimeout(timer);
    }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Check if the MCS daemon is healthy.
 * Returns true if GET /health responds with { "status": "ok" }.
 */
export async function checkMcsHealth(): Promise<boolean> {
    if (!MCS_ENABLED) {
        logger.info("MCS health check skipped (MCS_ENABLED=false)");
        return false;
    }
    const data = await mcsGet<{ status?: string }>("/health", Math.min(MCS_TIMEOUT_MS, 1000));
    return data?.status === "ok";
}

/**
 * Fetch context from MCS daemon's /pack endpoint.
 *
 * Returns assembled context and structured items, or null if:
 *  - MCS_ENABLED is false
 *  - Context mode resolves to "off"
 *  - Daemon is unreachable / times out / errors
 *  - Response has no usable nodes
 *
 * NEVER throws.
 */
export async function fetchMcsContext(params: McsContextParams): Promise<McsContextResult | null> {
    // Gate 1: global kill switch
    if (!MCS_ENABLED) {
        logger.debug("MCS context skipped (MCS_ENABLED=false)");
        return null;
    }

    // Gate 2: per-request or env context mode
    const mode = params.contextMode ?? MCS_CONTEXT_MODE;
    if (mode === "off") {
        logger.debug("MCS context skipped (contextMode=off)");
        return null;
    }

    // Resolve target: site mapping or explicit override
    const target = resolveTarget(params);

    // Truncate prompt for the task param
    const task = params.prompt.slice(0, 200);

    // Build query string matching MCS /pack contract
    const qs = new URLSearchParams({
        target,
        task,
        budget: String(MCS_MAX_CONTEXT_TOKENS),
        format: "json",
    });

    // Pass-through scope fields when available
    if (params.conversationId) qs.set("conversationId", params.conversationId);
    if (params.sourceApp) qs.set("sourceApp", params.sourceApp);

    // In pinned mode, add categories
    const categories = params.pinnedCategories ?? MCS_PINNED_CATEGORIES;
    if (mode === "pinned" && categories.length > 0) {
        qs.set("categories", categories.join(","));
    }

    const packUrl = `/pack?${qs.toString()}`;

    logger.info(
        { target, mode, task: task.slice(0, 60), maxItems: MCS_MAX_ITEMS, maxTokens: MCS_MAX_CONTEXT_TOKENS },
        "MCS context lookup"
    );

    const data = await mcsGet<McsPackResponse>(packUrl);
    if (!data || typeof data !== "object") {
        logger.warn({ target, errorType: "invalid_payload" }, "MCS pack returned null or invalid — fallback path used");
        return null;
    }

    const allNodes = data.graph?.nodes;
    if (!Array.isArray(allNodes) || allNodes.length === 0) {
        logger.info({ target, task: task.slice(0, 50), errorType: "empty_context" }, "MCS pack returned 0 or invalid nodes — fallback path used");
        return null;
    }

    // Normalize MCS GraphNodes into Clairity-friendly items, capped to MCS_MAX_ITEMS
    const items: McsContextItem[] = allNodes
        .slice(0, MCS_MAX_ITEMS)
        .map((n) => ({
            content: n.content || n.label || "",
            label: n.label,
            nodeType: n.type,
            truthTier: n.provenance?.truthTier,
        }))
        .filter((item) => item.content.length > 0);

    if (items.length === 0) {
        logger.info({ target }, "MCS pack nodes had no usable content — fallback path used");
        return null;
    }

    // Assemble context snippet with token budget enforcement
    let contextSnippet = "";
    let truncated = false;
    const separator = "\n\n---\n\n";

    for (const item of items) {
        const candidate = contextSnippet
            ? contextSnippet + separator + item.content
            : item.content;

        if (candidate.length > MCS_MAX_CONTEXT_TOKENS) {
            truncated = true;
            const remaining = MCS_MAX_CONTEXT_TOKENS - contextSnippet.length - separator.length;
            if (remaining > 50 && contextSnippet.length > 0) {
                contextSnippet += separator + item.content.slice(0, remaining);
            } else if (contextSnippet.length === 0) {
                contextSnippet = item.content.slice(0, MCS_MAX_CONTEXT_TOKENS);
            }
            break;
        }
        contextSnippet = candidate;
    }

    logger.info(
        {
            target,
            itemCount: items.length,
            snippetLength: contextSnippet.length,
            truncated,
            mcsSelectedNodes: data.meta?.selectedNodes,
            mcsBudgetRespected: data.meta?.budgetRespected,
        },
        "MCS context fetched successfully"
    );

    return {
        contextSnippet,
        items,
        itemCount: items.length,
        snippetLength: contextSnippet.length,
        target,
        source: "mcs-daemon",
        truncated,
    };
}
