import type { SiteAdapter, Message } from "shared/types/index.ts";

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

/** Max messages to extract from DOM */
const MAX_HISTORY = 20;

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

function queryAll(selectors: string[]): HTMLElement[] {
  for (const sel of selectors) {
    try {
      const els = Array.from(document.querySelectorAll<HTMLElement>(sel));
      if (els.length > 0) return els;
    } catch {
      // Invalid selector — skip
    }
  }
  return [];
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

/**
 * Extract conversation history from the ChatGPT DOM.
 * Primary: data-message-author-role attributes.
 * Fallback: any [data-message-author-role] element, read role attribute.
 */
function getConversationHistoryFromDOM(): Message[] {
  // Primary: get all message elements with known role attribute
  const allMessages = Array.from(
    document.querySelectorAll<HTMLElement>("[data-message-author-role]")
  );

  if (allMessages.length > 0) {
    const history: Message[] = allMessages
      .map((el) => {
        const role = el.getAttribute("data-message-author-role");
        const content = el.textContent?.trim() ?? "";
        if (!content || (role !== "user" && role !== "assistant")) return null;
        return { role: role as "user" | "assistant", content };
      })
      .filter((m): m is Message => m !== null);
    return history.slice(-MAX_HISTORY);
  }

  // Fallback: alternate user/assistant by DOM order for older markup
  const fallbackEls = queryAll([
    '[data-message-author-role]',
    '.message',
  ]);
  if (fallbackEls.length > 0) {
    return fallbackEls
      .slice(-MAX_HISTORY)
      .map((el, i) => ({
        role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
        content: el.textContent?.trim() ?? "",
      }))
      .filter((m) => m.content.length > 0);
  }

  return [];
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

  getConversationHistory(): Message[] {
    return getConversationHistoryFromDOM();
  },

  isGenerating(): boolean {
    return !!(
      document.querySelector('[data-testid="stop-button"]') ??
      document.querySelector('button[aria-label*="Stop" i]')
    );
  },

  destroy(): void {
    // Stateless — nothing to clean up
  },
};
