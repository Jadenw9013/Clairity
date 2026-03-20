import type { SiteAdapter, Message } from "shared/types/index.ts";

/** Selector fallback chain for Gemini prompt input */
const PROMPT_SELECTORS = [
  'rich-textarea p[contenteditable="true"]',
  "rich-textarea .ql-editor",
  'rich-textarea div[contenteditable="true"]',
  'div[contenteditable="true"][aria-label*="Enter a prompt"]',
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

/**
 * Insert text into Gemini's rich-textarea p element.
 * Standard contentEditable mutation doesn't reliably sync with
 * Gemini's editor state — dispatch both Event and InputEvent.
 */
function insertIntoGeminiEditor(el: HTMLElement, text: string): void {
  el.focus();
  el.textContent = text;
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(
    new InputEvent("input", {
      bubbles: true,
      inputType: "insertText",
    })
  );
}

/**
 * Extract conversation history from the Gemini DOM.
 */
function getConversationHistoryFromDOM(): Message[] {
  type RawMsg = { el: HTMLElement; role: "user" | "assistant" };
  const raw: RawMsg[] = [];

  const userEls = Array.from(
    document.querySelectorAll<HTMLElement>(
      "div.user-query-text-line, div.user-query-text, .query-text, [data-role='user']"
    )
  );
  const assistantEls = Array.from(
    document.querySelectorAll<HTMLElement>(
      "message-content p, .response-content, model-response p, [data-role='model']"
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

  // Fallback: generic turn containers
  const fallbackEls = Array.from(
    document.querySelectorAll<HTMLElement>(
      "message-content, .conversation-turn, .chat-turn"
    )
  );
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

    // Gemini rich-textarea p element — use specialized injection
    insertIntoGeminiEditor(el, text);
  },

  getButtonAnchor(): HTMLElement | null {
    const input = this.getPromptElement();
    if (!input) return null;

    // Primary: find the trailing-actions div which is a SIBLING of rich-textarea
    // (not a child), containing the Fast dropdown and mic button.
    const richTextarea = input.closest("rich-textarea") as HTMLElement;
    const parent = richTextarea?.parentElement;
    if (parent) {
      const trailingActions =
        parent.querySelector<HTMLElement>('[class*="trailing-actions"]') ??
        parent.querySelector<HTMLElement>('[class*="trailing"]') ??
        parent.querySelector<HTMLElement>('div:has(button[aria-label*="Fast" i])') ??
        parent.querySelector<HTMLElement>('div:has(button[aria-label*="model" i])');
      if (trailingActions && trailingActions !== parent) {
        trailingActions.setAttribute("data-clairity-inject", "prepend");
        return trailingActions;
      }
    }

    // Fallback: return rich-textarea or input
    if (richTextarea) return richTextarea;
    return input;
  },

  getConversationHistory(): Message[] {
    return getConversationHistoryFromDOM();
  },

  destroy(): void {
    // Stateless — nothing to clean up
  },
};
