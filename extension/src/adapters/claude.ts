import type { SiteAdapter, Message } from "shared/types/index.ts";

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

/**
 * Extract conversation history from the Claude DOM.
 *
 * Primary: .human-turn / .assistant-turn containers and
 *   data-testid="human-message" / data-testid="ai-message"
 * Fallback: any [data-testid*="message"] elements; infer role from
 *   class/testid value or alternate by position.
 */
function getConversationHistoryFromDOM(): Message[] {
  // Collect all turn containers in DOM order with their role
  type RawMsg = { el: HTMLElement; role: "user" | "assistant" };
  const raw: RawMsg[] = [];

  // Strategy 1: labelled turn wrappers
  const humanPrimary = Array.from(
    document.querySelectorAll<HTMLElement>(
      '.human-turn, [data-testid="human-message"]'
    )
  );
  const assistantPrimary = Array.from(
    document.querySelectorAll<HTMLElement>(
      '.assistant-turn, [data-testid="ai-message"]'
    )
  );

  if (humanPrimary.length > 0 || assistantPrimary.length > 0) {
    humanPrimary.forEach((el) => raw.push({ el, role: "user" }));
    assistantPrimary.forEach((el) => raw.push({ el, role: "assistant" }));

    // Sort by DOM position to restore interleaved order
    raw.sort((a, b) => {
      const pos = a.el.compareDocumentPosition(b.el);
      return pos & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
    });

    return raw
      .map(({ el, role }) => ({ role, content: el.textContent?.trim() ?? "" }))
      .filter((m) => m.content.length > 0)
      .slice(-MAX_HISTORY);
  }

  // Fallback: any testid with "message", infer role from testid/class
  const fallback = Array.from(
    document.querySelectorAll<HTMLElement>('[data-testid*="message"]')
  );
  if (fallback.length > 0) {
    return fallback
      .map((el, i) => {
        const testid = el.getAttribute("data-testid") ?? "";
        const cls = el.className ?? "";
        let role: "user" | "assistant";
        if (testid.includes("human") || cls.includes("human")) {
          role = "user";
        } else if (testid.includes("ai") || testid.includes("assistant") || cls.includes("assistant")) {
          role = "assistant";
        } else {
          // Alternate by DOM order as last resort
          role = i % 2 === 0 ? "user" : "assistant";
        }
        return { role, content: el.textContent?.trim() ?? "" };
      })
      .filter((m) => m.content.length > 0)
      .slice(-MAX_HISTORY);
  }

  return [];
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

  getConversationHistory(): Message[] {
    return getConversationHistoryFromDOM();
  },

  destroy(): void {
    // Stateless — nothing to clean up
  },
};
