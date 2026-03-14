import type {
  RewriteMode,
  RewritePreset,
  PromptIntent,
  PromptScore,
  PromptChange,
} from "shared/types/index.ts";

// --- Intent Detection ---

const INTENT_PATTERNS: Record<PromptIntent, RegExp[]> = {
  coding: [
    /\b(code|function|bug|error|debug|api|class|variable|python|javascript|sql|html|css|regex|algorithm|refactor|deploy)\b/i,
  ],
  writing: [
    /\b(essay|article|blog\s*post|story|email|draft|paragraph|summarize|proofread|tone|narrative)\b/i,
  ],
  research: [
    /\b(research|compare|analyze|explain|difference|pros\s+and\s+cons|overview|survey|study|investigate|evaluate)\b/i,
  ],
  career: [
    /\b(resume|cv|cover\s+letter|interview|job|career|salary|negotiate|linkedin|portfolio|hire|promotion)\b/i,
  ],
  general: [],
};

export function detectIntent(prompt: string): PromptIntent {
  let bestIntent: PromptIntent = "general";
  let bestScore = 0;

  for (const [intent, patterns] of Object.entries(INTENT_PATTERNS)) {
    if (intent === "general") continue;
    let score = 0;
    for (const pattern of patterns) {
      const matches = prompt.match(pattern);
      if (matches) score += matches.length;
    }
    if (score > bestScore) {
      bestScore = score;
      bestIntent = intent as PromptIntent;
    }
  }

  return bestIntent;
}

// --- Confidence Scoring ---

const AMBIGUOUS_WORDS = /\b(stuff|things|something|anything|whatever|somehow|kind\s+of|sort\s+of|maybe|idk)\b/i;
const HAS_VERB = /\b(help|write|create|build|make|explain|find|show|tell|give|fix|improve|generate|design|list|describe|compare|analyze)\b/i;
const HAS_QUESTION = /\?/;
const MULTI_INTENT_MARKERS = /\b(also|and\s+also|additionally|plus|furthermore|on\s+top\s+of\s+that)\b/i;

export function computeConfidence(prompt: string): { score: number; gaps: string[] } {
  let score = 80;
  const gaps: string[] = [];

  if (prompt.length < 20) {
    score -= 30;
    gaps.push("very short prompt — add more detail");
  } else if (prompt.length < 50) {
    score -= 15;
    gaps.push("brief prompt — consider adding context");
  }

  if (!HAS_VERB.test(prompt) && !HAS_QUESTION.test(prompt)) {
    score -= 10;
    gaps.push("no clear action verb or question detected");
  }

  if (AMBIGUOUS_WORDS.test(prompt)) {
    score -= 15;
    gaps.push("vague language detected — be more specific");
  }

  if (MULTI_INTENT_MARKERS.test(prompt)) {
    score -= 10;
    gaps.push("multiple requests detected — consider splitting");
  }

  return { score: Math.max(0, Math.min(100, score)), gaps };
}

// --- Clarifying Question ---

export function generateClarifyingQuestion(
  gaps: string[],
  intent: PromptIntent
): string | undefined {
  if (gaps.length === 0) return undefined;

  const gapPriority = gaps[0] ?? "";

  if (gapPriority.includes("very short") || gapPriority.includes("brief")) {
    const contextHints: Record<PromptIntent, string> = {
      coding: "What programming language and framework are you working with?",
      writing: "What is the intended audience and purpose of this piece?",
      research: "What specific aspect are you most interested in?",
      career: "What role or industry are you targeting?",
      general: "Could you add more details about what you're looking for?",
    };
    return contextHints[intent];
  }

  if (gapPriority.includes("vague")) {
    return "Could you replace any vague terms with specific details?";
  }

  if (gapPriority.includes("multiple requests")) {
    return "Would you like to focus on one of these requests first?";
  }

  if (gapPriority.includes("no clear action")) {
    return "What specific outcome are you hoping for?";
  }

  return undefined;
}

// --- Structured Rewrite ---

interface RewriteInput {
  prompt: string;
  intent: PromptIntent;
  mode: RewriteMode;
  preset?: RewritePreset;
}

const ROLE_MAP: Record<PromptIntent, string> = {
  coding: "You are an expert software engineer.",
  writing: "You are a skilled writer and editor.",
  research: "You are a thorough research analyst.",
  career: "You are a career development advisor.",
  general: "You are a helpful and knowledgeable assistant.",
};

const TONE_INSTRUCTIONS: Record<string, string> = {
  concise: "Be concise and to the point. Avoid unnecessary elaboration.",
  detailed: "Be thorough and detailed. Include examples where helpful.",
  professional: "Use a professional, formal tone appropriate for business contexts.",
};

const FORMAT_INSTRUCTIONS: Record<string, string> = {
  paragraph: "Respond in clear paragraphs.",
  bullets: "Format your response as bullet points.",
  "step-by-step": "Provide a numbered step-by-step guide.",
  json: "Return your response as structured JSON.",
  code: "Provide code with clear comments.",
};

export function buildRewrittenPrompt(input: RewriteInput): {
  enhanced: string;
  changes: PromptChange[];
} {
  const { prompt, intent, mode, preset } = input;
  const changes: PromptChange[] = [];
  const isAdvanced = mode === "restructure";
  const resolvedIntent = preset?.intent ?? intent;

  // ── 1. Role (clear and direct) ──
  const role = ROLE_MAP[resolvedIntent];

  // ── 2. Detect missing clarity dimensions ──
  const hasAudience = /\b(audience|reader|user|client|student|team|manager|beginner|expert)\b/i.test(prompt);
  const hasScope = /\b(brief|short|detailed|comprehensive|overview|summary|in-depth)\b/i.test(prompt);

  const clarityAdditions: string[] = [];
  if (!hasAudience) {
    clarityAdditions.push("Assume a knowledgeable but non-specialist audience unless otherwise indicated.");
    changes.push({ type: "added", description: "Specified default audience" });
  }
  if (!hasScope && prompt.length < 100) {
    clarityAdditions.push("Keep the response focused and proportional to the question scope.");
    changes.push({ type: "added", description: "Added scope guidance" });
  }

  // ── 3. Output control (always explicit) ──
  const OUTPUT_CONTROL_MAP: Record<PromptIntent, string> = {
    coding: "Return working code with brief inline comments. No explanatory prose unless the question asks for it.",
    writing: "Return the finished text only. Do not include meta-commentary about the writing.",
    research: "Return a structured analysis with clear sections. Cite sources where applicable.",
    career: "Return actionable advice organized by priority.",
    general: "Return a clear, direct answer. Use structure (headings, lists) only if it aids clarity.",
  };
  const outputControl = FORMAT_INSTRUCTIONS[preset?.output_format ?? ""] ?? OUTPUT_CONTROL_MAP[resolvedIntent];
  changes.push({ type: "added", description: "Added explicit output instructions" });

  // ── 4. Constraints ──
  const constraints: string[] = [];
  constraints.push("Preserve the user's original intent.");

  if (mode === "enhance") {
    constraints.push("Improve clarity without changing meaning.");
    constraints.push("Keep response length proportional to input scope.");
  } else if (mode === "restructure") {
    constraints.push("Reorganize into clearly defined sections with headers.");
    changes.push({ type: "restructured", description: "Added structural organization guidance" });
  } else if (mode === "expand") {
    constraints.push("Add relevant detail and examples.");
    constraints.push("Include edge cases and considerations.");
    changes.push({ type: "modified", description: "Expanded scope with detail guidance" });
  }

  // Tone
  const tone = preset?.tone ?? "concise";
  const toneInstruction = TONE_INSTRUCTIONS[tone];
  if (toneInstruction) {
    constraints.push(toneInstruction);
    if (preset?.tone) {
      changes.push({ type: "added", description: `Applied ${tone} tone` });
    }
  }

  // ── 5. Accuracy risk injection (conditional) ──
  const HIGH_RISK_PATTERN = /\b(latest|current|statistics?|research|law|legal|medical|financial|tax|diagnosis|regulation|data|percent|mortality|survival)\b/i;
  const needsAccuracyGuard = HIGH_RISK_PATTERN.test(prompt);

  const safeguards: string[] = [];
  if (needsAccuracyGuard) {
    safeguards.push("Cite reliable sources for all factual claims.");
    safeguards.push("Acknowledge uncertainty where data may be outdated or contested.");
    safeguards.push("Do not fabricate data, statistics, or references.");
    if (/\b(latest|current|recent|2024|2025|2026)\b/i.test(prompt)) {
      safeguards.push("Note the knowledge cutoff date and suggest the user verify recency.");
    }
    changes.push({ type: "added", description: "Injected accuracy safeguards (high-risk domain detected)" });
  } else {
    // Minimal default safeguard
    safeguards.push("Acknowledge uncertainty rather than guessing.");
  }

  // ── 6. Examples (coding/advanced only, max 2) ──
  let exampleBlock = "";
  if (resolvedIntent === "coding" && mode !== "enhance") {
    // Only add example framing, not actual code examples (we don't know the language)
    exampleBlock = "\nIf helpful, include 1–2 short code examples demonstrating the solution.";
    changes.push({ type: "added", description: "Allowed brief code examples" });
  }

  // ── 7. Assemble prompt ──
  changes.push({ type: "added", description: "Applied structured prompt envelope" });

  if (isAdvanced) {
    // XML envelope for advanced/restructure mode
    const parts: string[] = [];
    parts.push(`<role>${role}</role>`);

    if (preset?.additional_context || clarityAdditions.length > 0) {
      const ctxLines = [];
      if (preset?.additional_context) ctxLines.push(preset.additional_context);
      ctxLines.push(...clarityAdditions);
      parts.push(`<context>\n${ctxLines.join("\n")}\n</context>`);
      if (preset?.additional_context) {
        changes.push({ type: "added", description: "Included user-provided context" });
      }
    }

    parts.push(`<instructions>\n${prompt}${exampleBlock}\n</instructions>`);
    parts.push(`<constraints>\n${constraints.join("\n")}\n</constraints>`);
    parts.push(`<output_format>\n${outputControl}\n</output_format>`);

    if (safeguards.length > 0) {
      parts.push(`<accuracy>\n${safeguards.join("\n")}\n</accuracy>`);
    }

    return { enhanced: parts.join("\n\n"), changes };
  }

  // Default mode: clean structured text (no XML shown to user)
  const sections: string[] = [];

  // Role — concise, one line
  sections.push(role);

  // Task — the user's prompt, verbatim
  sections.push(prompt);

  // Context + clarity dimensions
  if (preset?.additional_context || clarityAdditions.length > 0) {
    const ctxLines: string[] = [];
    if (preset?.additional_context) {
      ctxLines.push(preset.additional_context);
      changes.push({ type: "added", description: "Included user-provided context" });
    }
    ctxLines.push(...clarityAdditions);
    sections.push(ctxLines.join(" "));
  }

  // Constraints — compact
  if (constraints.length > 0) {
    sections.push(constraints.map(c => `- ${c}`).join("\n"));
  }

  // Output control — always present
  sections.push(outputControl);

  // Safeguards — only when triggered
  if (safeguards.length > 0) {
    sections.push(safeguards.map(s => `- ${s}`).join("\n"));
  }

  // Example framing
  if (exampleBlock) {
    sections.push(exampleBlock.trim());
  }

  return { enhanced: sections.join("\n\n"), changes };
}

// --- Quality Scoring ---

export function scorePrompt(enhanced: string): Omit<PromptScore, "confidence"> {
  let clarity = 50;
  let specificity = 50;
  let constraintScore = 50;

  // Clarity: presence of structure
  if (/^## /m.test(enhanced)) clarity += 20;
  if (/\n- /m.test(enhanced)) clarity += 10;
  if (enhanced.length > 100) clarity += 10;
  if (enhanced.split("\n\n").length >= 3) clarity += 10;

  // Specificity: presence of concrete details
  if (/## Role/m.test(enhanced)) specificity += 15;
  if (/## Task/m.test(enhanced)) specificity += 10;
  if (/## Context/m.test(enhanced)) specificity += 15;
  if (/## Output Format/m.test(enhanced)) specificity += 10;

  // Constraints: presence of guardrails
  if (/## Constraints/m.test(enhanced)) constraintScore += 20;
  if (/## Quality Rules/m.test(enhanced)) constraintScore += 15;
  if (/preserve.*intent/i.test(enhanced)) constraintScore += 10;
  if (/fabricat/i.test(enhanced)) constraintScore += 5;

  clarity = Math.min(100, clarity);
  specificity = Math.min(100, specificity);
  constraintScore = Math.min(100, constraintScore);
  const overall = Math.round((clarity + specificity + constraintScore) / 3);

  return { clarity, specificity, constraints: constraintScore, overall };
}

// --- Warnings ---

export function generateWarnings(prompt: string, intent: PromptIntent): string[] {
  const warnings: string[] = [];

  if (prompt.length > 5000) {
    warnings.push("Very long prompt — consider breaking into smaller requests");
  }

  if (/\b(password|secret|api.?key|token|ssn|credit.?card)\b/i.test(prompt)) {
    warnings.push("Prompt may contain sensitive information — review before sharing");
  }

  if (intent === "general" && prompt.length > 200) {
    warnings.push("Could not determine specific intent — consider selecting a category");
  }

  return warnings;
}

// --- Main Pipeline ---

export interface RewriteEngineInput {
  prompt: string;
  mode: RewriteMode;
  preset?: RewritePreset;
}

export interface RewriteEngineOutput {
  enhanced_prompt: string;
  score: PromptScore;
  changes: PromptChange[];
  warnings: string[];
  clarifying_question?: string;
  detected_intent: PromptIntent;
}

export function runRewritePipeline(input: RewriteEngineInput): RewriteEngineOutput {
  const { prompt, mode, preset } = input;

  // Step 1: Analyze
  const intent = preset?.intent ?? detectIntent(prompt);
  const { score: confidence, gaps } = computeConfidence(prompt);

  // Step 2: Rewrite
  const { enhanced, changes } = buildRewrittenPrompt({
    prompt,
    intent,
    mode,
    preset,
  });

  // Step 3: Score & Explain
  const qualityScores = scorePrompt(enhanced);
  const score: PromptScore = { ...qualityScores, confidence };
  const warnings = generateWarnings(prompt, intent);
  const clarifying_question =
    confidence < 60 ? generateClarifyingQuestion(gaps, intent) : undefined;

  return {
    enhanced_prompt: enhanced,
    score,
    changes,
    warnings,
    clarifying_question,
    detected_intent: intent,
  };
}

// ============================================================
// IMPROVED MVP PIPELINE (Feature 1 + Feature 2)
// Only used when IMPROVED_MVP_ENABLED=true.
// Wraps the standard pipeline result with concise formatting
// and optional accuracy safeguards. Never modifies the original
// pipeline — delegates to it and post-processes.
// ============================================================

export type RiskLevel = "low" | "medium" | "high";

export interface RiskAssessmentResult {
  level: RiskLevel;
  reasons: string[];
  guardrail?: string;
}

function assessRisk(prompt: string, intent: PromptIntent, confidence: number): RiskAssessmentResult {
  const reasons: string[] = [];
  let riskScore = 0;

  // Factual risk patterns
  if (/\b(statistics?|data|percentage|numbers?|how many|how much)\b/i.test(prompt)) {
    reasons.push("Prompt requests factual/statistical data");
    riskScore += 2;
  }
  if (/\b(medical|legal|financial|tax|health|diagnos)\b/i.test(prompt)) {
    reasons.push("Domain has high accuracy requirements");
    riskScore += 3;
  }
  if (/\b(always|never|every|all|none|guaranteed|definitely)\b/i.test(prompt)) {
    reasons.push("Absolute language may produce overconfident output");
    riskScore += 1;
  }
  if (confidence < 40) {
    reasons.push("Low confidence in prompt clarity");
    riskScore += 2;
  }
  if (intent === "general" && prompt.length > 150) {
    reasons.push("Broad topic with no detected specialization");
    riskScore += 1;
  }

  const level: RiskLevel = riskScore >= 4 ? "high" : riskScore >= 2 ? "medium" : "low";

  const guardrail =
    level === "high"
      ? "Add to your prompt: 'Cite sources for all factual claims. State uncertainty where applicable.'"
      : level === "medium"
        ? "Consider adding: 'Note any assumptions you make.'"
        : undefined;

  return { level, reasons, guardrail };
}

function conciseFormat(enhanced: string, prompt: string): string {
  // For short prompts (< 80 chars), produce a cleaner single-block format
  // instead of the full ## Role / ## Task / ## Constraints structure
  if (prompt.length < 80) {
    // Extract the task content and key constraints
    const taskMatch = enhanced.match(/## Task\n(.+?)(?=\n##)/s);
    const constraintMatch = enhanced.match(/## Constraints\n(.+?)(?=\n##)/s);
    const task = taskMatch?.[1]?.trim() ?? prompt;
    const constraints = constraintMatch?.[1]?.trim() ?? "";

    const lines = [task];
    if (constraints) {
      lines.push("");
      lines.push(constraints);
    }
    lines.push("");
    lines.push("Be accurate. Cite sources when making factual claims.");
    return lines.join("\n");
  }

  // For longer prompts, keep the structured format but append safeguards
  if (!enhanced.includes("Cite sources")) {
    return enhanced + "\n\n## Accuracy\n- Cite sources for factual claims\n- Acknowledge uncertainty rather than guessing";
  }
  return enhanced;
}

export interface ImprovedRewriteOutput extends RewriteEngineOutput {
  risk: RiskAssessmentResult;
  model_used: string;
}

export function runImprovedPipeline(input: RewriteEngineInput): ImprovedRewriteOutput {
  // Delegate to existing pipeline (NEVER modified)
  const base = runRewritePipeline(input);

  // Post-process: concise formatting
  const enhanced_prompt = conciseFormat(base.enhanced_prompt, input.prompt);

  // Risk assessment
  const risk = assessRisk(input.prompt, base.detected_intent, base.score.confidence);

  // Inject guardrail into changes if risk is medium+
  const changes = [...base.changes];
  if (risk.guardrail) {
    changes.push({ type: "added", description: `Accuracy guardrail (risk: ${risk.level})` });
  }

  return {
    ...base,
    enhanced_prompt,
    changes,
    risk,
    model_used: "deterministic-v2",
  };
}

