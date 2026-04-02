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

// ---------------------------------------------------------------------------
// Injection strategies — one per host environment
// ---------------------------------------------------------------------------

/**
 * copilot.microsoft.com / bing.com/chat: place Clairity to the LEFT of
 * the voice button on the right side of the toolbar.
 * Uses the "Smart" dropdown as a landmark to find the toolbar row,
 * then targets the last button in that row (voice/waveform).
 */
function getCopilotDirectAnchor(input: HTMLElement): HTMLElement | null {
  // Find the "Smart" dropdown — a reliable landmark on copilot.microsoft.com
  const smartBtn =
    document.querySelector<HTMLElement>('button[aria-label*="Smart" i]') ??
    document.querySelector<HTMLElement>('button[aria-label*="model" i]');

  if (smartBtn) {
    // Walk up from Smart to find the toolbar row, then get the last button
    let row = smartBtn.parentElement;
    for (let i = 0; i < 4 && row; i++) {
      const buttons = row.querySelectorAll<HTMLElement>("button");
      if (buttons.length >= 3) {
        // Row with 3+ buttons (at least: +, Smart, voice) → last is the voice btn
        const lastBtn = buttons[buttons.length - 1];
        if (lastBtn) {
          // If the voice button is wrapped in a single-child container,
          // target that container so they sit side-by-side in the flex row
          const wrapper = lastBtn.parentElement;
          const target = (wrapper && wrapper !== row && wrapper.children.length <= 2)
            ? wrapper : lastBtn;
          target.setAttribute("data-clairity-inject", "beforebegin");
          return target;
        }
      }
      row = row.parentElement;
    }

    // If we found Smart but couldn't locate the row, inject after Smart
    return smartBtn;
  }

  // No Smart button found — try generic right-side anchor
  const rightAnchor = findRightSideAnchor(input);
  if (rightAnchor) {
    rightAnchor.setAttribute("data-clairity-inject", "beforebegin");
    return rightAnchor;
  }

  return input.parentElement;
}

/**
 * m365.cloud.microsoft / outlook.cloud.microsoft: place Clairity to the
 * LEFT of the right-most button (mic) in the toolbar.
 */
function getM365CopilotAnchor(input: HTMLElement): HTMLElement | null {
  const rightAnchor = findRightSideAnchor(input);
  if (rightAnchor) {
    rightAnchor.setAttribute("data-clairity-inject", "beforebegin");
    return rightAnchor;
  }

  return input.parentElement;
}

/**
 * Find the right-side anchor button (voice/mic/submit) in the toolbar.
 * Uses two strategies:
 *  1. Aria-label matching for common mic/voice/audio labels
 *  2. Structural: last button in the input's ancestor container
 */
function findRightSideAnchor(input: HTMLElement): HTMLElement | null {
  // Strategy 1: direct label search (broad set of patterns)
  const byLabel =
    document.querySelector<HTMLElement>('button[aria-label*="Microphone" i]') ??
    document.querySelector<HTMLElement>('button[aria-label*="Voice" i]') ??
    document.querySelector<HTMLElement>('button[aria-label*="mic" i]') ??
    document.querySelector<HTMLElement>('button[aria-label*="speech" i]') ??
    document.querySelector<HTMLElement>('button[aria-label*="audio" i]') ??
    document.querySelector<HTMLElement>('button[aria-label*="listen" i]') ??
    document.querySelector<HTMLElement>('button[aria-label*="dictation" i]') ??
    document.querySelector<HTMLElement>('button[aria-label*="speak" i]');
  if (byLabel) return byLabel;

  // Strategy 2: structural — walk up from input to find toolbar container,
  // then target the last button (right-most in the toolbar row)
  let container: HTMLElement | null = input;
  for (let i = 0; i < 6 && container; i++) {
    container = container.parentElement;
    if (!container) break;
    const buttons = container.querySelectorAll<HTMLElement>("button");
    if (buttons.length >= 2) {
      // The last button in a container with 2+ buttons is the right-side one
      const lastBtn = buttons[buttons.length - 1];
      if (lastBtn) return lastBtn;
    }
  }

  return null;
}

export const copilotAdapter: SiteAdapter = {
  id: "copilot",
  name: "Microsoft Copilot",
  urlPattern: /^https:\/\/(copilot\.microsoft\.com|www\.copilot\.microsoft\.com|bing\.com\/chat|www\.bing\.com\/chat|m365\.cloud\.microsoft|outlook\.cloud\.microsoft)/,

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
    // Copilot uses a Lexical editor — special insertion required
    insertIntoCopilotEditor(el, text);
  },

  getButtonAnchor(): HTMLElement | null {
    const input = this.getPromptElement();
    if (!input) return null;
    const hostname = window.location.hostname;

    // ── copilot.microsoft.com — has Smart dropdown + toolbar ──────────
    if (hostname.includes("copilot.microsoft.com")) {
      return getCopilotDirectAnchor(input);
    }

    // ── m365.cloud.microsoft — simpler toolbar (+ and mic only) ──────
    if (hostname.includes("m365.cloud.microsoft") || hostname.includes("outlook.cloud.microsoft")) {
      return getM365CopilotAnchor(input);
    }

    // ── bing.com/chat — try Smart first, then + ──────────────────────
    return getCopilotDirectAnchor(input);
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
