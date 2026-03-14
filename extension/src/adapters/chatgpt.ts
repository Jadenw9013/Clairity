import type { SiteAdapter } from "shared/types/index.ts";

/** Selector fallback chain for ChatGPT prompt input */
const PROMPT_SELECTORS = [
  "#prompt-textarea",
  '[data-testid="prompt-textarea"]',
  'div[contenteditable="true"][id*="prompt"]',
  "form div[contenteditable='true']",
  "form textarea",
];

/** Selector fallback chain for button anchor (input container) */
const ANCHOR_SELECTORS = [
  '[data-testid="prompt-textarea"]',
  "#prompt-textarea",
  "form div[contenteditable='true']",
  "form textarea",
];

function query(selectors: string[]): HTMLElement | null {
  for (const sel of selectors) {
    try {
      const el = document.querySelector<HTMLElement>(sel);
      if (el) return el;
    } catch {
      // Invalid selector — skip
    }
  }
  return null;
}

/**
 * Insert text into a contentEditable element using the most robust
 * strategy available: selectAll + execCommand('insertText') first,
 * then fall back to textContent + input event dispatch.
 */
function insertIntoContentEditable(el: HTMLElement, text: string): void {
  el.focus();

  // Try execCommand approach — works with ProseMirror/React state
  const selection = window.getSelection();
  if (selection) {
    selection.selectAllChildren(el);
    selection.deleteFromDocument();
  }

  if (typeof document.execCommand === "function") {
    const inserted = document.execCommand("insertText", false, text);
    if (inserted) return;
  }

  // Fallback: direct textContent mutation + event dispatch
  el.textContent = text;
  el.dispatchEvent(new InputEvent("input", { bubbles: true }));
}

export const chatgptAdapter: SiteAdapter = {
  id: "chatgpt",
  name: "ChatGPT",
  urlPattern: /^https:\/\/(chat\.openai\.com|chatgpt\.com)/,

  detect(): boolean {
    return this.urlPattern.test(window.location.origin);
  },

  getPromptElement(): HTMLElement | null {
    return query(PROMPT_SELECTORS);
  },

  getPromptText(): string {
    const el = this.getPromptElement();
    if (!el) return "";
    if (el instanceof HTMLTextAreaElement) return el.value;
    return el.textContent ?? "";
  },

  setPromptText(text: string): void {
    const el = this.getPromptElement();
    if (!el) return;

    if (el instanceof HTMLTextAreaElement) {
      // Native textarea: set value + trigger React's synthetic event
      const nativeSetter = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        "value"
      )?.set;
      if (nativeSetter) {
        nativeSetter.call(el, text);
      } else {
        el.value = text;
      }
      el.dispatchEvent(new Event("input", { bubbles: true }));
      return;
    }

    insertIntoContentEditable(el, text);
  },

  getButtonAnchor(): HTMLElement | null {
    const input = query(ANCHOR_SELECTORS);
    return input?.parentElement ?? null;
  },

  destroy(): void {
    // Stateless — nothing to clean up
  },
};
