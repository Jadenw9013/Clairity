import type {
  RewriteRequest,
  RewriteResponse,
  ErrorResponse,
  SessionResponse,
  RewritePreset,
} from "shared/types/index.ts";

import { API_BASE } from "../config.js";

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
    // Log error response bodies in dev (truncated, never tokens)
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
    devLog(`Token cached (length: ${cachedToken.length}, expires in ${Math.round((tokenExpiresAt - Date.now()) / 1000)}s)`);
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
  devLog(`Token obtained (length: ${cachedToken.length}, expires: ${data.expires_at})`);
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
    site: RewriteRequest["context"]["site"];
    preset?: RewritePreset;
  };
}

type IncomingMessage =
  | RewriteMessage
  | { type: "KEEPALIVE" }
  | { type: "CLAIRITY_DIAGNOSE" };

async function callRewrite(
  payload: RewriteMessage["payload"],
  token: string
): Promise<Response> {
  const body: RewriteRequest = {
    prompt: payload.prompt,
    context: { site: payload.site },
    preset: payload.preset,
  };

  devLog("Rewrite request body:", JSON.stringify(body));

  return apiFetch(`${API_BASE}/rewrite`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
}

async function handleRewrite(
  payload: RewriteMessage["payload"]
): Promise<
  | { type: "REWRITE_RESULT"; payload: RewriteResponse }
  | { type: "REWRITE_ERROR"; payload: ErrorResponse }
> {
  try {
    let token = await getSessionToken();
    let res = await callRewrite(payload, token);

    // If 401, token may have expired — refresh once and retry
    if (res.status === 401) {
      devWarn("Got 401, refreshing token and retrying...");
      clearCachedToken();
      token = await getSessionToken();
      res = await callRewrite(payload, token);
    }

    if (!res.ok) {
      const errorBody = (await res.json()) as ErrorResponse;
      return { type: "REWRITE_ERROR", payload: errorBody };
    }

    const data = (await res.json()) as RewriteResponse;
    devLog(`Rewrite success: enhanced_prompt length=${data.enhanced_prompt.length}, score=${data.score?.overall}`);
    return { type: "REWRITE_RESULT", payload: data };
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

  // Step 1: Session
  try {
    const token = await getSessionToken();
    report.session = { status: "ok", token_length: token.length };
  } catch (err) {
    report.session = { status: "error", error: err instanceof Error ? err.message : String(err) };
    return report; // Can't continue without token
  }

  // Step 2: Rewrite
  try {
    const result = await handleRewrite({
      prompt: "help me write better code",
      site: "chatgpt",
    });
    if (result.type === "REWRITE_RESULT") {
      report.rewrite = {
        status: "ok",
        enhanced_prompt_length: result.payload.enhanced_prompt.length,
        score_overall: result.payload.score?.overall,
        changes_count: result.payload.changes?.length,
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
      // Popup closed or navigated away; nothing to clean up.
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
