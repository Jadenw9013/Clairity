import type { Diagnostic } from "shared/types/quality.js";

const CONTEXT_KEYWORDS = /\b(for|audience|beginner|expert|professional|student|developer|manager|team|role|persona|domain|field|industry|background|experience level|target)\b/i;

/** Flags prompts that lack domain or audience context */
export function missingContext(prompt: string): Diagnostic | null {
    if (CONTEXT_KEYWORDS.test(prompt)) return null;

    return {
        id: "missing-context",
        severity: "warning",
        message: "Your prompt doesn't mention who the answer is for or what field it's about.",
        suggestion: "Try specifying the intended audience or domain, such as 'for a beginner' or 'in the context of web development'.",
    };
}
