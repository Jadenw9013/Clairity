import type { SiteAdapter } from "shared/types/index.ts";
import { chatgptAdapter } from "./chatgpt.js";
import { claudeAdapter } from "./claude.js";
import { geminiAdapter } from "./gemini.js";
import { perplexityAdapter } from "./perplexity.js";
import { grokAdapter } from "./grok.js";
import { copilotAdapter } from "./copilot.js";
import { poeAdapter } from "./poe.js";
import { huggingChatAdapter } from "./huggingchat.js";

const OBSERVER_TIMEOUT_MS = 60_000;

const adapters: SiteAdapter[] = [
  chatgptAdapter,
  claudeAdapter,
  geminiAdapter,
  perplexityAdapter,
  grokAdapter,
  copilotAdapter,
  poeAdapter,
  huggingChatAdapter,
];


/** Detect which adapter matches the current page */
export function detectAdapter(): SiteAdapter | null {
  for (const adapter of adapters) {
    try {
      if (adapter.detect()) return adapter;
    } catch {
      // Adapter detection failed — skip
    }
  }
  return null;
}

/**
 * Start the adapter system.
 * Detects the right adapter, then injects the enhance button.
 * If the prompt element isn't in the DOM yet (SPA), uses MutationObserver
 * to wait for it with a 30s timeout.
 *
 * @param onReady Called with the adapter and prompt element when ready
 */
export function startAdapterSystem(
  onReady: (adapter: SiteAdapter, promptEl: HTMLElement) => void
): void {
  const adapter = detectAdapter();
  if (!adapter) return; // Not a supported site — exit silently

  // Try immediately
  const el = adapter.getPromptElement();
  if (el) {
    onReady(adapter, el);
    return;
  }

  // SPA: wait for prompt element to appear
  let resolved = false;
  const observer = new MutationObserver(() => {
    if (resolved) return;
    const promptEl = adapter.getPromptElement();
    if (promptEl) {
      resolved = true;
      observer.disconnect();
      onReady(adapter, promptEl);
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  // Timeout after 30 seconds
  setTimeout(() => {
    if (!resolved) {
      resolved = true;
      observer.disconnect();
    }
  }, OBSERVER_TIMEOUT_MS);
}
