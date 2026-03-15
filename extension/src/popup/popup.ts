import type { RewriteResponse, ErrorResponse } from "shared/types/index.ts";

const promptEl = document.getElementById("prompt") as HTMLTextAreaElement;
const buttonEl = document.getElementById("enhance") as HTMLButtonElement;
const resultSectionEl = document.getElementById("result-section") as HTMLDivElement;
const resultEl = document.getElementById("result") as HTMLDivElement;
const copyBtnEl = document.getElementById("copy-result") as HTMLButtonElement;
const errorEl = document.getElementById("error") as HTMLDivElement;
const siteEl = document.getElementById("site-select") as HTMLSelectElement;
const chipEl = document.getElementById("history-chip") as HTMLDivElement;
const btnTextEl = buttonEl.querySelector(".btn-text") as HTMLSpanElement;
const btnSpinnerEl = buttonEl.querySelector(".btn-spinner") as HTMLSpanElement;

// --- Display helpers ---
function showResult(data: RewriteResponse): void {
  resultEl.textContent = data.enhanced_prompt;
  resultSectionEl.classList.remove("hidden");
  errorEl.classList.add("hidden");
  document.body.classList.remove("is-loading", "is-error");
  document.body.classList.add("is-success");

  // Transparency chip
  if (chipEl) {
    chipEl.textContent =
      data.history_length === 0
        ? "✦ Enhanced · first prompt"
        : `✦ Enhanced · ${data.history_length} messages used`;
    chipEl.classList.remove("hidden");
  }
}

function showError(text: string): void {
  document.body.classList.remove("is-loading", "is-success");
  document.body.classList.add("is-error");
  errorEl.textContent = text;
  errorEl.classList.remove("hidden");
  resultSectionEl.classList.add("hidden");
}

function setLoading(loading: boolean): void {
  buttonEl.disabled = loading;
  if (loading) {
    btnTextEl.classList.add("hidden");
    btnSpinnerEl.classList.remove("hidden");
    buttonEl.setAttribute("aria-busy", "true");
    document.body.classList.add("is-loading");
    document.body.classList.remove("is-error", "is-success");
  } else {
    btnTextEl.classList.remove("hidden");
    btnSpinnerEl.classList.add("hidden");
    buttonEl.removeAttribute("aria-busy");
    document.body.classList.remove("is-loading");
  }
}

// --- Enhance handler ---
async function handleEnhance(): Promise<void> {
  const prompt = promptEl.value.trim();
  if (!prompt) {
    showError("Please enter a prompt.");
    return;
  }
  if (prompt.length > 10000) {
    showError("Prompt exceeds 10,000 character limit.");
    return;
  }

  const site = (siteEl?.value ?? "chatgpt") as "chatgpt" | "claude" | "gemini";

  setLoading(true);
  resultSectionEl.classList.add("hidden");
  errorEl.classList.add("hidden");

  const port = chrome.runtime.connect({ name: "keepalive" });

  try {
    const response = await chrome.runtime.sendMessage({
      type: "REWRITE_PROMPT",
      payload: { prompt, site, conversationId: "popup" },
    });

    if (response?.type === "REWRITE_RESULT") {
      showResult(response.payload as RewriteResponse);
    } else if (response?.type === "REWRITE_ERROR") {
      const data = response.payload as ErrorResponse;
      showError(data.error);
    } else {
      showError("Unexpected response from service worker.");
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    showError(`Failed to enhance prompt: ${message}`);
  } finally {
    port.disconnect();
    setLoading(false);
  }
}

buttonEl.addEventListener("click", () => void handleEnhance());

copyBtnEl?.addEventListener("click", async () => {
  const text = resultEl.textContent;
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    const original = copyBtnEl.textContent;
    copyBtnEl.textContent = "Copied!";
    copyBtnEl.classList.add("copied");
    setTimeout(() => {
      copyBtnEl.textContent = original;
      copyBtnEl.classList.remove("copied");
    }, 2000);
  } catch (err) {
    console.error("Failed to copy:", err);
  }
});

promptEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    void handleEnhance();
  }
});
