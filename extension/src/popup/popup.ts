import type { RewriteResponse, ErrorResponse } from "shared/types/index.ts";
import {
  MAX_PROMPT_LENGTH,
  validatePromptLength,
  collectPreset,
  scoreColor,
  debounce,
} from "./popup-logic.js";
import { initModeToggle, type Mode } from "./components/mode-toggle.js";
import { renderLintTips } from "./components/lint-tips.js";
import { renderRiskBadge } from "./components/risk-badge.js";
import type { LintResult, RiskAssessment } from "shared/types/quality.js";

// Construct path to bypass static TypeScript analysis of external workspace
const ENGINE_PATH = "../../../backend/src/engine/index.ts";
let lintEngine: any = null;
let riskEngine: any = null;
import(/* @vite-ignore */ ENGINE_PATH).then((mod) => {
  lintEngine = mod.lint;
  riskEngine = mod.risk;
}).catch(console.error);

const promptEl = document.getElementById("prompt") as HTMLTextAreaElement;
const buttonEl = document.getElementById("enhance") as HTMLButtonElement;
const resultSectionEl = document.getElementById("result-section") as HTMLDivElement;
const resultEl = document.getElementById("result") as HTMLDivElement;
const copyBtnEl = document.getElementById("copy-result") as HTMLButtonElement;
const errorEl = document.getElementById("error") as HTMLDivElement;
const charCountEl = document.getElementById("char-count") as HTMLDivElement;
const clarifyingEl = document.getElementById("clarifying") as HTMLDivElement;
const scoreClarityEl = document.getElementById("score-clarity") as HTMLDivElement;
const scoreSpecificityEl = document.getElementById("score-specificity") as HTMLDivElement;
const scoreConstraintsEl = document.getElementById("score-constraints") as HTMLDivElement;
const scoreOverallEl = document.getElementById("score-overall") as HTMLDivElement;
const btnTextEl = buttonEl.querySelector(".btn-text") as HTMLSpanElement;
const btnSpinnerEl = buttonEl.querySelector(".btn-spinner") as HTMLSpanElement;
const intentEl = document.getElementById("preset-intent") as HTMLSelectElement;
const formatEl = document.getElementById("preset-format") as HTMLSelectElement;
const toneEl = document.getElementById("preset-tone") as HTMLSelectElement;
const contextToggleEl = document.getElementById("context-toggle") as HTMLButtonElement;
const contextSectionEl = document.getElementById("context-section") as HTMLDivElement;
const extraContextEl = document.getElementById("extra-context") as HTMLTextAreaElement;

const modeToggleContainer = document.getElementById("mode-toggle-container") as HTMLDivElement;
const lintContainer = document.getElementById("lint-container") as HTMLDivElement;
const riskContainer = document.getElementById("risk-container") as HTMLDivElement;
const qualityFillEl = document.getElementById("quality-fill") as HTMLDivElement;
const qualityLabelEl = document.getElementById("quality-label") as HTMLSpanElement;

let currentMode: Mode = "simple";

// --- Mode Initialization ---
initModeToggle(modeToggleContainer, (mode) => {
  currentMode = mode;
  document.body.setAttribute("data-mode", mode);
  btnTextEl.textContent = mode === "simple" ? "Fix my question" : "Enhance Request";
  runRealtimeAnalysis(); // re-render tips based on mode
});

// --- Real-time Analysis ---
async function runAnalysisSync() {
  const prompt = promptEl.value.trim();
  if (!prompt || !lintEngine || !riskEngine) {
    lintContainer.textContent = "";
    riskContainer.textContent = "";
    qualityFillEl.style.width = "0%";
    qualityLabelEl.textContent = "Prompt Quality";
    return;
  }

  const lintRes = lintEngine(prompt) as LintResult;
  const riskRes = riskEngine(prompt, { diagnostics: lintRes.diagnostics }) as RiskAssessment;

  renderLintTips(lintContainer, lintRes.diagnostics, currentMode);
  renderRiskBadge(riskContainer, riskRes, currentMode);

  qualityFillEl.style.width = `${lintRes.quality_score}%`;
  qualityFillEl.style.background = scoreColor(lintRes.quality_score);

  if (currentMode === "simple") {
    // Hide numerical score, just show generic label
    qualityLabelEl.textContent = "Prompt Quality";
  } else {
    qualityLabelEl.textContent = `Quality: ${lintRes.quality_score}%`;
  }
}

const runRealtimeAnalysis = debounce(runAnalysisSync, 300);

// --- Character count ---
function updateCharCount(): void {
  const len = promptEl.value.length;
  charCountEl.textContent = `${len.toLocaleString()} / ${MAX_PROMPT_LENGTH.toLocaleString()}`;
  if (len > MAX_PROMPT_LENGTH) {
    charCountEl.classList.add("over");
  } else {
    charCountEl.classList.remove("over");
  }
}

promptEl.addEventListener("input", () => {
  updateCharCount();
  runRealtimeAnalysis();
});

// --- Context toggle ---
contextToggleEl.addEventListener("click", () => {
  const expanded = contextSectionEl.classList.toggle("hidden") === false;
  contextToggleEl.setAttribute("aria-expanded", String(expanded));
  contextToggleEl.textContent = expanded ? "− Hide context" : "+ Add context";
  if (expanded) extraContextEl.focus();
});

// --- Display helpers ---
function showResult(data: RewriteResponse): void {
  resultEl.textContent = data.enhanced_prompt;
  resultSectionEl.classList.remove("hidden");
  errorEl.classList.add("hidden");

  document.body.classList.remove("is-loading", "is-error");
  document.body.classList.add("is-success");

  const { clarity, specificity, constraints, overall } = data.score;
  scoreClarityEl.style.width = `${clarity}%`;
  scoreClarityEl.style.background = scoreColor(clarity);
  scoreSpecificityEl.style.width = `${specificity}%`;
  scoreSpecificityEl.style.background = scoreColor(specificity);
  scoreConstraintsEl.style.width = `${constraints}%`;
  scoreConstraintsEl.style.background = scoreColor(constraints);
  scoreOverallEl.style.width = `${overall}%`;
  scoreOverallEl.style.background = scoreColor(overall);

  if (data.clarifying_question) {
    clarifyingEl.textContent = data.clarifying_question;
    clarifyingEl.classList.remove("hidden");
  } else {
    clarifyingEl.classList.add("hidden");
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
  const validationError = validatePromptLength(prompt);
  if (validationError) {
    showError(validationError);
    return;
  }

  setLoading(true);
  resultSectionEl.classList.add("hidden");
  errorEl.classList.add("hidden");

  const port = chrome.runtime.connect({ name: "keepalive" });

  try {
    const preset = collectPreset(intentEl, toneEl, formatEl, extraContextEl);
    const response = await chrome.runtime.sendMessage({
      type: "REWRITE_PROMPT",
      payload: { prompt, site: "chatgpt" as const, preset },
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

copyBtnEl.addEventListener("click", async () => {
  const text = resultEl.textContent;
  if (!text) return;

  try {
    await navigator.clipboard.writeText(text);
    const originalText = copyBtnEl.textContent;
    copyBtnEl.textContent = "Copied!";
    copyBtnEl.classList.add("copied");

    setTimeout(() => {
      copyBtnEl.textContent = originalText;
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

// --- Dev-only Diagnostics Panel ---
declare const __CLAIRITY_DEV__: boolean;
if (typeof __CLAIRITY_DEV__ !== "undefined" && __CLAIRITY_DEV__) {
  const diagContainer = document.createElement("div");
  diagContainer.style.cssText =
    "margin-top:12px;padding:8px;border:1px dashed #6366f1;border-radius:6px;font-size:11px;";

  const header = document.createElement("div");
  header.style.display = "flex";
  header.style.justifyContent = "space-between";
  header.style.alignItems = "center";

  const label = document.createElement("span");
  label.style.color = "#6366f1";
  label.style.fontWeight = "600";
  label.textContent = "🔧 DEV DIAGNOSTICS";

  const btn = document.createElement("button");
  btn.id = "diag-btn";
  btn.style.padding = "3px 8px";
  btn.style.fontSize = "11px";
  btn.style.cursor = "pointer";
  btn.style.border = "1px solid #6366f1";
  btn.style.borderRadius = "4px";
  btn.style.background = "#eef2ff";
  btn.style.color = "#4338ca";
  btn.textContent = "Run Diagnostics";

  header.appendChild(label);
  header.appendChild(btn);

  const output = document.createElement("pre");
  output.id = "diag-output";
  output.style.marginTop = "6px";
  output.style.whiteSpace = "pre-wrap";
  output.style.wordBreak = "break-all";
  output.style.maxHeight = "200px";
  output.style.overflowY = "auto";
  output.style.display = "none";
  output.style.background = "#f8fafc";
  output.style.padding = "6px";
  output.style.borderRadius = "4px";
  output.style.fontSize = "10px";

  diagContainer.appendChild(header);
  diagContainer.appendChild(output);
  document.body.appendChild(diagContainer);

  document.getElementById("diag-btn")!.addEventListener("click", async () => {
    const output = document.getElementById("diag-output")!;
    output.style.display = "block";
    output.textContent = "Running diagnostics...";
    try {
      const report = await chrome.runtime.sendMessage({ type: "CLAIRITY_DIAGNOSE" });
      output.textContent = JSON.stringify(report, null, 2);
    } catch (err: unknown) {
      output.textContent = `Diagnostics failed: ${err instanceof Error ? err.message : String(err)}`;
    }
  });
}

