import type { Diagnostic } from "shared/types/quality.js";

const FORMAT_KEYWORDS = /\b(format|output|list|table|json|csv|bullet|step[- ]by[- ]step|paragraph|markdown|code block|numbered)\b/i;

/** Flags prompts that lack explicit output format instructions */
export function noOutputFormat(prompt: string): Diagnostic | null {
    if (FORMAT_KEYWORDS.test(prompt)) return null;

    return {
        id: "no-output-format",
        severity: "info",
        message: "Your prompt doesn't specify a preferred output format.",
        suggestion: "Consider adding how you'd like the answer formatted, such as a list, table, or step-by-step guide.",
    };
}
