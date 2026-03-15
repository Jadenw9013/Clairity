import type { SiteAdapter } from "shared/types/index.ts";
import type { RewriteResponse, ErrorResponse, Site } from "shared/types/index.ts";
// @ts-ignore
import tokensCss from "../styles/tokens.css?inline";
// @ts-ignore
import panelCss from "./panel.css?inline";

const BUTTON_ID = "clairity-enhance-root";
const CARD_ID = "clairity-preview-card";

function getConversationId(): string {
  try {
    const url = new URL(window.location.href);
    return url.origin + url.pathname;
  } catch {
    return "default";
  }
}

/** Remove the floating preview card if it exists */
function dismissCard(): void {
  const existing = document.getElementById(CARD_ID);
  existing?.remove();
}

/**
 * Show the bottom-right preview card with the enhanced prompt.
 * "Use this prompt" injects into the textarea. "Copy" copies to clipboard.
 */
function showPreviewCard(
  enhancedPrompt: string,
  historyLength: number,
  adapter: SiteAdapter
): void {
  dismissCard();

  const card = document.createElement("div");
  card.id = CARD_ID;
  card.setAttribute("data-clairity-card", "true");

  const shadow = card.attachShadow({ mode: "open" });

  const style = document.createElement("style");
  style.textContent = tokensCss + "\n" + panelCss;
  shadow.appendChild(style);

  // Card root
  const root = document.createElement("div");
  root.className = "cl-card-root";
  shadow.appendChild(root);

  // Header row
  const header = document.createElement("div");
  header.className = "cl-card-header";

  const title = document.createElement("span");
  title.className = "cl-card-title";
  title.innerHTML = `<span class="cl-star">✦</span> Enhanced by Clairity`;

  const closeBtn = document.createElement("button");
  closeBtn.className = "cl-card-close";
  closeBtn.textContent = "✕";
  closeBtn.setAttribute("aria-label", "Close");
  closeBtn.addEventListener("click", dismissCard);

  header.appendChild(title);
  header.appendChild(closeBtn);
  root.appendChild(header);

  // Chip
  const chip = document.createElement("div");
  chip.className = "cl-card-chip";
  chip.textContent = historyLength === 0
    ? "✦ first prompt"
    : `✦ ${historyLength} messages used`;
  root.appendChild(chip);

  // Enhanced prompt preview
  const preview = document.createElement("div");
  preview.className = "cl-card-preview";
  preview.textContent = enhancedPrompt;
  root.appendChild(preview);

  // Actions
  const actions = document.createElement("div");
  actions.className = "cl-card-actions";

  const useBtn = document.createElement("button");
  useBtn.className = "cl-btn-use";
  useBtn.innerHTML = `<span class="cl-star">✦</span> Use this prompt`;
  useBtn.addEventListener("click", () => {
    adapter.setPromptText(enhancedPrompt);
    const el = adapter.getPromptElement();
    if (el) {
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      // Try to focus the field so user can send immediately
      if ("focus" in el) (el as HTMLElement).focus();
    }
    dismissCard();
  });

  const copyBtn = document.createElement("button");
  copyBtn.className = "cl-btn-copy";
  copyBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy`;
  copyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(enhancedPrompt);
      copyBtn.textContent = "Copied!";
      copyBtn.classList.add("is-copied");
      setTimeout(() => {
        copyBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2-2v1"/></svg> Copy`;
        copyBtn.classList.remove("is-copied");
      }, 2000);
    } catch { /* ignore */ }
  });

  actions.appendChild(useBtn);
  actions.appendChild(copyBtn);
  root.appendChild(actions);

  document.body.appendChild(card);

  // Close on Escape
  const escHandler = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      dismissCard();
      document.removeEventListener("keydown", escHandler);
    }
  };
  document.addEventListener("keydown", escHandler);

  // Auto-dismiss after 90 seconds
  setTimeout(dismissCard, 90_000);
}

/** Show the error state inside a small card */
function showErrorCard(message: string): void {
  dismissCard();

  const card = document.createElement("div");
  card.id = CARD_ID;
  const shadow = card.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = tokensCss + "\n" + panelCss;
  shadow.appendChild(style);

  const root = document.createElement("div");
  root.className = "cl-card-root cl-card-error";

  const header = document.createElement("div");
  header.className = "cl-card-header";
  header.innerHTML = `<span>⚠ Clairity error</span>`;

  const closeBtn = document.createElement("button");
  closeBtn.className = "cl-card-close";
  closeBtn.textContent = "✕";
  closeBtn.addEventListener("click", dismissCard);
  header.appendChild(closeBtn);

  const body = document.createElement("p");
  body.className = "cl-error-msg";
  body.textContent = message;

  root.appendChild(header);
  root.appendChild(body);
  shadow.appendChild(root);
  document.body.appendChild(card);

  setTimeout(dismissCard, 6_000);
}

export function injectEnhanceButton(
  adapter: SiteAdapter,
  anchor: HTMLElement
): void {
  if (document.getElementById(BUTTON_ID)) return;

  const host = document.createElement("div");
  host.id = BUTTON_ID;
  host.style.cssText = "display:inline-flex;align-items:center;margin:0 4px;";

  const shadow = host.attachShadow({ mode: "open" });

  const style = document.createElement("style");
  style.textContent = tokensCss + "\n" + panelCss;
  shadow.appendChild(style);

  // White pill button matching the reference design
  const btn = document.createElement("button");
  btn.className = "cl-trigger-pill";
  btn.innerHTML = `<span class="cl-trigger-icon">✦</span><span class="cl-trigger-label">Enhance Request</span>`;
  btn.setAttribute("aria-label", "Enhance prompt with Clairity");
  btn.type = "button";
  shadow.appendChild(btn);

  const setLoading = (loading: boolean) => {
    btn.disabled = loading;
    if (loading) {
      btn.innerHTML = `<span class="cl-spinner-sm"></span><span class="cl-trigger-label">Enhancing…</span>`;
      btn.classList.add("is-loading");
    } else {
      btn.innerHTML = `<span class="cl-trigger-icon">✦</span><span class="cl-trigger-label">Enhance Request</span>`;
      btn.classList.remove("is-loading");
    }
  };

  btn.addEventListener("click", async () => {
    const prompt = adapter.getPromptText().trim();
    if (!prompt) return;

    const conversationId = getConversationId();
    setLoading(true);

    try {
      const response = await chrome.runtime.sendMessage({
        type: "REWRITE_PROMPT",
        payload: { prompt, site: adapter.id as Site, conversationId },
      });

      if (!response) {
        showErrorCard("No response from service worker — try reloading the extension.");
      } else if (response.type === "REWRITE_RESULT") {
        const data = response.payload as RewriteResponse;
        showPreviewCard(data.enhanced_prompt, data.history_length, adapter);
      } else if (response.type === "REWRITE_ERROR") {
        const data = response.payload as ErrorResponse;
        showErrorCard(data.error || "Unknown error from backend");
      } else {
        showErrorCard("Unexpected response format");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      showErrorCard(msg);
    } finally {
      setLoading(false);
    }
  });

  anchor.insertAdjacentElement("afterend", host);
}
