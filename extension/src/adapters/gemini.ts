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

// ---------------------------------------------------------------------------
// Injection strategies — one per host environment
// ---------------------------------------------------------------------------

/**
 * gemini.google.com: full Gemini app with toolbox-drawer, leading/trailing
 * action wrappers. Inject after the Tools button (toolbox-drawer).
 */
function getGeminiDirectAnchor(adapter: { getPromptElement(): HTMLElement | null }): HTMLElement | null {
  // Primary: toolbox-drawer (Tools button) → afterend injection
  const toolboxDrawer = document.querySelector<HTMLElement>("toolbox-drawer");
  if (toolboxDrawer) return toolboxDrawer;

  // Fallback 1: upload (+) button container
  const uploaderContainer = document.querySelector<HTMLElement>(
    ".uploader-button-container"
  );
  if (uploaderContainer) return uploaderContainer;

  // Fallback 2: leading-actions-wrapper row → prepend
  const leadingActions = document.querySelector<HTMLElement>(
    ".leading-actions-wrapper"
  );
  if (leadingActions) {
    leadingActions.setAttribute("data-clairity-inject", "prepend");
    return leadingActions;
  }

  // Fallback 3: rich-textarea or input
  const input = adapter.getPromptElement();
  const richTextarea = input?.closest("rich-textarea") as HTMLElement | null;
  return richTextarea ?? input ?? null;
}

/**
 * google.com AI Mode (search?udm=50): simpler toolbar with just + and mic.
 * No toolbox-drawer or leading/trailing wrappers exist here.
 * Inject after the + button ("More input options").
 */
function getGoogleAIModeAnchor(adapter: { getPromptElement(): HTMLElement | null }): HTMLElement | null {
  // Primary: find the + button by aria-label → afterend injection
  const plusBtn = document.querySelector<HTMLElement>(
    'button[aria-label="More input options"]'
  );
  if (plusBtn) return plusBtn;

  // Fallback 1: find any button in the toolbar row that's not Submit/Mic
  const textarea = adapter.getPromptElement();
  if (textarea) {
    const form = textarea.closest("form");
    const container = form ?? textarea.parentElement?.parentElement;
    if (container) {
      const firstBtn = container.querySelector<HTMLElement>(
        'button:not([aria-label*="Submit" i]):not([aria-label*="Microphone" i])'
      );
      if (firstBtn) return firstBtn;
    }
  }

  // Fallback 2: textarea parent (absolute fallback)
  return textarea?.parentElement ?? textarea ?? null;
}

export const geminiAdapter: SiteAdapter = {
  id: "gemini",
  name: "Gemini",
  urlPattern: /^https:\/\/(gemini\.google\.com|www\.google\.com\/search|google\.com)/,

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
    const hostname = window.location.hostname;

    // ── gemini.google.com — full Gemini app with toolbar ──────────────
    if (hostname === "gemini.google.com") {
      return getGeminiDirectAnchor(this);
    }

    // ── google.com AI Mode (search?udm=50) — simpler toolbar ─────────
    if (hostname === "www.google.com" || hostname === "google.com") {
      return getGoogleAIModeAnchor(this);
    }

    // Unknown host matched by detect() — generic fallback
    const input = this.getPromptElement();
    return input?.parentElement ?? input ?? null;
  },

  getConversationHistory(): Message[] {
    return getConversationHistoryFromDOM();
  },

  isGenerating(): boolean {
    return !!(
      document.querySelector('button[aria-label*="Stop" i]') ??
      document.querySelector('.stop-button') ??
      document.querySelector('[mattooltip*="Stop" i]')
    );
  },

  destroy(): void {
    // Stateless — nothing to clean up
  },
};
