// backend/src/lib/featureFlags.ts
// Centralized feature flags — all default to false/off (safe).
// Only affects behavior when explicitly enabled via env vars.

export const IMPROVED_MVP_ENABLED =
    process.env["IMPROVED_MVP_ENABLED"] === "true";

export const REWRITE_LLM_ENABLED =
    process.env["REWRITE_LLM_ENABLED"] === "true";

// Provider key (backend-only, never shipped to extension)
export const LLM_API_KEY = process.env["LLM_API_KEY"] ?? "";

// ─── MCS daemon integration (local-only context enrichment) ─────────────────
// The MCS daemon (ctx-daemon) defaults to port 4040.
// NOTE: port 4041 is ctx-cloud — do NOT use that for pack/context.

/** Top-level kill switch — if false, MCS is never called regardless of context mode */
export const MCS_ENABLED = process.env["MCS_ENABLED"] === "true";

/** MCS daemon base URL (default: http://localhost:4040) */
export const MCS_BASE_URL = process.env["MCS_BASE_URL"] ?? "http://localhost:4040";

/** Timeout for individual MCS HTTP requests in milliseconds */
export const MCS_TIMEOUT_MS = Math.max(
    500,
    parseInt(process.env["MCS_TIMEOUT_MS"] ?? "2000", 10) || 2000
);

/** Max number of context items to retrieve from MCS pack */
export const MCS_MAX_ITEMS = Math.max(
    1,
    parseInt(process.env["MCS_MAX_ITEMS"] ?? "10", 10) || 10
);

/** Max total characters of context to inject into the rewrite prompt */
export const MCS_MAX_CONTEXT_TOKENS = Math.max(
    100,
    parseInt(process.env["MCS_MAX_CONTEXT_TOKENS"] ?? "4000", 10) || 4000
);

/** MCS context mode: off = no calls, auto = fetch if available, pinned = fetch specific categories */
export type McsContextMode = "off" | "auto" | "pinned";

export const MCS_CONTEXT_MODE: McsContextMode =
    (["off", "auto", "pinned"].includes(process.env["MCS_CONTEXT_MODE"] ?? "")
        ? process.env["MCS_CONTEXT_MODE"] as McsContextMode
        : "off");

export const MCS_PINNED_CATEGORIES: string[] =
    (process.env["MCS_PINNED_CATEGORIES"] ?? "").split(",").map(s => s.trim()).filter(Boolean);

export function logFeatureFlags(logger: { info: (...args: unknown[]) => void }): void {
    logger.info(
        {
            IMPROVED_MVP_ENABLED,
            REWRITE_LLM_ENABLED,
            LLM_API_KEY_SET: LLM_API_KEY.length > 0,
            MCS_ENABLED,
            MCS_BASE_URL,
            MCS_CONTEXT_MODE,
            MCS_TIMEOUT_MS,
            MCS_MAX_ITEMS,
            MCS_MAX_CONTEXT_TOKENS,
            MCS_PINNED_CATEGORIES,
        },
        "Feature flags"
    );
}
