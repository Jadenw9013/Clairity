import type { SiteAdapter, Message } from "shared/types/index.ts";

const PROMPT_SELECTORS = [
  'div[contenteditable="true"]#searchbox',
  'textarea[name="q"]',
  'div[contenteditable="true"][aria-label*="Ask"]',
  'cib-text-input div[contenteditable="true"]',
  "textarea",
];

const ANCHOR_SELECTORS = [
  'div[contenteditable="true"]#searchbox',
  'div[contenteditable="true"][aria-label*="Ask"]',
  'cib-text-input div[contenteditable="true"]',
  "textarea",
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
  urlPattern: /^https:\/\/copilot\.microsoft\.com|^https:\/\/www\.bing\.com\/chat/,

  detect(): boolean {
    return this.urlPattern.test(window.location.origin + window.location.pathname);
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
    const input = query(ANCHOR_SELECTORS);
    if (!input) return null;
    return (input.closest("cib-text-input") as HTMLElement) ?? input.parentElement;
  },

  getConversationHistory(): Message[] {
    return getConversationHistoryFromDOM();
  },

  destroy(): void {},
};
