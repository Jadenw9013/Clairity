import type {
  RewriteResponse,
  ErrorResponse,
  SessionResponse,
  Message,
  ConversationBrief,
  BriefResponse,
} from "shared/types/index.ts";

import { API_BASE } from "../config.js";
import {
  getHistory,
  appendUserMessage,
  appendAssistantMessage,
  getBrief,
  setBrief,
  shouldExtractBrief,
  shouldUpdateBrief,
} from "../lib/conversationStore.js";
import { getApiKey } from "../lib/apiKeyStore.js";

declare const __CLAIRITY_DEV__: boolean;
const isDev = typeof __CLAIRITY_DEV__ !== "undefined" && __CLAIRITY_DEV__;
const FETCH_TIMEOUT_MS = 30_000;

function devLog(...args: unknown[]): void {
  if (isDev) console.log("[Clairity]", ...args);
}
function devWarn(...args: unknown[]): void {
  if (isDev) console.warn("[Clairity]", ...args);
}
function devError(...args: unknown[]): void {
  if (isDev) console.error("[Clairity]", ...args);
}

// --- Debug-logging fetch wrapper (never logs secrets) ---
async function apiFetch(url: string, init: RequestInit): Promise<Response> {
  devLog(`→ ${init.method ?? "GET"} ${url}`);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    devLog(`← ${res.status} ${res.statusText} (${url})`);
    if (isDev && res.status >= 400) {
      const clone = res.clone();
      try {
        const text = await clone.text();
        devWarn(`  Error body: ${text.slice(0, 500)}`);
      } catch { /* ignore clone read errors */ }
    }
    return res;
  } catch (err) {
    devError(`✗ ${init.method ?? "GET"} ${url} failed:`, err);
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

// --- Session token cache ---
let cachedToken: string | null = null;
let tokenExpiresAt = 0;

async function getSessionToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiresAt - 60_000) {
    devLog(`Token cached (length: ${cachedToken.length})`);
    return cachedToken;
  }

  devLog("Requesting new session token...");
  const res = await apiFetch(`${API_BASE}/session`, { method: "POST" });
  if (!res.ok) {
    throw new Error(`Session creation failed: ${res.status}`);
  }

  const data = (await res.json()) as SessionResponse;
  cachedToken = data.token;
  tokenExpiresAt = new Date(data.expires_at).getTime();
  devLog(`Token obtained (expires: ${data.expires_at})`);
  return cachedToken;
}

function clearCachedToken(): void {
  devLog("Token cleared");
  cachedToken = null;
  tokenExpiresAt = 0;
}

// --- Rewrite handler ---
interface RewriteMessage {
  type: "REWRITE_PROMPT";
  payload: {
    prompt: string;
    site: "chatgpt" | "claude" | "gemini" | "perplexity" | "grok" | "copilot" | "poe" | "huggingchat";
    conversationId: string;
    history?: Message[];
    brief?: ConversationBrief;
  };
}

type IncomingMessage =
  | RewriteMessage
  | { type: "KEEPALIVE" }
  | { type: "CLAIRITY_DIAGNOSE" };

interface RewriteResultPayload extends RewriteResponse {
  briefActive: boolean;
  brief?: ConversationBrief;
}

async function callRewrite(
  prompt: string,
  history: Message[],
  site: string,
  token: string,
  brief: ConversationBrief | null,
  apiKey: string
): Promise<Response> {
  const body: Record<string, unknown> = { prompt, history, site };
  if (brief) body["brief"] = brief;

  return apiFetch(`${API_BASE}/rewrite`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "x-api-key": apiKey,
    },
    body: JSON.stringify(body),
  });
}

/**
 * Fire-and-forget: extract a new brief from history and store it.
 * Called when messageCount reaches 6 and no brief exists yet.
 */
function triggerBriefExtraction(
  conversationId: string,
  history: Message[],
  token: string,
  apiKey: string
): void {
  (async () => {
    try {
      const res = await apiFetch(`${API_BASE}/brief/extract`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "x-api-key": apiKey,
        },
        body: JSON.stringify({ history }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as BriefResponse;
      if (data.brief) {
        await setBrief(conversationId, data.brief);
        devLog(`Brief extracted for ${conversationId}: goal="${data.brief.goal.slice(0, 50)}"`);
      }
    } catch (err) {
      devWarn("Brief extraction failed (non-blocking):", err);
    }
  })();
}

/**
 * Fire-and-forget: update the existing brief with the latest messages.
 * Called every 4 messages after brief is active.
 */
function triggerBriefUpdate(
  conversationId: string,
  currentBrief: ConversationBrief,
  newMessages: Message[],
  token: string,
  apiKey: string
): void {
  (async () => {
    try {
      const res = await apiFetch(`${API_BASE}/brief/update`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "x-api-key": apiKey,
        },
        body: JSON.stringify({ currentBrief, newMessages }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as BriefResponse;
      if (data.brief) {
        await setBrief(conversationId, data.brief);
        devLog(`Brief updated for ${conversationId}: msgCount=${data.brief.messageCount}`);
      }
    } catch (err) {
      devWarn("Brief update failed (non-blocking):", err);
    }
  })();
}

async function handleRewrite(
  payload: RewriteMessage["payload"]
): Promise<
  | { type: "REWRITE_RESULT"; payload: RewriteResultPayload }
  | { type: "REWRITE_ERROR"; payload: ErrorResponse }
> {
  const { prompt, site, conversationId, history: domHistory } = payload;

  // Guard: API key must be set before any backend call
  const apiKey = await getApiKey();
  if (!apiKey) {
    return {
      type: "REWRITE_ERROR",
      payload: {
        error: "Add your Anthropic API key in the Clairity popup to enhance prompts.",
        code: "NO_API_KEY",
      },
    };
  }

  try {
    // Prefer DOM history (extracted live from the page) over session store.
    const sessionHistory = await getHistory(conversationId);
    const history = (domHistory && domHistory.length > 0) ? domHistory : sessionHistory;
    devLog(`History for ${conversationId}: ${history.length} messages (source: ${domHistory && domHistory.length > 0 ? "DOM" : "session"})`);

    // Get current brief (null = STATE 1, present = STATE 2/3)
    const brief = await getBrief(conversationId);
    devLog(`Brief for ${conversationId}: ${brief ? "active" : "none"}`);

    let token = await getSessionToken();
    let res = await callRewrite(prompt, history, site, token, brief, apiKey);

    // If 401, refresh token once and retry
    if (res.status === 401) {
      devWarn("Got 401, refreshing token...");
      clearCachedToken();
      token = await getSessionToken();
      res = await callRewrite(prompt, history, site, token, brief, apiKey);
    }

    if (!res.ok) {
      const errorBody = (await res.json()) as ErrorResponse;
      return { type: "REWRITE_ERROR", payload: errorBody };
    }

    const data = (await res.json()) as RewriteResponse;
    devLog(`Rewrite success: enhanced_prompt length=${data.enhanced_prompt.length}, brief_active=${data.brief_active}`);

    // Store the user message now (after successful rewrite)
    await appendUserMessage(conversationId, prompt);
    // Store the enhanced prompt as the "assistant" turn for context continuity
    await appendAssistantMessage(conversationId, data.enhanced_prompt);

    // Fire-and-forget brief operations based on current state
    if (await shouldExtractBrief(conversationId)) {
      devLog("Triggering brief extraction (fire-and-forget)");
      triggerBriefExtraction(conversationId, history, token, apiKey);
    } else if (brief && (await shouldUpdateBrief(conversationId))) {
      devLog("Triggering brief update (fire-and-forget)");
      const newMessages: Message[] = [
        { role: "user", content: prompt },
        { role: "assistant", content: data.enhanced_prompt },
      ];
      triggerBriefUpdate(conversationId, brief, newMessages, token, apiKey);
    }

    return {
      type: "REWRITE_RESULT",
      payload: {
        ...data,
        briefActive: !!brief,
        brief: brief ?? undefined,
      },
    };
  } catch (err: unknown) {
    const isAbort = err instanceof DOMException && err.name === "AbortError";
    const message = isAbort
      ? "Request timed out"
      : err instanceof Error
        ? err.message
        : "Network error";
    devError("handleRewrite caught:", message);
    return {
      type: "REWRITE_ERROR",
      payload: { error: message, code: isAbort ? "TIMEOUT" : "NETWORK_ERROR" },
    };
  }
}

// --- Diagnostics (dev-only) ---
async function runDiagnostics(): Promise<Record<string, unknown>> {
  const report: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    api_base: API_BASE,
    isDev,
  };

  try {
    const token = await getSessionToken();
    report.session = { status: "ok", token_length: token.length };
  } catch (err) {
    report.session = { status: "error", error: err instanceof Error ? err.message : String(err) };
    return report;
  }

  try {
    const result = await handleRewrite({
      prompt: "help me write better code",
      site: "chatgpt",
      conversationId: "diagnostics",
    });
    if (result.type === "REWRITE_RESULT") {
      report.rewrite = {
        status: "ok",
        enhanced_prompt_length: result.payload.enhanced_prompt.length,
        history_length: result.payload.history_length,
        model: result.payload.model,
        brief_active: result.payload.briefActive,
      };
    } else {
      report.rewrite = { status: "error", error: result.payload };
    }
  } catch (err) {
    report.rewrite = { status: "error", error: err instanceof Error ? err.message : String(err) };
  }

  return report;
}

// --- Keep-alive port for MV3 lifecycle ---
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === "keepalive") {
    port.onDisconnect.addListener(() => {
      // Popup closed; nothing to clean up.
    });
  }
});

// --- Message handler ---
chrome.runtime.onMessage.addListener(
  (
    message: IncomingMessage,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: unknown) => void
  ) => {
    if (message.type === "REWRITE_PROMPT") {
      handleRewrite(message.payload)
        .then(sendResponse)
        .catch((err) => {
          devError("Message handler caught:", err);
          sendResponse({
            type: "REWRITE_ERROR",
            payload: {
              error: err instanceof Error ? err.message : "Service worker error",
              code: "INTERNAL_ERROR",
            },
          });
        });
      return true; // Keep channel open for async response
    }
    if (message.type === "CLAIRITY_DIAGNOSE") {
      runDiagnostics()
        .then(sendResponse)
        .catch((err) => {
          sendResponse({ error: err instanceof Error ? err.message : "Diagnostics failed" });
        });
      return true;
    }
    if (message.type === "KEEPALIVE") {
      sendResponse({ type: "KEEPALIVE_ACK" });
      return false;
    }
    return false;
  }
);
