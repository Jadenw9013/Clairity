// backend/src/lib/rewriteValidator.ts
// Detects when the LLM returned a chatbot-style answer or clarification
// question instead of an optimized prompt, and provides a conservative
// deterministic fallback so the user never sees a bad rewrite.
//
// Clairity enhances prompts. It does not answer prompts. This module is the
// safety net behind the system prompt — if the model drifts into answer-mode,
// validateRewrite() rejects the output and buildDeterministicRewrite()
// produces a safe templated rewrite from the original user prompt.

export interface RewriteVerdict {
  ok: boolean;
  reason?: string;
}

// ---------------------------------------------------------------------------
// Pattern A — assistant-reply openers
// These are phrases an AI assistant uses when *answering* a prompt, never
// phrases a user would type INTO a chat box. Matched against the head of the
// trimmed output.
// ---------------------------------------------------------------------------
const ANSWER_OPENERS: ReadonlyArray<readonly [RegExp, string]> = [
  // Affirmative replies
  [/^(sure|of course|absolutely|certainly|alright|okay)\b[\s,!.\-—]/i, "affirmative"],
  // Offers of help
  [
    /^(i can|i'?ll|i'?d|i would be|i'?m happy|i'?m glad|happy to|glad to)\s+(help|assist|do|provide|explain|walk you through|guide)/i,
    "offer",
  ],
  // Takeover / setup ("Let me explain…", "Let me show…")
  [/^let me\b/i, "takeover"],
  // Explainer ("Here's how…", "Here's what you need…")
  [/^here'?s\s+(how|what|a|the|some|my|why)\b/i, "explainer"],
  // Tutorial / step-by-step opener
  [
    /^to (do this|optimize|improve|fix|debug|build|implement|create|set up|setup|run|use|configure|install|get started|begin|accomplish|address)\b/i,
    "tutorial_open",
  ],
  // Numbered/ordered step start
  [/^(first|firstly|step \d|to begin|to start),?\b/i, "step_open"],
  // Direct advice TO the user (chatbot voice, not user voice)
  [/^you (should|need to|can|could|might (?:want|consider)|may (?:want|consider)|must|have to|will need)\b/i, "advice"],
  // "The best way to…", "The key approach…"
  [/^the (best|most|key|main|first|primary|simplest|easiest) (way|approach|step|thing|method|option|strategy)\b/i, "advice_topic"],
  // Compliment-then-answer
  [/^great (question|prompt|idea)/i, "compliment"],
  // "Based on your code, you should…"
  [/^based on (your|the|what|my)\b/i, "summarize_then_advise"],
];

// ---------------------------------------------------------------------------
// Pattern B — clarification questions directed at the user
// These are the AI asking the USER to provide information, rather than a
// rewritten prompt the user would send TO an AI.
// ---------------------------------------------------------------------------
const CLARIFICATION_PATTERNS: ReadonlyArray<readonly [RegExp, string]> = [
  // "What X do you want…", "Which Y are you using…", "Where did you see…"
  // Allows up to ~80 chars of intermediate words between the wh- and "do/are you".
  [
    /^(what|which|where|when|why)\b.{0,80}?\b(do|did|are|were|should|could|would|might)\s+you\b/i,
    "wh_to_user",
  ],
  // "Could you clarify…", "Can you specify…", "Could you let me know…"
  // Keep verbs that are almost always user-direction. Verbs like "explain",
  // "describe", "share", "provide" can legitimately direct the AI in a
  // user-voice rewrite ("Can you explain this?"), so they are excluded here.
  [
    /^(can|could|would|will) you (clarify|specify|let me know|elaborate on what|provide more|give me more|share more)\b/i,
    "modal_to_user",
  ],
  [/^do you (mean|want|need|have|prefer)\b/i, "do_you"],
  [/^are you (asking|looking|trying|wanting|referring)\b/i, "are_you"],
  // "Please clarify/specify/tell me…"
  [
    /^please (clarify|specify|tell me|let me know|elaborate|give me more|provide more (?:details|information|context))\b/i,
    "please_clarify",
  ],
];

// ---------------------------------------------------------------------------
// Pattern C — short "Please provide the X" outputs that are pure user-direction.
// We bound by length to avoid flagging valid rewrites that legitimately ask
// the AI to provide a deliverable (e.g. "Please provide a step-by-step
// solution covering X, Y, Z…").
// ---------------------------------------------------------------------------
const SHORT_USER_DIRECTION = /^please (provide|share|describe|paste|attach|send|specify|clarify|tell me)\b/i;
const SHORT_USER_DIRECTION_MAX_LEN = 160;

// ---------------------------------------------------------------------------
// Validator
// ---------------------------------------------------------------------------

/**
 * Strip wrapper tags the model occasionally echoes from the input format.
 */
function stripTags(s: string): string {
  return s
    .trim()
    .replace(/^<prompt_to_optimize>\s*/i, "")
    .replace(/\s*<\/prompt_to_optimize>$/i, "")
    .trim();
}

/**
 * Decide whether the LLM output is a valid optimized prompt or a leak of
 * answer-mode / clarification behavior. Conservative — false negatives are
 * preferred over false positives (the system prompt remains the primary
 * defense; this is the safety net).
 */
export function validateRewrite(output: string, _originalPrompt: string): RewriteVerdict {
  if (!output) return { ok: false, reason: "empty" };
  const stripped = stripTags(output);
  if (stripped.length === 0) return { ok: false, reason: "empty" };

  for (const [pattern, reason] of ANSWER_OPENERS) {
    if (pattern.test(stripped)) return { ok: false, reason: `answer_opener:${reason}` };
  }

  for (const [pattern, reason] of CLARIFICATION_PATTERNS) {
    if (pattern.test(stripped)) return { ok: false, reason: `clarification:${reason}` };
  }

  if (
    SHORT_USER_DIRECTION.test(stripped) &&
    stripped.length < SHORT_USER_DIRECTION_MAX_LEN
  ) {
    return { ok: false, reason: "short_user_direction" };
  }

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Deterministic fallback rewrite
// Produces a safe, useful rewrite from the original prompt without calling
// the LLM. Used when the validator rejects the model's output.
// ---------------------------------------------------------------------------

/** Light grammar normalization: capitalize first letter, fix bare "i", end punctuation. */
function normalizePrompt(raw: string): string {
  let s = raw.trim();
  if (!s) return s;
  s = s.charAt(0).toUpperCase() + s.slice(1);
  s = s.replace(/\bi\b/g, "I");
  s = s.replace(/\bi'(m|ve|ll|d|re)\b/gi, (_m, suffix) => `I'${suffix}`);
  if (!/[.!?]$/.test(s)) {
    const isQuestion = /^(how|what|why|when|who|where|can|could|would|should|do|does|did|is|are|will|am|was|were)\b/i.test(s);
    s += isQuestion ? "?" : ".";
  }
  return s;
}

/**
 * Build a conservative rewrite for the given user prompt without calling the
 * LLM. The output:
 *  - is in user voice (something the user could paste into ChatGPT/Claude)
 *  - preserves the user's original task
 *  - asks the receiving AI to act, never asks the user a follow-up question
 *  - includes a short focus appendix tailored to the inferred intent
 */
export function buildDeterministicRewrite(originalPrompt: string): string {
  const cleaned = normalizePrompt(originalPrompt);
  if (!cleaned) {
    // Empty/whitespace-only input — produce a generic safe rewrite.
    return "Please respond with concrete, practical steps and the reasoning behind each one. If important context is missing, state a reasonable assumption and proceed instead of asking me to clarify.";
  }

  const lower = cleaned.toLowerCase();

  // Order matters: check the most specific intent classes first.
  if (
    /\b(test|qa|verify|validate|audit|check|push(?:ing)?\s+to\s+main|deploy|release|production|launch|ship|rollout|roll[\s-]?out)\b/.test(
      lower
    )
  ) {
    return `${cleaned} Please focus on practical checks for reliability, security, performance, and anything that could negatively impact existing users. Suggest the highest-impact items first and call out the trade-offs of each.`;
  }
  if (/\b(bug|debug|error|crash|fail(?:ed|ing)?|broken|stack ?trace|exception|traceback|throws?)\b/.test(lower)) {
    return `${cleaned} I'll share the relevant code, the error message, and the expected vs actual behavior. Please walk me through the most likely causes and the most direct fix for each — start with the highest-probability cause.`;
  }
  if (/\b(optimi[sz]e|refactor|speed[\s-]?up|performance|faster|memory|latenc(?:y|ies))\b/.test(lower)) {
    return `${cleaned} Please suggest practical improvements for performance, readability, maintainability, and reliability, and point out which changes would have the biggest impact.`;
  }
  if (/\b(explain|clarify|describe|how does|what is|understand|walk me through)\b/.test(lower)) {
    return `${cleaned} Please explain this clearly, with concrete examples where useful, and highlight any common pitfalls or important nuances.`;
  }
  if (/\b(write|rewrite|draft|edit|compose|polish|tighten|paraphrase|summari[sz]e)\b/.test(lower)) {
    return `${cleaned} I'll paste the content below. Please suggest concrete improvements (clarity, structure, tone) with brief explanations, then provide a revised version.`;
  }
  if (/\b(review|critique|feedback|analy[sz]e|assess|evaluate)\b/.test(lower)) {
    return `${cleaned} Please give concrete, prioritized feedback with brief reasoning for each point, and call out anything I might have missed.`;
  }
  if (/\b(better|improve|enhance|polish)\b/.test(lower)) {
    return `${cleaned} I'll share the content below. Please clarify what "better" means in this context (clarity, performance, style, accuracy), then suggest concrete, prioritized improvements with brief explanations.`;
  }

  return `${cleaned} Please respond with concrete, practical steps and the reasoning behind each one. If important context is missing, state a reasonable assumption and proceed instead of asking me to clarify.`;
}
