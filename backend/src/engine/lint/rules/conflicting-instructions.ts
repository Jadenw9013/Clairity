import type { Diagnostic } from "shared/types/quality.js";

const ANTONYM_PAIRS: [RegExp, RegExp][] = [
    [/\b(short|brief|concise)\b/i, /\b(detailed|comprehensive|thorough|in[- ]depth)\b/i],
    [/\b(simple|basic)\b/i, /\b(advanced|complex|sophisticated)\b/i],
    [/\b(formal)\b/i, /\b(casual|informal|conversational)\b/i],
    [/\b(technical)\b/i, /\b(non[- ]technical|simple|plain[- ]language)\b/i],
    [/\b(include)\b/i, /\b(exclude|omit|skip)\b/i],
];

/** Flags prompts with contradictory directives */
export function conflictingInstructions(prompt: string): Diagnostic | null {
    for (const [a, b] of ANTONYM_PAIRS) {
        if (a.test(prompt) && b.test(prompt)) {
            return {
                id: "conflicting-instructions",
                severity: "warning",
                message: "Your prompt seems to ask for opposite things at the same time.",
                suggestion: "Check for conflicting terms and clarify which direction you prefer.",
            };
        }
    }
    return null;
}
