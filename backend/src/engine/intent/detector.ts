import type { PromptIntent } from "shared/types/index.js";

interface IntentScore {
    intent: PromptIntent;
    score: number;
}

const INTENT_PATTERNS: { intent: PromptIntent; pattern: RegExp; weight: number }[] = [
    { intent: "coding", pattern: /\b(code|function|script|program|implement|debug|fix|refactor|api|endpoint|class|method|algorithm|regex|deploy|compile|syntax|variable|loop|array|object|typescript|javascript|python)\b/gi, weight: 3 },
    { intent: "writing", pattern: /\b(write|essay|article|blog|story|poem|email|letter|draft|edit|proofread|tone|narrative|paragraph|creative|copywrite|headline)\b/gi, weight: 3 },
    { intent: "research", pattern: /\b(research|explain|compare|difference|analysis|study|evidence|data|statistics|survey|report|review|evaluate|pros and cons|advantages|disadvantages)\b/gi, weight: 3 },
    { intent: "career", pattern: /\b(resume|cv|interview|job|career|salary|negotiate|cover letter|linkedin|portfolio|hiring|recruiter|promotion|skill|certification)\b/gi, weight: 3 },
];

/** Detect the most likely intent and compute confidence */
export function detectIntent(prompt: string): IntentScore {
    const safePrompt = prompt.length > 50000 ? prompt.substring(0, 50000) : prompt;
    const scores: IntentScore[] = INTENT_PATTERNS.map(({ intent, pattern, weight }) => {
        const matches = safePrompt.match(pattern) || [];
        return { intent, score: matches.length * weight };
    });

    scores.sort((a, b) => b.score - a.score);

    const top = scores[0]!;
    const second = scores[1]!;

    // No keywords matched → general with low confidence
    if (top.score === 0) {
        return { intent: "general", score: 30 };
    }

    // Confidence based on gap between top and second intent
    const gap = top.score - second.score;
    const totalKeywords = scores.reduce((s, i) => s + i.score, 0);
    const dominance = totalKeywords > 0 ? top.score / totalKeywords : 0;

    let confidence = Math.round(dominance * 100);
    // Boost if clear gap exists
    if (gap >= 6) confidence = Math.min(100, confidence + 15);
    // Floor at 20
    confidence = Math.max(20, confidence);

    return { intent: top.intent, score: confidence };
}
