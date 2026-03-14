import type { Diagnostic } from "shared/types/quality.js";

const NEGATION = /\b(don't|do not|never|no|not|without|avoid|exclude|isn't|aren't|won't|shouldn't|can't|cannot|must not)\b/gi;
const POSITIVE_DIRECTIVE = /\b(do|make|create|write|explain|describe|show|include|add|provide|give|use|ensure|implement)\b/i;

/** Flags prompts that only specify what NOT to do */
export function negativeOnly(prompt: string): Diagnostic | null {
    const negations = (prompt.match(NEGATION) || []).length;
    if (negations === 0) return null;
    if (POSITIVE_DIRECTIVE.test(prompt)) return null;

    return {
        id: "negative-only",
        severity: "info",
        message: "Your prompt describes what you don't want but doesn't say what you do want.",
        suggestion: "Try adding what you'd like to see in the response, not just what to avoid.",
    };
}
