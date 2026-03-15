import type { SiteAdapter, Message } from "shared/types/index.ts";

/** Selector fallback chain for Gemini prompt input */
const PROMPT_SELECTORS = [
  'div[contenteditable="true"].ql-editor',
  'rich-textarea div[contenteditable="true"]',
  'div[contenteditable="true"][aria-label*="message" i]',
  'div[contenteditable="true"][aria-label*="prompt" i]',
  'div[contenteditable="true"]',
  "textarea",
];

/** Selector fallback chain for button anchor */
const ANCHOR_SELECTORS = [
  'div[contenteditable="true"].ql-editor',
  'rich-textarea div[contenteditable="true"]',
  'div[contenteditable="true"]',
  "textarea",
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

function insertIntoContentEditable(el: HTMLElement, text: string): void {
  el.focus();

  const selection = window.getSelection();
  if (selection) {
    selection.selectAllChildren(el);
    selection.deleteFromDocument();
  }

  if (typeof document.execCommand === "function") {
    const inserted = document.execCommand("insertText", false, text);
    if (inserted) return;
  }

  el.textContent = text;
  el.dispatchEvent(new InputEvent("input", { bubbles: true }));
}

/**
 * Extract conversation history from the Gemini DOM.
 *
 * Primary: .user-query-text / .user-message for user,
 *   .model-response-text / .response-content for assistant.
 * Fallback: message-content, .conversation-turn in DOM order,
 *   alternating user/assistant.
 */
function getConversationHistoryFromDOM(): Message[] {
  type RawMsg = { el: HTMLElement; role: "user" | "assistant" };
  const raw: RawMsg[] = [];

  // Strategy 1: role-specific selectors
  const userEls = Array.from(
    document.querySelectorAll<HTMLElement>(
      ".user-query-text, .user-message, [data-role='user']"
    )
  );
  const assistantEls = Array.from(
    document.querySelectorAll<HTMLElement>(
      ".model-response-text, .response-content, [data-role='assistant'], [data-role='model']"
    )
  );

  if (userEls.length > 0 || assistantEls.length > 0) {
    userEls.forEach((el) => raw.push({ el, role: "user" }));
    assistantEls.forEach((el) => raw.push({ el, role: "assistant" }));

    // Sort by DOM position
    raw.sort((a, b) => {
      const pos = a.el.compareDocumentPosition(b.el);
      return pos & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
    });

    const history: Message[] = [];
    for (let i = raw.length - 1; i >= 0 && history.length < MAX_HISTORY; i--) {
      const { el, role } = raw[i];
      const content = el.textContent?.trim() ?? "";
      if (content.length > 0) {
        history.unshift({ role, content });
      }
    }
    return history;
  }

  // Fallback: generic turn containers, alternate user/assistant by position
  const fallbackEls = Array.from(
    document.querySelectorAll<HTMLElement>(
      "message-content, .conversation-turn, .chat-turn"
    )
  );
  if (fallbackEls.length > 0) {
    const history: Message[] = [];
    const startIdx = Math.max(0, fallbackEls.length - MAX_HISTORY);
    for (let i = fallbackEls.length - 1; i >= startIdx; i--) {
      const el = fallbackEls[i];
      const content = el.textContent?.trim() ?? "";
      if (content.length > 0) {
        const relativeIdx = i - startIdx;
        const role = (relativeIdx % 2 === 0 ? "user" : "assistant") as
          | "user"
          | "assistant";
        history.unshift({ role, content });
      }
    }
    return history;
  }

  return [];
}

export const geminiAdapter: SiteAdapter = {
  id: "gemini",
  name: "Gemini",
  urlPattern: /^https:\/\/gemini\.google\.com/,

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

  destroy(): void {
    // Stateless — nothing to clean up
  },
};
