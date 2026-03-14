import type { PromptIntent } from "shared/types/index.js";

const INTENT_QUESTIONS: Record<PromptIntent, string[]> = {
    general: [
        "What specific topic would you like help with?",
        "Is there a particular goal or outcome you're looking for?",
        "Who is the intended audience for this response?",
    ],
    coding: [
        "Which programming language or framework should be used?",
        "Are you looking for a new implementation or fixing existing code?",
        "What is the expected input and output?",
    ],
    writing: [
        "What is the intended audience for this piece?",
        "Do you have a preferred tone (formal, casual, persuasive)?",
        "Is there a target word count or length?",
    ],
    research: [
        "How recent does the information need to be?",
        "Are you looking for a high-level overview or detailed analysis?",
        "Is there a specific aspect or angle you want to focus on?",
    ],
    career: [
        "What industry or role is this for?",
        "What is your current experience level?",
        "Is this for a specific company or a general application?",
    ],
};

/** Generate up to 3 clarifying questions based on intent */
export function generateQuestions(intent: PromptIntent): string[] {
    return INTENT_QUESTIONS[intent]?.slice(0, 3) ?? [];
}
