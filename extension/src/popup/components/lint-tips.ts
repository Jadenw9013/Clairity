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
    // Clear container safely
    container.textContent = "";

    if (diagnostics.length === 0) {
        return;
    }

    const maxTips = mode === "simple" ? 1 : 3;
    const tipsToShow = diagnostics.slice(0, maxTips);

    const wrapper = document.createElement("div");
    wrapper.className = "cl-lint-tips";
    wrapper.setAttribute("aria-live", "polite");

    const header = document.createElement("h4");
    header.textContent = "Tips to improve:";
    wrapper.appendChild(header);

    const list = document.createElement("ul");
    tipsToShow.forEach((t) => {
        const item = document.createElement("li");
        item.textContent = getFriendlyTip(t);
        list.appendChild(item);
    });
    wrapper.appendChild(list);

    container.appendChild(wrapper);
}
