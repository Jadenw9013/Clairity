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
    // Clear container safely
    container.textContent = "";

    if (risk.risk_score === 0 && risk.risk_level === "low") {
        return;
    }

    const wrapper = document.createElement("div");
    wrapper.className = "cl-risk-badge";
    wrapper.setAttribute("aria-live", "polite");

    const label = document.createElement("div");
    label.className = "cl-risk-label";
    label.style.color = getRiskColor(risk.risk_level);
    label.style.fontWeight = "bold";
    label.textContent = `Accuracy risk: ${risk.risk_level.charAt(0).toUpperCase() + risk.risk_level.slice(1)}`;
    wrapper.appendChild(label);

    if (mode === "advanced") {
        if (risk.risk_factors.length > 0) {
            const list = document.createElement("ul");
            list.className = "cl-risk-reasons";
            risk.risk_factors.forEach((f) => {
                const item = document.createElement("li");
                item.textContent = f.description;
                list.appendChild(item);
            });
            wrapper.appendChild(list);
        }

        if (risk.recommended_guardrails.length > 0) {
            const guardrail = document.createElement("div");
            guardrail.className = "cl-risk-guardrail";
            const strong = document.createElement("strong");
            strong.textContent = "Add-on idea: ";
            guardrail.appendChild(strong);
            guardrail.appendChild(document.createTextNode(risk.recommended_guardrails[0] || ""));
            wrapper.appendChild(guardrail);
        }
    }

    container.appendChild(wrapper);
}
