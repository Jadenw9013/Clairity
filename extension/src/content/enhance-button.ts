import type { SiteAdapter } from "shared/types/index.ts";
import type { RewriteResponse, ErrorResponse, Site } from "shared/types/index.ts";
// @ts-ignore - Vite inline import
import tokensCss from "../styles/tokens.css?inline";
// @ts-ignore - Vite inline import
import panelCss from "./panel.css?inline";

const BUTTON_ID = "clairity-enhance-root";

/** Derive a stable conversationId from the current tab URL. */
function getConversationId(): string {
  try {
    const url = new URL(window.location.href);
    // Use origin + pathname (stable across query param changes in SPA sites)
    return url.origin + url.pathname;
  } catch {
    return "default";
  }
}

export function injectEnhanceButton(
  adapter: SiteAdapter,
  anchor: HTMLElement
): void {
  if (document.getElementById(BUTTON_ID)) return;

  const host = document.createElement("div");
  host.id = BUTTON_ID;
  host.style.display = "inline-block";
  host.style.position = "relative";
  host.style.zIndex = "9999";
  host.style.margin = "4px";

  const shadow = host.attachShadow({ mode: "closed" });

  const style = document.createElement("style");
  style.textContent = `${tokensCss}\n${panelCss}`;
  shadow.appendChild(style);

  // Trigger Button
  const btn = document.createElement("button");
  btn.className = "cl-trigger cl-btn-ai";
  btn.textContent = "Fix my question";
  btn.setAttribute("aria-label", "Enhance prompt");
  btn.type = "button";
  shadow.appendChild(btn);

  // Transparency chip (hidden until first successful enhance)
  const chip = document.createElement("div");
  chip.style.cssText = `
    display: none;
    margin-top: 4px;
    font-size: 11px;
    color: var(--clr-text-light, #6b7280);
    font-style: italic;
    white-space: nowrap;
  `;
  shadow.appendChild(chip);

  const showChip = (historyLength: number) => {
    chip.textContent =
      historyLength === 0
        ? "✦ Enhanced · first prompt"
        : `✦ Enhanced · ${historyLength} messages used`;
    chip.style.display = "block";
  };

  // Helper to show a mini toast for Undo
  const showUndoToast = (originalText: string) => {
    let toast = shadow.getElementById("clairity-undo-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "clairity-undo-toast";
      toast.style.cssText = `
        position: absolute;
        top: calc(100% + 8px);
        left: 0;
        background: var(--clr-bg-surface);
        border: 1px solid var(--clr-border);
        border-radius: var(--radius-md);
        padding: 8px 12px;
        box-shadow: var(--shadow-md);
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 12px;
        color: var(--text-main);
        z-index: 10000;
        white-space: nowrap;
        animation: slideIn 0.2s ease-out;
      `;

      const msg = document.createElement("span");
      msg.textContent = "Prompt enhanced.";

      const undoBtn = document.createElement("button");
      undoBtn.textContent = "Undo";
      undoBtn.style.cssText = `
        background: none;
        border: none;
        color: var(--clr-primary);
        font-weight: 600;
        cursor: pointer;
        padding: 0;
        font-size: 12px;
      `;
      undoBtn.addEventListener("click", () => {
        adapter.setPromptText(originalText);
        const el = adapter.getPromptElement();
        if (el) {
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
        }
        toast?.remove();
      });

      const closeBtn = document.createElement("button");
      closeBtn.textContent = "×";
      closeBtn.style.cssText = `
        background: none;
        border: none;
        color: var(--clr-text-light);
        cursor: pointer;
        padding: 0 4px;
        margin-left: 4px;
      `;
      closeBtn.addEventListener("click", () => toast?.remove());

      toast.appendChild(msg);
      toast.appendChild(undoBtn);
      toast.appendChild(closeBtn);
      shadow.appendChild(toast);

      setTimeout(() => {
        if (toast?.parentNode) toast.remove();
      }, 10000);
    }
  };

  const handleEnhanceContext = async () => {
    const prompt = adapter.getPromptText().trim();
    if (!prompt) return;

    const originalPromptText = prompt;
    const conversationId = getConversationId();

    btn.disabled = true;
    btn.textContent = "Enhancing...";
    btn.classList.add("is-loading");

    try {
      const response = await chrome.runtime.sendMessage({
        type: "REWRITE_PROMPT",
        payload: { prompt, site: adapter.id as Site, conversationId },
      });

      if (!response) {
        throw new Error("No response from service worker — reload extension");
      } else if (response.type === "REWRITE_RESULT") {
        const data = response.payload as RewriteResponse;

        adapter.setPromptText(data.enhanced_prompt);

        const el = adapter.getPromptElement();
        if (el) {
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
        }

        // Show transparency chip
        showChip(data.history_length);

        showUndoToast(originalPromptText);

      } else if (response.type === "REWRITE_ERROR") {
        const data = response.payload as ErrorResponse;
        throw new Error(data.error || "Unknown error from backend");
      } else {
        throw new Error("Unexpected response format");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      let toast = shadow.getElementById("clairity-error-toast");
      if (!toast) {
        toast = document.createElement("div");
        toast.id = "clairity-error-toast";
        toast.style.cssText = `
          position: absolute;
          top: calc(100% + 8px);
          left: 0;
          background: var(--clr-error-bg);
          border: 1px solid var(--clr-error-border);
          color: var(--clr-error);
          border-radius: var(--radius-md);
          padding: 8px 12px;
          box-shadow: var(--shadow-sm);
          font-size: 12px;
          z-index: 10000;
          white-space: nowrap;
        `;
        toast.textContent = `Error: ${msg}`;
        shadow.appendChild(toast);
        setTimeout(() => toast?.remove(), 5000);
      }
    } finally {
      btn.disabled = false;
      btn.textContent = "Fix my question";
      btn.classList.remove("is-loading");
    }
  };

  btn.addEventListener("click", () => {
    void handleEnhanceContext();
  });

  anchor.insertAdjacentElement("afterend", host);
}
