import type { Diagnostic } from "shared/types/quality.js";

/** Flags prompts with fewer than 15 words as under-specified */
export function vaguePrompt(prompt: string): Diagnostic | null {
    const wordCount = prompt.trim().split(/\s+/).filter(Boolean).length;
    if (wordCount >= 15) return null;

    return {
        id: "vague-prompt",
        severity: "warning",
        message: "Your prompt is quite short and may not give enough detail for a good answer.",
        suggestion: "Try adding more specifics about what you need, such as the topic, audience, or desired outcome.",
    };
}
