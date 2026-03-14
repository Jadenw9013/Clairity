import type { RiskFactor } from "shared/types/quality.js";

/** A risk signal definition: test function + metadata */
export interface RiskSignal {
    signal: string;
    points: number;
    description: string;
    guardrail: string;
    test: (prompt: string) => boolean;
}

const NUMERIC_PRECISION = /\b\d{2,}\s*(percent|%|dollars|\$|million|billion|times|years old|kg|lbs|miles|km)\b/i;
const SENSITIVE_DOMAIN = /\b(diagnos|symptom|medication|prescription|treatment|dosage|medical|legal|lawsuit|attorney|lawyer|liability|tax|invest|financ|stock|crypto|mortgage|insurance)\b/i;
const ABSOLUTISM = /\b(always|never|every single|without exception|guaranteed|100%|impossible|certainly)\b/i;
const RECENCY = /\b(latest|current|today|this year|this month|right now|recent|up[- ]to[- ]date|as of 202\d)\b/i;
const EXHAUSTIVE = /\b(all|every|complete list|exhaustive|comprehensive list|full list|entire)\b/i;

const DOMAINS_REGEX = [
    /\b(code|program|software|api|database|algorithm)\b/i,
    /\b(cook|recipe|ingredient|meal|food)\b/i,
    /\b(medical|health|symptom|treatment)\b/i,
    /\b(legal|law|regulation|compliance)\b/i,
    /\b(financ|invest|stock|budget|tax)\b/i,
    /\b(market|brand|advertis|campaign|seo)\b/i,
    /\b(physic|chemistry|biology|science|math)\b/i,
];

/** Count distinct domains mentioned in the prompt */
function countDomains(prompt: string): number {
    return DOMAINS_REGEX.filter((d) => d.test(prompt)).length;
}

/** All risk signals with their point values and guardrails */
export const RISK_SIGNALS: RiskSignal[] = [
    {
        signal: "numeric-precision",
        points: 20,
        description: "Asks for specific numbers that may not have a verified source.",
        guardrail: "Ask the AI to cite sources for any specific numbers it provides.",
        test: (p) => NUMERIC_PRECISION.test(p),
    },
    {
        signal: "sensitive-domain",
        points: 25,
        description: "Touches on medical, legal, or financial topics that need expert review.",
        guardrail: "Verify any medical, legal, or financial advice with a qualified professional.",
        test: (p) => SENSITIVE_DOMAIN.test(p),
    },
    {
        signal: "absolutism",
        points: 10,
        description: "Uses absolute terms like 'always' or 'never' that rarely hold true.",
        guardrail: "Consider softening absolute claims and asking for nuanced answers instead.",
        test: (p) => ABSOLUTISM.test(p),
    },
    {
        signal: "multi-domain",
        points: 15,
        description: "Mixes several unrelated topics, which can reduce accuracy on each.",
        guardrail: "Consider splitting this into separate prompts for each topic.",
        test: (p) => countDomains(p) > 2,
    },
    {
        signal: "recency-dependent",
        points: 20,
        description: "Asks about recent or current information that the AI may not have.",
        guardrail: "Double-check any time-sensitive facts against an up-to-date source.",
        test: (p) => RECENCY.test(p),
    },
    {
        signal: "exhaustive-request",
        points: 10,
        description: "Asks for a complete or exhaustive list, which is hard to guarantee.",
        guardrail: "Ask for 'key examples' instead of 'all' to get more reliable results.",
        test: (p) => EXHAUSTIVE.test(p),
    },
];

/** Evaluate all signals and return matched risk factors */
export function evaluateSignals(prompt: string): RiskFactor[] {
    const factors: RiskFactor[] = [];
    for (const sig of RISK_SIGNALS) {
        if (sig.test(prompt)) {
            factors.push({
                signal: sig.signal,
                points: sig.points,
                description: sig.description,
                guardrail: sig.guardrail,
            });
        }
    }
    return factors;
}
