import type { SiteAdapter, Message } from "shared/types/index.ts";

const PROMPT_SELECTORS = [
  '.query-bar div[contenteditable="true"]',
  'div[contenteditable="true"][aria-label*="Ask"]',
  'textarea[aria-label*="Ask Grok"]',
  '.query-bar textarea',
  'div[data-testid="tweetTextarea_0"]',
  'div[contenteditable="true"]',
];

const MAX_HISTORY = 20;

function query(selectors: string[]): HTMLElement | null {
  for (const sel of selectors) {
    try {
      const el = document.querySelector<HTMLElement>(sel);
      if (el) return el;
    } catch { /* skip */ }
  }
  return null;
}

function insertIntoContentEditable(el: HTMLElement, text: string): void {
  el.focus();
  const selection = window.getSelection();
  if (selection) { selection.selectAllChildren(el); selection.deleteFromDocument(); }
  if (typeof document.execCommand === "function") {
    const inserted = document.execCommand("insertText", false, text);
    if (inserted) return;
  }
  el.textContent = text;
  el.dispatchEvent(new InputEvent("input", { bubbles: true }));
}

function getConversationHistoryFromDOM(): Message[] {
  type RawMsg = { el: HTMLElement; role: "user" | "assistant" };
  const raw: RawMsg[] = [];

  const userEls = Array.from(
    document.querySelectorAll<HTMLElement>(
      '[data-testid="userMessage"], div[class*="UserMessage"], [aria-label*="You said"]'
    )
  );
  const assistantEls = Array.from(
    document.querySelectorAll<HTMLElement>(
      '[data-testid="grokMessage"], div[class*="GrokMessage"], [aria-label*="Grok said"]'
    )
  );

  if (userEls.length > 0 || assistantEls.length > 0) {
    userEls.forEach((el) => raw.push({ el, role: "user" }));
    assistantEls.forEach((el) => raw.push({ el, role: "assistant" }));
    raw.sort((a, b) => {
      const pos = a.el.compareDocumentPosition(b.el);
      return pos & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
    });
    return raw
      .map(({ el, role }) => ({ role, content: el.textContent?.trim() ?? "" }))
      .filter((m) => m.content.length > 0)
      .slice(-MAX_HISTORY);
  }

  return [];
}

export const grokAdapter: SiteAdapter = {
  id: "grok",
  name: "Grok",
  urlPattern: /^https:\/\/(www\.)?x\.com\/i\/grok|^https:\/\/grok\.x\.com|^https:\/\/grok\.com/,

  detect(): boolean {
    return this.urlPattern.test(window.location.href);
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
      const nativeSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
      if (nativeSetter) { nativeSetter.call(el, text); } else { el.value = text; }
      el.dispatchEvent(new Event("input", { bubbles: true }));
      return;
    }
    insertIntoContentEditable(el, text);
  },

  getButtonAnchor(): HTMLElement | null {
    // Return the input element — enhance-button.ts searches anchor.parentElement
    // for Grammarly and inserts our button next to it on the right side.
    // If no Grammarly, "afterend" places it right after the input in the
    // query-bar flex row, next to the Auto/mic/waveform buttons.
    const input = this.getPromptElement();
    return input;
  },

  getConversationHistory(): Message[] {
    return getConversationHistoryFromDOM();
  },

  destroy(): void {},
};
