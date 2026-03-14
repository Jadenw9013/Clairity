import type { Diagnostic, LintOptions, LintResult } from "shared/types/quality.js";

import { vaguePrompt } from "./rules/vague-prompt.js";
import { noOutputFormat } from "./rules/no-output-format.js";
import { noConstraints } from "./rules/no-constraints.js";
import { ambiguousPronoun } from "./rules/ambiguous-pronoun.js";
import { missingContext } from "./rules/missing-context.js";
import { multipleQuestions } from "./rules/multiple-questions.js";
import { negativeOnly } from "./rules/negative-only.js";
import { wallOfText } from "./rules/wall-of-text.js";
import { missingLanguage } from "./rules/missing-language.js";
import { conflictingInstructions } from "./rules/conflicting-instructions.js";

type LintRule = (prompt: string) => Diagnostic | null;

/** All registered lint rules */
const ALL_RULES: LintRule[] = [
    vaguePrompt,
    noOutputFormat,
    noConstraints,
    ambiguousPronoun,
    missingContext,
    multipleQuestions,
    negativeOnly,
    wallOfText,
    missingLanguage,
    conflictingInstructions,
];

const SEVERITY_PENALTY: Record<string, number> = {
    error: 20,
    warning: 10,
    info: 5,
};

/** Run all lint rules against a prompt and return diagnostics + quality score */
export function lint(prompt: string, options?: LintOptions): LintResult {
    const safePrompt = prompt.length > 50000 ? prompt.substring(0, 50000) : prompt;
    const disabled = new Set(options?.disabledRules ?? []);

    const diagnostics: Diagnostic[] = [];
    for (const rule of ALL_RULES) {
        const result = rule(safePrompt);
        if (result && !disabled.has(result.id)) {
            diagnostics.push(result);
        }
    }

    const totalPenalty = diagnostics.reduce(
        (sum, d) => sum + (SEVERITY_PENALTY[d.severity] ?? 0),
        0,
    );
    const quality_score = Math.max(0, 100 - totalPenalty);

    return { diagnostics, quality_score };
}
