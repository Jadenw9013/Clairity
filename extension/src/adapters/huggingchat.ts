import type { SiteAdapter, Message } from "shared/types/index.ts";

const PROMPT_SELECTORS = [
  'textarea[placeholder="Ask anything"]',
  'textarea[rows="1"]',
  'textarea[name="text"]',
  'div[contenteditable="true"]#chat-input',
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

function getConversationHistoryFromDOM(): Message[] {
  type RawMsg = { el: HTMLElement; role: "user" | "assistant" };
  const raw: RawMsg[] = [];

  const userEls = Array.from(
    document.querySelectorAll<HTMLElement>(
      'div[class*="user"] div[class*="prose"], [data-role="user"]'
    )
  );
  const assistantEls = Array.from(
    document.querySelectorAll<HTMLElement>(
      'div[class*="assistant"] div[class*="prose"], [data-role="assistant"]'
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

export const huggingChatAdapter: SiteAdapter = {
  id: "huggingchat",
  name: "HuggingChat",
  urlPattern: /^https:\/\/huggingface\.co\/chat/,

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
    el.textContent = text;
    el.dispatchEvent(new InputEvent("input", { bubbles: true }));
  },

  getButtonAnchor(): HTMLElement | null {
    // Target the toolbar div with scrollbar-custom and flex-wrap classes
    const toolbar = document.querySelector<HTMLElement>(
      'div[class*="scrollbar-custom"][class*="flex-wrap"]'
    );
    if (toolbar) return toolbar;

    // Fallback: find the textarea and go up to the form's toolbar area
    const input = this.getPromptElement();
    if (!input) return null;
    const form = input.closest("form");
    if (form) {
      const toolbarInForm = form.querySelector<HTMLElement>('div[class*="flex-wrap"]');
      if (toolbarInForm) return toolbarInForm;
    }
    return input.parentElement;
  },

  getConversationHistory(): Message[] {
    return getConversationHistoryFromDOM();
  },

  isGenerating(): boolean { return false; },

  destroy(): void {},
};
