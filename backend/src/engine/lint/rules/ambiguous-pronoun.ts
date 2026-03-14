import type { Diagnostic } from "shared/types/quality.js";

const DANGLING_PRONOUN = /\b(it|this|that|these|those|they)\b/i;
const CONTEXT_CLUE = /\b(the\s+\w+|my\s+\w+|our\s+\w+|following|above|below|mentioned|described|attached)\b/i;

/** Flags prompts with ambiguous pronouns lacking clear referents */
export function ambiguousPronoun(prompt: string): Diagnostic | null {
    const sentences = prompt.split(/[.!?]+/).filter((s) => s.trim().length > 0);
    if (sentences.length <= 1) return null;

    const firstSentence = sentences[0]!;
    if (!DANGLING_PRONOUN.test(firstSentence)) return null;
    if (CONTEXT_CLUE.test(firstSentence)) return null;

    return {
        id: "ambiguous-pronoun",
        severity: "info",
        message: "Your prompt starts with a pronoun like \"it\" or \"this\" without making clear what it refers to.",
        suggestion: "Replace the pronoun with the specific thing you're referring to.",
    };
}
