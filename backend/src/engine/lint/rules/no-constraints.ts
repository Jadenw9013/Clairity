import type { Diagnostic } from "shared/types/quality.js";

const CONSTRAINT_KEYWORDS = /\b(limit|maximum|minimum|at most|at least|no more than|fewer than|within|between|only|exactly|must not|should not|avoid|exclude|constraint|restrict|boundary|scope|range)\b/i;

/** Flags prompts that have no boundaries or constraints */
export function noConstraints(prompt: string): Diagnostic | null {
    if (CONSTRAINT_KEYWORDS.test(prompt)) return null;

    return {
        id: "no-constraints",
        severity: "warning",
        message: "Your prompt doesn't set any boundaries or limits on the response.",
        suggestion: "Adding constraints like word count, scope, or what to exclude helps get more focused answers.",
    };
}
