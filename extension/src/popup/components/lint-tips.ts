// Lint Tips Component
import type { Diagnostic } from "shared/types/quality.js";

// Non-technical language transforms
function getFriendlyTip(d: Diagnostic): string {
    if (d.id === "vague-prompt") return "Your question relies on details that are missing (e.g., domain or audience). Adding those helps!";
    if (d.suggestion) return d.suggestion;
    return d.message;
}

export function renderLintTips(
    container: HTMLDivElement,
    diagnostics: Diagnostic[],
    mode: "simple" | "advanced"
) {
    if (diagnostics.length === 0) {
        container.innerHTML = "";
        return;
    }

    const maxTips = mode === "simple" ? 1 : 3;
    const tipsToShow = diagnostics.slice(0, maxTips);

    container.innerHTML = `
        <div class="lint-tips" aria-live="polite">
            <h4>Tips to improve:</h4>
            <ul>
                ${tipsToShow.map(t => `<li>${getFriendlyTip(t)}</li>`).join("")}
            </ul>
        </div>
    `;
}
