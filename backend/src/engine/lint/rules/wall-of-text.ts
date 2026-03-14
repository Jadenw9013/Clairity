import type { Diagnostic } from "shared/types/quality.js";

const MIN_LENGTH = 500;

/** Flags long prompts with no structural breaks */
export function wallOfText(prompt: string): Diagnostic | null {
    if (prompt.length < MIN_LENGTH) return null;

    const hasLineBreaks = /\n\s*\n/.test(prompt);
    const hasBullets = /^[\s]*[-*•\d.]+\s/m.test(prompt);
    const hasHeaders = /^#+\s/m.test(prompt);

    if (hasLineBreaks || hasBullets || hasHeaders) return null;

    return {
        id: "wall-of-text",
        severity: "warning",
        message: "Your prompt is a long block of text without any structure.",
        suggestion: "Break it into sections with line breaks, bullet points, or numbered steps for clearer results.",
    };
}
