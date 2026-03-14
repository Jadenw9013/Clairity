import type { Diagnostic, RiskAssessment, RiskOptions, RiskLevel } from "shared/types/quality.js";
import { evaluateSignals } from "./signals.js";

/** Classify a numeric risk score into a risk level */
function classifyLevel(score: number): RiskLevel {
    if (score >= 60) return "high";
    if (score >= 30) return "medium";
    return "low";
}

/** Compute risk assessment for a prompt */
export function risk(prompt: string, options?: RiskOptions): RiskAssessment {
    const safePrompt = prompt.length > 50000 ? prompt.substring(0, 50000) : prompt;
    const factors = evaluateSignals(safePrompt);

    // Add cross-signal points from lint diagnostics if provided
    if (options?.diagnostics) {
        const hasAmbiguous = options.diagnostics.some((d: Diagnostic) => d.id === "ambiguous-pronoun");
        if (hasAmbiguous) {
            factors.push({
                signal: "ambiguous-referent",
                points: 5,
                description: "Contains unclear references that could lead to misinterpretation.",
                guardrail: "Replace vague pronouns like 'it' or 'this' with the specific thing you mean.",
            });
        }

        const hasNoConstraints = options.diagnostics.some((d: Diagnostic) => d.id === "no-constraints");
        if (hasNoConstraints) {
            factors.push({
                signal: "unconstrained-output",
                points: 10,
                description: "No limits on the response, which may produce overly broad answers.",
                guardrail: "Add boundaries such as word count, scope, or specific topics to focus on.",
            });
        }
    }

    const rawScore = factors.reduce((sum, f) => sum + f.points, 0);
    const risk_score = Math.min(100, rawScore);
    const risk_level = classifyLevel(risk_score);
    const recommended_guardrails = [...new Set(factors.map((f) => f.guardrail))];

    return { risk_score, risk_level, risk_factors: factors, recommended_guardrails };
}
