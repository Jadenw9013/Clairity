import type { SiteAdapter, ConversationBrief } from "shared/types/index.ts";
import type { RewriteResponse, ErrorResponse, Site } from "shared/types/index.ts";
// @ts-ignore
import tokensCss from "../styles/tokens.css?inline";
// @ts-ignore
import panelCss from "./panel.css?inline";

const BUTTON_ID = "clairity-enhance-root";
const CARD_ID = "clairity-preview-card";

function getConversationId(): string {
  try {
    const url = new URL(window.location.href);
    return url.origin + url.pathname;
  } catch {
    return "default";
  }
}

/** Remove the floating preview card if it exists */
function dismissCard(): void {
  const existing = document.getElementById(CARD_ID);
  existing?.remove();
}

/**
 * Show the bottom-right preview card with the enhanced prompt.
 * "Use this prompt" injects into the textarea. "Copy" copies to clipboard.
 * When brief is provided (STATE 2/3), chip is clickable and shows brief panel.
 */
function showPreviewCard(
  enhancedPrompt: string,
  historyLength: number,
  adapter: SiteAdapter,
  brief?: ConversationBrief,
  originalPrompt?: string
): void {
  dismissCard();

  const card = document.createElement("div");
  card.id = CARD_ID;
  card.setAttribute("data-clairity-card", "true");

  const shadow = card.attachShadow({ mode: "open" });

  const style = document.createElement("style");
  style.textContent = tokensCss + "\n" + panelCss;
  shadow.appendChild(style);

  // Card root
  const root = document.createElement("div");
  root.className = "cl-card-root";
  shadow.appendChild(root);

  // Header row
  const header = document.createElement("div");
  header.className = "cl-card-header";

  const title = document.createElement("span");
  title.className = "cl-card-title";
  title.innerHTML = `<span class="cl-star">✦</span> Enhanced by Clairity`;

  const closeBtn = document.createElement("button");
  closeBtn.className = "cl-card-close";
  closeBtn.textContent = "✕";
  closeBtn.setAttribute("aria-label", "Close");
  closeBtn.addEventListener("click", dismissCard);

  header.appendChild(title);
  header.appendChild(closeBtn);
  root.appendChild(header);

  // Chip — STATE 1: plain, STATE 2/3: clickable brief chip
  const chip = document.createElement("div");
  if (brief) {
    chip.className = "cl-card-chip cl-brief-chip";
    chip.textContent = "✦ conversation brief active";
    chip.setAttribute("role", "button");
    chip.setAttribute("aria-label", "View conversation brief");
    chip.setAttribute("tabindex", "0");

    // Build expandable brief panel (hidden by default)
    const briefPanel = document.createElement("div");
    briefPanel.className = "cl-brief-panel";
    briefPanel.hidden = true;

    const briefContent = [
      brief.goal ? `<div class="cl-brief-section"><strong>Goal</strong><p>${brief.goal}</p></div>` : "",
      brief.activeTopic ? `<div class="cl-brief-section"><strong>Topic</strong><p>${brief.activeTopic}</p></div>` : "",
      brief.establishedContext.length > 0
        ? `<div class="cl-brief-section"><strong>Context</strong><ul>${brief.establishedContext.map((c) => `<li>${c}</li>`).join("")}</ul></div>`
        : "",
      brief.avoid.length > 0
        ? `<div class="cl-brief-section"><strong>Not repeating</strong><ul>${brief.avoid.map((a) => `<li>${a}</li>`).join("")}</ul></div>`
        : "",
    ].filter(Boolean).join("");

    briefPanel.innerHTML = briefContent;

    const closePanelBtn = document.createElement("button");
    closePanelBtn.className = "cl-brief-close";
    closePanelBtn.textContent = "✕ Close brief";
    closePanelBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      briefPanel.hidden = true;
      chip.textContent = "✦ conversation brief active";
    });
    briefPanel.appendChild(closePanelBtn);

    // Toggle panel on chip click
    const togglePanel = () => {
      briefPanel.hidden = !briefPanel.hidden;
      chip.textContent = briefPanel.hidden
        ? "✦ conversation brief active"
        : "✦ conversation brief ▲";
    };
    chip.addEventListener("click", togglePanel);
    chip.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); togglePanel(); }
    });

    root.appendChild(chip);
    root.appendChild(briefPanel);
  } else {
    chip.className = "cl-card-chip";
    chip.textContent = historyLength === 0
      ? "✦ first prompt"
      : `✦ ${historyLength} messages used`;
    root.appendChild(chip);
  }

  // Enhanced prompt preview
  const preview = document.createElement("div");
  preview.className = "cl-card-preview";
  preview.textContent = enhancedPrompt;
  root.appendChild(preview);

  // Hint when enhanced prompt is nearly identical to original
  if (originalPrompt) {
    const norm = (s: string) => s.trim().toLowerCase();
    if (norm(originalPrompt) === norm(enhancedPrompt)) {
      const hint = document.createElement("div");
      hint.className = "cl-vague-hint";
      hint.textContent = "✦ Tip: add more context for a better optimization";
      root.appendChild(hint);
    }
  }

  // Actions
  const actions = document.createElement("div");
  actions.className = "cl-card-actions";

  const useBtn = document.createElement("button");
  useBtn.className = "cl-btn-use";
  useBtn.innerHTML = `<span class="cl-star">✦</span> Use this prompt`;

  /** Inject the enhanced prompt into the chat input */
  const doInject = () => {
    adapter.setPromptText(enhancedPrompt);
    const el = adapter.getPromptElement();
    if (el) {
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      if ("focus" in el) (el as HTMLElement).focus();
    }
  };

  useBtn.addEventListener("click", () => {
    if (adapter.isGenerating()) {
      // Queued state — wait for AI to finish generating
      useBtn.disabled = true;
      useBtn.classList.add("is-queued");
      useBtn.innerHTML = `<span class="cl-spinner-sm"></span> Queued — waiting for AI`;

      // Add hint below actions
      const queueHint = document.createElement("div");
      queueHint.className = "cl-queue-hint";
      queueHint.textContent = "Will inject automatically when ready";
      root.appendChild(queueHint);

      const pollInterval = setInterval(() => {
        if (!adapter.isGenerating()) {
          clearInterval(pollInterval);
          clearTimeout(pollTimeout);
          doInject();
          // Flash injected state then dismiss
          useBtn.innerHTML = `<span class="cl-star">✦</span> Injected`;
          useBtn.classList.remove("is-queued");
          useBtn.classList.add("is-injected");
          queueHint.remove();
          setTimeout(dismissCard, 1500);
        }
      }, 500);

      const pollTimeout = setTimeout(() => {
        clearInterval(pollInterval);
        // Timed out — re-enable manual injection
        useBtn.disabled = false;
        useBtn.classList.remove("is-queued");
        useBtn.classList.add("is-timed-out");
        useBtn.innerHTML = `<span class="cl-star">✦</span> AI took too long — click to inject`;
        queueHint.remove();
        // Re-bind to direct inject on next click
        useBtn.addEventListener("click", () => {
          doInject();
          dismissCard();
        }, { once: true });
      }, 60_000);

    } else {
      // Normal path — inject immediately
      doInject();
      dismissCard();
    }
  });

  const copyBtn = document.createElement("button");
  copyBtn.className = "cl-btn-copy";
  copyBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy`;
  copyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(enhancedPrompt);
      copyBtn.textContent = "Copied!";
      copyBtn.classList.add("is-copied");
      setTimeout(() => {
        copyBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2-2v1"/></svg> Copy`;
        copyBtn.classList.remove("is-copied");
      }, 2000);
    } catch { /* ignore */ }
  });

  actions.appendChild(useBtn);
  actions.appendChild(copyBtn);
  root.appendChild(actions);

  document.body.appendChild(card);

  // Close on Escape
  const escHandler = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      dismissCard();
      document.removeEventListener("keydown", escHandler);
    }
  };
  document.addEventListener("keydown", escHandler);

  // Auto-dismiss after 90 seconds
  setTimeout(dismissCard, 90_000);
}

/** Show the error state inside a small card */
function showErrorCard(message: string): void {
  dismissCard();

  const card = document.createElement("div");
  card.id = CARD_ID;
  const shadow = card.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = tokensCss + "\n" + panelCss;
  shadow.appendChild(style);

  const root = document.createElement("div");
  root.className = "cl-card-root cl-card-error";

  const header = document.createElement("div");
  header.className = "cl-card-header";
  header.innerHTML = `<span>⚠ Clairity error</span>`;

  const closeBtn = document.createElement("button");
  closeBtn.className = "cl-card-close";
  closeBtn.textContent = "✕";
  closeBtn.addEventListener("click", dismissCard);
  header.appendChild(closeBtn);

  const body = document.createElement("p");
  body.className = "cl-error-msg";
  body.textContent = message;

  root.appendChild(header);
  root.appendChild(body);
  shadow.appendChild(root);
  document.body.appendChild(card);

  setTimeout(dismissCard, 6_000);
}

export function injectEnhanceButton(
  adapter: SiteAdapter,
  anchor: HTMLElement
): void {
  if (document.getElementById(BUTTON_ID)) return;

  const host = document.createElement("div");
  host.id = BUTTON_ID;
  host.style.cssText = "display:inline-flex;align-items:center;margin:0 4px;";

  const shadow = host.attachShadow({ mode: "open" });

  const style = document.createElement("style");
  style.textContent = tokensCss + "\n" + panelCss;
  shadow.appendChild(style);

  // White pill button matching the reference design
  const btn = document.createElement("button");
  btn.className = "cl-trigger-pill";
  btn.innerHTML = `<span class="cl-trigger-icon">✦</span><span class="cl-trigger-label">Enhance Request</span>`;
  btn.setAttribute("aria-label", "Enhance prompt with Clairity");
  btn.type = "button";
  shadow.appendChild(btn);

  const setLoading = (loading: boolean) => {
    btn.disabled = loading;
    if (loading) {
      btn.innerHTML = `<span class="cl-spinner-sm"></span><span class="cl-trigger-label">Enhancing…</span>`;
      btn.classList.add("is-loading");
    } else {
      btn.innerHTML = `<span class="cl-trigger-icon">✦</span><span class="cl-trigger-label">Enhance Request</span>`;
      btn.classList.remove("is-loading");
    }
  };

  btn.addEventListener("click", async () => {
    const prompt = adapter.getPromptText().trim();
    if (!prompt) return;

    const conversationId = getConversationId();

    // Extract DOM history — most accurate source; dedup by trimmed content
    const domHistory = adapter.getConversationHistory();
    const seen = new Set<string>();
    const history = domHistory.filter((m) => {
      const key = `${m.role}:${m.content.trim()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return m.content.trim().length > 0;
    });

    setLoading(true);


    try {
      if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) {
        showErrorCard("Extension context lost — please reload the page.");
        return;
      }

      const response = await chrome.runtime.sendMessage({
        type: "REWRITE_PROMPT",
        payload: { prompt, site: adapter.id as Site, history, conversationId },
      });

      if (chrome.runtime.lastError) {
        console.warn("[Clairity]", chrome.runtime.lastError.message);
        showErrorCard("Extension error — try reloading the page.");
        return;
      }

      if (!response) {
        showErrorCard("No response from service worker — try reloading the extension.");
      } else if (response.type === "REWRITE_RESULT") {
        const data = response.payload as RewriteResponse & { briefActive: boolean; brief?: ConversationBrief };
        showPreviewCard(data.enhanced_prompt, data.history_length, adapter, data.briefActive ? data.brief : undefined, prompt);
      } else if (response.type === "REWRITE_ERROR") {
        const data = response.payload as ErrorResponse;
        showErrorCard(data.error || "Unknown error from backend");
      } else {
        showErrorCard("Unexpected response format");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      showErrorCard(msg);
    } finally {
      setLoading(false);
    }
  });

  // Smart injection: supports three strategies
  // 1. Adapter explicitly wants prepend (toolbar container) via data attribute
  // 2. Adapter explicitly wants beforebegin (insert before anchor, e.g. left of mic)
  // 3. Grammarly-adjacent: insert left of Grammarly icon
  // 4. Default: insert after anchor element
  const injectMode = anchor.getAttribute("data-clairity-inject");
  if (injectMode === "prepend") {
    anchor.removeAttribute("data-clairity-inject");
    anchor.insertBefore(host, anchor.firstChild);
  } else if (injectMode === "beforebegin") {
    anchor.removeAttribute("data-clairity-inject");
    anchor.insertAdjacentElement("beforebegin", host);
  } else {
    const searchContainer = anchor.parentElement ?? anchor;
    const grammarlyEl = searchContainer.querySelector(
      'grammarly-extension, grammarly-desktop-integration, [data-grammarly-shadow-root], [id*="grammarly"]'
    );
    if (grammarlyEl && grammarlyEl.parentElement) {
      grammarlyEl.parentElement.insertBefore(host, grammarlyEl);
    } else {
      anchor.insertAdjacentElement("afterend", host);
    }
  }
}
