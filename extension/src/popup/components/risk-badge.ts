// Risk Badge Component
import type { RiskAssessment } from "shared/types/quality.js";

function getRiskColor(level: string): string {
    if (level === "low") return "#047857"; // dark green (WCAG AA pass)
    if (level === "medium") return "#b45309"; // dark amber (WCAG AA pass)
    return "#b91c1c"; // dark red (WCAG AA pass)
}

export function renderRiskBadge(
    container: HTMLDivElement,
    risk: RiskAssessment,
    mode: "simple" | "advanced"
) {
    if (risk.risk_score === 0 && risk.risk_level === "low") {
        container.innerHTML = "";
        return;
    }

    // Advanced mode shows guardrail and reasons
    const reasonsHTML = mode === "advanced" && risk.risk_factors.length > 0
        ? `<ul class="risk-reasons">${risk.risk_factors.map(f => `<li>${f.description}</li>`).join("")}</ul>`
        : "";

    const guardrailHTML = mode === "advanced" && risk.recommended_guardrails.length > 0
        ? `<div class="risk-guardrail"><strong>Add-on idea:</strong> ${risk.recommended_guardrails[0]}</div>`
        : "";

    container.innerHTML = `
        <div class="risk-badge" aria-live="polite">
            <div class="risk-label" style="color: ${getRiskColor(risk.risk_level)}; font-weight: bold;">
                Accuracy risk: ${risk.risk_level.charAt(0).toUpperCase() + risk.risk_level.slice(1)}
            </div>
            ${reasonsHTML}
            ${guardrailHTML}
        </div>
    `;
}
