import type { SiteAdapter, Message } from "shared/types/index.ts";

const PROMPT_SELECTORS = [
  '[data-lexical-editor="true"]',
  'div[contenteditable="true"][role="textbox"]',
  'span[contenteditable="true"][role="textbox"]',
  '[aria-label="Message Copilot"]',
  '[placeholder*="Message" i]',
  '#userInput',
  '#m365-chat-editor-target-element',
  'div[contenteditable="true"][spellcheck="true"]',
  'p[class*="editor"][contenteditable]',
  'div[contenteditable="true"]',
  'textarea',
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
 * Insert text into Copilot's Lexical editor.
 * Standard textContent mutation doesn't work with Lexical — must use
 * execCommand selectAll + insertText to update the editor state.
 */
function insertIntoCopilotEditor(el: HTMLElement, text: string): void {
  el.focus();
  document.execCommand("selectAll", false);
  document.execCommand("insertText", false, text);
  el.dispatchEvent(
    new InputEvent("input", {
      bubbles: true,
      cancelable: true,
      inputType: "insertText",
      data: text,
    })
  );
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

function getConversationHistoryFromDOM(): Message[] {
  type RawMsg = { el: HTMLElement; role: "user" | "assistant" };
  const raw: RawMsg[] = [];

  const userEls = Array.from(
    document.querySelectorAll<HTMLElement>(
      'cib-chat-turn[pivot="human"] cib-message-group, [data-testid="user-message"], div[class*="human"]'
    )
  );
  const assistantEls = Array.from(
    document.querySelectorAll<HTMLElement>(
      'cib-chat-turn[pivot="ai"] cib-message-group, [data-testid="bot-message"], div[class*="bot-message"]'
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

export const copilotAdapter: SiteAdapter = {
  id: "copilot",
  name: "Microsoft Copilot",
  urlPattern: /^https:\/\/(copilot\.microsoft\.com|www\.copilot\.microsoft\.com|bing\.com\/chat|www\.bing\.com\/chat|m365\.cloud\.microsoft|outlook\.cloud\.microsoft)/,

  detect(): boolean {
    const href = window.location.origin + window.location.pathname;
    const match = this.urlPattern.test(href);
    console.log('[Clairity Copilot] detect() called', href, 'match:', match);
    return match;
  },

  getPromptElement(): HTMLElement | null {
    console.log('[Clairity Copilot] getPromptElement() called');
    const el = query(PROMPT_SELECTORS);
    console.log('[Clairity Copilot] found:', el?.tagName, el?.getAttribute('role'), el?.getAttribute('aria-label'));
    return el;
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
    // Copilot uses a Lexical editor — special insertion required
    insertIntoCopilotEditor(el, text);
  },

  getButtonAnchor(): HTMLElement | null {
    const input = this.getPromptElement();
    if (!input) return null;

    // Strategy 1: find the Smart dropdown — most reliable anchor on both
    // copilot.microsoft.com and m365.cloud.microsoft.
    // Insert Clairity as first child of its row (before Smart).
    const smartBtn =
      document.querySelector<HTMLElement>('button[aria-label*="Smart" i]') ??
      document.querySelector<HTMLElement>('button[aria-label*="model" i]') ??
      document.querySelector<HTMLElement>('[class*="model-selector"]');
    if (smartBtn) {
      const row = smartBtn.closest<HTMLElement>(
        'div[class*="flex"], div[class*="row"]'
      ) ?? smartBtn.parentElement;
      if (row) {
        row.setAttribute("data-clairity-inject", "prepend");
        return row;
      }
    }

    // Strategy 2: find the + button and return it for afterend injection
    const plusBtn =
      document.querySelector<HTMLElement>('button[aria-label*="new" i]') ??
      document.querySelector<HTMLElement>('button[aria-label*="attach" i]') ??
      document.querySelector<HTMLElement>('button[aria-label*="add" i]') ??
      document.querySelector<HTMLElement>('[class*="toolbar"] button:first-child') ??
      document.querySelector<HTMLElement>('[class*="actions"] button:first-child');
    if (plusBtn) return plusBtn;

    // Last resort
    return input.parentElement;
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

  destroy(): void {},
};
