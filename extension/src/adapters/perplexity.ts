import type { SiteAdapter, Message } from "shared/types/index.ts";

const PROMPT_SELECTORS = [
  'textarea[placeholder*="connectors"]',
  'textarea[placeholder*="Type @"]',
  'div[contenteditable="true"][data-slate-editor="true"]',
  'div[contenteditable="true"][data-slate-node="value"]',
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

/**
 * Insert text into Perplexity's Slate.js editor.
 * Slate requires execCommand-based insertion with proper InputEvent
 * to update its internal state tree.
 */
function insertIntoSlateEditor(el: HTMLElement, text: string): void {
  el.focus();
  const sel = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(el);
  sel?.removeAllRanges();
  sel?.addRange(range);
  document.execCommand("insertText", false, text);
  el.dispatchEvent(
    new InputEvent("input", {
      bubbles: true,
      inputType: "insertText",
      data: text,
    })
  );
}

function getConversationHistoryFromDOM(): Message[] {
  type RawMsg = { el: HTMLElement; role: "user" | "assistant" };
  const raw: RawMsg[] = [];

  const userEls = Array.from(
    document.querySelectorAll<HTMLElement>(
      '[data-testid="user-message"], .user-message, div[class*="UserMessage"]'
    )
  );
  const assistantEls = Array.from(
    document.querySelectorAll<HTMLElement>(
      '[data-testid="answer"], div[class*="Answer"], div[class*="ProAnswer"]'
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

export const perplexityAdapter: SiteAdapter = {
  id: "perplexity",
  name: "Perplexity",
  urlPattern: /^https:\/\/(www\.)?perplexity\.ai/,

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
      const nativeSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
      if (nativeSetter) { nativeSetter.call(el, text); } else { el.value = text; }
      el.dispatchEvent(new Event("input", { bubbles: true }));
      return;
    }
    // Slate.js editor — specialized injection
    insertIntoSlateEditor(el, text);
  },

  getButtonAnchor(): HTMLElement | null {
    const input = this.getPromptElement();
    if (!input) return null;

    // Find the container holding both the input and the bottom toolbar
    const container = input.closest<HTMLElement>(
      'form, div[class*="relative"]'
    );
    if (container) {
      // Look for the toolbar row containing buttons (+ , Model, mic, etc.)
      const toolbar = container.querySelector<HTMLElement>(
        'div[class*="flex"][class*="items-center"]:has(button)'
      );
      if (toolbar && toolbar !== container) {
        // Return the first child (the + button) so afterend injection
        // places Clairity right after it, between + and Model dropdown
        const firstChild = toolbar.children[0] as HTMLElement | undefined;
        if (firstChild) return firstChild;
        return toolbar;
      }
    }

    // Fallback: go up two levels past the Slate wrapper divs
    return (input.parentElement?.parentElement as HTMLElement) ?? input.parentElement;
  },

  getConversationHistory(): Message[] {
    return getConversationHistoryFromDOM();
  },

  isGenerating(): boolean {
    return !!(
      document.querySelector('button[aria-label*="Stop" i]') ??
      document.querySelector('[class*="stop"]')
    );
  },

  destroy(): void { },
};
