import type { Diagnostic } from "shared/types/quality.js";

const CODING_KEYWORDS = /\b(code|function|script|program|implement|debug|fix|refactor|api|endpoint|class|method|algorithm|regex|database|query|deploy)\b/i;
const LANGUAGE_KEYWORDS = /\b(javascript|typescript|python|java|c\+\+|c#|ruby|go|rust|swift|kotlin|php|sql|html|css|bash|shell|perl|scala|r\b|dart|lua|elixir|haskell)\b/i;

/** Flags coding prompts that don't specify a programming language */
export function missingLanguage(prompt: string): Diagnostic | null {
    if (!CODING_KEYWORDS.test(prompt)) return null;
    if (LANGUAGE_KEYWORDS.test(prompt)) return null;

    return {
        id: "missing-language",
        severity: "info",
        message: "This looks like a coding request but doesn't mention a programming language.",
        suggestion: "Specify which language or framework you'd like the code written in.",
    };
}
