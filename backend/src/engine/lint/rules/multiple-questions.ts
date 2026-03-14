import type { Diagnostic } from "shared/types/quality.js";

/** Flags prompts containing multiple distinct questions */
export function multipleQuestions(prompt: string): Diagnostic | null {
    const questionMarks = (prompt.match(/\?/g) || []).length;
    if (questionMarks <= 1) return null;

    return {
        id: "multiple-questions",
        severity: "info",
        message: `Your prompt contains ${questionMarks} questions. Multiple questions may lead to incomplete answers.`,
        suggestion: "Consider breaking this into separate prompts, or clearly number each question.",
    };
}
