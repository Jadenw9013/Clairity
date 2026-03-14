import { describe, it, expect } from "vitest";
import {
  detectIntent,
  computeConfidence,
  generateClarifyingQuestion,
  buildRewrittenPrompt,
  scorePrompt,
  generateWarnings,
  runRewritePipeline,
} from "../src/lib/rewriteEngine.js";

// --- Intent Detection ---

describe("detectIntent", () => {
  it("detects coding intent", () => {
    expect(detectIntent("Write a Python function to sort a list")).toBe("coding");
  });

  it("detects writing intent", () => {
    expect(detectIntent("Write me an email to my manager about vacation")).toBe("writing");
  });

  it("detects research intent", () => {
    expect(detectIntent("Compare React and Vue for frontend development")).toBe("research");
  });

  it("detects career intent", () => {
    expect(detectIntent("Review my resume for a software job interview")).toBe("career");
  });

  it("defaults to general for ambiguous prompts", () => {
    expect(detectIntent("hello there")).toBe("general");
  });
});

// --- Confidence Scoring ---

describe("computeConfidence", () => {
  it("gives high confidence to detailed prompts", () => {
    const { score } = computeConfidence(
      "Write a TypeScript function that takes an array of numbers and returns the median value"
    );
    expect(score).toBeGreaterThanOrEqual(70);
  });

  it("gives low confidence to very short prompts", () => {
    const { score, gaps } = computeConfidence("help");
    expect(score).toBeLessThan(60);
    expect(gaps.length).toBeGreaterThan(0);
  });

  it("penalizes ambiguous language", () => {
    const { score: cleanScore } = computeConfidence(
      "Write a function to validate user input"
    );
    const { score: ambiguousScore } = computeConfidence(
      "Write something to do stuff with things"
    );
    expect(cleanScore).toBeGreaterThan(ambiguousScore);
  });

  it("penalizes multi-intent markers", () => {
    const { score } = computeConfidence(
      "Write a function and also create a database and additionally build a frontend"
    );
    expect(score).toBeLessThanOrEqual(70);
  });

  it("clamps score between 0 and 100", () => {
    const { score: lowScore } = computeConfidence("x");
    expect(lowScore).toBeGreaterThanOrEqual(0);
    expect(lowScore).toBeLessThanOrEqual(100);
  });
});

// --- Clarifying Questions ---

describe("generateClarifyingQuestion", () => {
  it("returns question for short coding prompt", () => {
    const q = generateClarifyingQuestion(["very short prompt — add more detail"], "coding");
    expect(q).toContain("programming language");
  });

  it("returns question for vague language", () => {
    const q = generateClarifyingQuestion(["vague language detected — be more specific"], "general");
    expect(q).toContain("vague");
  });

  it("returns undefined when no gaps", () => {
    expect(generateClarifyingQuestion([], "general")).toBeUndefined();
  });
});

// --- Build Rewritten Prompt ---

describe("buildRewrittenPrompt", () => {
  it("includes role, task, constraints, output instructions, and safeguards", () => {
    const { enhanced } = buildRewrittenPrompt({
      prompt: "Write a REST API",
      intent: "coding",
      mode: "enhance",
    });
    expect(enhanced).toContain("expert software engineer");
    expect(enhanced).toContain("Write a REST API");
    expect(enhanced).toContain("Preserve the user's original intent");
    expect(enhanced).toContain("Return working code");
    expect(enhanced).toContain("uncertainty");
  });

  it("includes additional context when provided", () => {
    const { enhanced, changes } = buildRewrittenPrompt({
      prompt: "Write a REST API",
      intent: "coding",
      mode: "enhance",
      preset: { additional_context: "Using Express and TypeScript" },
    });
    expect(enhanced).toContain("Using Express and TypeScript");
    expect(changes.some((c) => c.description.includes("context"))).toBe(true);
  });

  it("applies tone preset", () => {
    const { enhanced } = buildRewrittenPrompt({
      prompt: "Write a guide",
      intent: "writing",
      mode: "enhance",
      preset: { tone: "professional" },
    });
    expect(enhanced).toContain("professional");
  });

  it("applies output format preset", () => {
    const { enhanced } = buildRewrittenPrompt({
      prompt: "List benefits",
      intent: "general",
      mode: "enhance",
      preset: { output_format: "bullets" },
    });
    expect(enhanced).toContain("bullet points");
  });

  it("adds expand-mode constraints", () => {
    const { enhanced, changes } = buildRewrittenPrompt({
      prompt: "Tell me about APIs",
      intent: "research",
      mode: "expand",
    });
    expect(enhanced).toContain("edge cases");
    expect(changes.some((c) => c.description.includes("Expanded"))).toBe(true);
  });
});

// --- Score Prompt ---

describe("scorePrompt", () => {
  it("scores structured prompt higher than minimal", () => {
    const highScore = scorePrompt(
      "## Role\nExpert\n\n## Task\nDo X\n\n## Constraints\n- Be clear\n\n## Output Format\nBullets\n\n## Quality Rules\n- No fabrication"
    );
    const lowScore = scorePrompt("help me");
    expect(highScore.overall).toBeGreaterThan(lowScore.overall);
  });

  it("returns scores between 0 and 100", () => {
    const score = scorePrompt("## Role\nTest\n\n## Task\nTest");
    expect(score.clarity).toBeGreaterThanOrEqual(0);
    expect(score.clarity).toBeLessThanOrEqual(100);
    expect(score.specificity).toBeGreaterThanOrEqual(0);
    expect(score.specificity).toBeLessThanOrEqual(100);
  });
});

// --- Warnings ---

describe("generateWarnings", () => {
  it("warns about sensitive content", () => {
    const warnings = generateWarnings("My API key is abc123", "coding");
    expect(warnings.some((w) => w.includes("sensitive"))).toBe(true);
  });

  it("warns about long prompts", () => {
    const longPrompt = "a".repeat(5001);
    const warnings = generateWarnings(longPrompt, "general");
    expect(warnings.some((w) => w.includes("long"))).toBe(true);
  });

  it("returns empty for normal prompts", () => {
    const warnings = generateWarnings("Write a function to add two numbers", "coding");
    expect(warnings).toHaveLength(0);
  });
});

// --- Golden Prompt Fixtures (Full Pipeline) ---

describe("runRewritePipeline — golden fixtures", () => {
  it("golden: short coding prompt", () => {
    const result = runRewritePipeline({
      prompt: "fix bug",
      mode: "enhance",
      preset: { intent: "coding" },
    });
    expect(result.enhanced_prompt).toContain("software engineer");
    expect(result.enhanced_prompt).toContain("fix bug");
    expect(result.score.confidence).toBeLessThan(60);
    expect(result.clarifying_question).toBeDefined();
    expect(result.detected_intent).toBe("coding");
  });

  it("golden: detailed writing prompt", () => {
    const result = runRewritePipeline({
      prompt: "Draft a professional blog post about the benefits of remote work for large teams, including real-world examples and practical tips",
      mode: "enhance",
      preset: { intent: "writing", tone: "professional", output_format: "step-by-step" },
    });
    expect(result.enhanced_prompt).toContain("writer");
    expect(result.score.confidence).toBeGreaterThanOrEqual(60);
    expect(result.clarifying_question).toBeUndefined();
    expect(result.changes.length).toBeGreaterThan(0);
  });

  it("golden: research prompt with expand mode", () => {
    const result = runRewritePipeline({
      prompt: "Compare React and Vue",
      mode: "expand",
      preset: { intent: "research", output_format: "bullets" },
    });
    expect(result.enhanced_prompt).toContain("research analyst");
    expect(result.enhanced_prompt).toContain("edge cases");
    expect(result.enhanced_prompt).toContain("bullet points");
    expect(result.detected_intent).toBe("research");
  });

  it("golden: career prompt with context", () => {
    const result = runRewritePipeline({
      prompt: "Help me prepare for a job interview",
      mode: "enhance",
      preset: {
        intent: "career",
        tone: "detailed",
        additional_context: "Senior frontend role at a FAANG company",
      },
    });
    expect(result.enhanced_prompt).toContain("career");
    expect(result.enhanced_prompt).toContain("Senior frontend role");
  });

  it("golden: vague prompt triggers clarifying question", () => {
    const result = runRewritePipeline({
      prompt: "stuff",
      mode: "enhance",
    });
    expect(result.score.confidence).toBeLessThan(60);
    expect(result.clarifying_question).toBeDefined();
    expect(result.warnings.length).toBeGreaterThanOrEqual(0);
  });

  it("golden: prompt with sensitive content warns", () => {
    const result = runRewritePipeline({
      prompt: "My password is hunter2 and I need help with login",
      mode: "enhance",
    });
    expect(result.warnings.some((w) => w.includes("sensitive"))).toBe(true);
  });
});
