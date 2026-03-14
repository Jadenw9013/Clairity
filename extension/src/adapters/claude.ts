import type { SiteAdapter } from "shared/types/index.ts";

/** Selector fallback chain for Claude prompt input */
const PROMPT_SELECTORS = [
  'div[contenteditable="true"].ProseMirror',
  'div[contenteditable="true"][aria-label*="message"]',
  'div[contenteditable="true"][aria-label*="Message"]',
  'fieldset div[contenteditable="true"]',
  'div[contenteditable="true"]',
];

/** Selector fallback chain for button anchor */
const ANCHOR_SELECTORS = [
  'div[contenteditable="true"].ProseMirror',
  'fieldset div[contenteditable="true"]',
  'div[contenteditable="true"]',
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

  // Try execCommand approach — works with ProseMirror state
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

export const claudeAdapter: SiteAdapter = {
  id: "claude",
  name: "Claude",
  urlPattern: /^https:\/\/claude\.ai/,

  detect(): boolean {
    return this.urlPattern.test(window.location.origin);
  },

  getPromptElement(): HTMLElement | null {
    return query(PROMPT_SELECTORS);
  },

  getPromptText(): string {
    const el = this.getPromptElement();
    if (!el) return "";
    return el.textContent ?? "";
  },

  setPromptText(text: string): void {
    const el = this.getPromptElement();
    if (!el) return;

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
