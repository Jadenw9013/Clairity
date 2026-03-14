/**
 * Prompt Quality Engine — Public API
 *
 * Deterministic, pure-function analysis of user prompts.
 * No LLM calls, no external dependencies, no side effects.
 */

export { lint } from "./lint/runner.js";
export { risk } from "./risk/scorer.js";

import type { IntentResult } from "shared/types/quality.js";
import { detectIntent } from "./intent/detector.js";
import { generateQuestions } from "./intent/questions.js";

/** Detect prompt intent with confidence and optional clarifying questions */
export function intent(prompt: string): IntentResult {
    const { intent: detectedIntent, score: confidence } = detectIntent(prompt);
    const clarifying_questions = confidence < 60 ? generateQuestions(detectedIntent) : [];

    return {
        intent: detectedIntent,
        confidence,
        clarifying_questions,
    };
}
