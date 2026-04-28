import { describe, it, expect } from "vitest";
import {
  validateRewrite,
  buildDeterministicRewrite,
} from "../src/lib/rewriteValidator.js";

// ---------------------------------------------------------------------------
// validateRewrite — accepts good rewrites
// ---------------------------------------------------------------------------
describe("validateRewrite — accepts valid optimized prompts", () => {
  it("accepts a typical user-voice rewrite", () => {
    const out =
      "How can I further optimize my code? Please suggest practical improvements for performance, readability, maintainability, and reliability, and point out which changes would have the biggest impact.";
    expect(validateRewrite(out, "now how can i optimize the code more").ok).toBe(true);
  });

  it("accepts an Act-as rewrite", () => {
    const out =
      "Act as a senior TypeScript developer reviewing my code. Suggest the highest-impact refactors with brief reasoning.";
    expect(validateRewrite(out, "review my code").ok).toBe(true);
  });

  it("accepts a Help-me rewrite", () => {
    const out =
      "Help me debug a NullPointerException in my checkout flow. Here is the stack trace and the relevant handler. Walk me through the most likely causes.";
    expect(validateRewrite(out, "fix this bug").ok).toBe(true);
  });

  it("accepts a 'What is the best…' question (user-voice fact request)", () => {
    const out =
      "What is the best approach to caching in a TypeScript Express API, with examples for Redis and in-memory variants?";
    expect(validateRewrite(out, "caching strategy").ok).toBe(true);
  });

  it("strips wrapper tags before validation", () => {
    const out =
      "<prompt_to_optimize>Help me refactor this function for readability.</prompt_to_optimize>";
    expect(validateRewrite(out, "refactor this").ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// validateRewrite — rejects answer-mode openers
// ---------------------------------------------------------------------------
describe("validateRewrite — rejects assistant-style answer openers", () => {
  it("rejects 'Sure, send it over'", () => {
    const v = validateRewrite("Sure, send it over.", "can you explain this");
    expect(v.ok).toBe(false);
    expect(v.reason).toContain("answer_opener");
  });

  it("rejects 'I can help with that'", () => {
    const v = validateRewrite(
      "I can help you debug this. Paste your code below.",
      "fix this bug"
    );
    expect(v.ok).toBe(false);
    expect(v.reason).toContain("answer_opener");
  });

  it("rejects 'Here's how…'", () => {
    const v = validateRewrite(
      "Here's how to optimize: use a more efficient algorithm and cache results.",
      "optimize this"
    );
    expect(v.ok).toBe(false);
    expect(v.reason).toContain("answer_opener");
  });

  it("rejects 'To set up X you'll need…' tutorial start", () => {
    const v = validateRewrite(
      "To set up the VFX pipeline, install the dependencies and configure the renderer.",
      "help with vfx"
    );
    expect(v.ok).toBe(false);
    expect(v.reason).toContain("answer_opener");
  });

  it("rejects 'You should…' direct advice", () => {
    const v = validateRewrite(
      "You should profile your code and use better data structures.",
      "make my code faster"
    );
    expect(v.ok).toBe(false);
    expect(v.reason).toContain("answer_opener");
  });

  it("rejects 'Let me explain'", () => {
    const v = validateRewrite("Let me walk you through this.", "explain X");
    expect(v.ok).toBe(false);
    expect(v.reason).toContain("answer_opener");
  });

  it("rejects 'Great question!'", () => {
    const v = validateRewrite("Great question! Here's how I'd think about it.", "X");
    expect(v.ok).toBe(false);
    expect(v.reason).toContain("answer_opener");
  });

  it("rejects 'First, install…' instructional start", () => {
    const v = validateRewrite(
      "First, install the package. Second, import it. Third, call it.",
      "help"
    );
    expect(v.ok).toBe(false);
    expect(v.reason).toContain("answer_opener");
  });
});

// ---------------------------------------------------------------------------
// validateRewrite — rejects clarification questions to the user
// ---------------------------------------------------------------------------
describe("validateRewrite — rejects clarification questions to the user", () => {
  it("rejects the canonical bug-class output", () => {
    const out =
      "What specific area of the codebase do you want to optimize — backend performance, extension bundle size, API response time, database queries, or something else? Provide the relevant code or describe the current bottleneck you're seeing.";
    const v = validateRewrite(out, "now how can i optimize the code more");
    expect(v.ok).toBe(false);
    expect(v.reason).toContain("clarification");
  });

  it("rejects 'Could you clarify…'", () => {
    const v = validateRewrite("Could you clarify what you mean by 'better'?", "make this better");
    expect(v.ok).toBe(false);
    expect(v.reason).toContain("clarification");
  });

  it("rejects 'Do you mean X or Y?'", () => {
    const v = validateRewrite("Do you mean refactoring for readability or performance?", "improve");
    expect(v.ok).toBe(false);
    expect(v.reason).toContain("clarification");
  });

  it("rejects 'Are you asking about X?'", () => {
    const v = validateRewrite("Are you asking about React or Vue?", "frontend question");
    expect(v.ok).toBe(false);
    expect(v.reason).toContain("clarification");
  });

  it("rejects 'Please clarify…' / 'Please specify…'", () => {
    const v = validateRewrite("Please clarify which file you're referring to.", "this file");
    expect(v.ok).toBe(false);
    expect(v.reason).toContain("clarification");
  });

  it("rejects short 'Please provide the bug details' clarifier", () => {
    const v = validateRewrite(
      "Please provide the bug details, including the error message and steps to reproduce.",
      "fix this bug"
    );
    expect(v.ok).toBe(false);
    expect(v.reason).toContain("short_user_direction");
  });

  it("does NOT reject long 'Please provide a detailed analysis…' (legit AI-direction)", () => {
    const v = validateRewrite(
      "Please provide a detailed analysis of the following code, focusing on performance bottlenecks, memory usage, and any race conditions. Highlight the highest-impact fixes first and explain the reasoning behind each recommendation.",
      "analyze my code"
    );
    expect(v.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// validateRewrite — empty / whitespace
// ---------------------------------------------------------------------------
describe("validateRewrite — edge cases", () => {
  it("rejects empty output", () => {
    expect(validateRewrite("", "x").ok).toBe(false);
    expect(validateRewrite("   ", "x").ok).toBe(false);
  });

  it("rejects output that is only wrapper tags", () => {
    expect(validateRewrite("<prompt_to_optimize></prompt_to_optimize>", "x").ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// buildDeterministicRewrite — produces user-voice rewrites that pass validation
// ---------------------------------------------------------------------------
describe("buildDeterministicRewrite — safe templated fallback", () => {
  it("normalizes capitalization and bare 'i'", () => {
    const out = buildDeterministicRewrite("now how can i optimize the code more");
    expect(out.startsWith("Now how can I")).toBe(true);
    expect(out).toContain("performance");
  });

  it("appends optimization focus for optimize-class prompts", () => {
    const out = buildDeterministicRewrite("now how can i optimize the code more");
    expect(out).toMatch(/performance.*readability.*maintainability.*reliability/);
    expect(out).toMatch(/biggest impact/i);
  });

  it("appends pre-deploy checklist focus for test/push-to-main prompts", () => {
    const out = buildDeterministicRewrite(
      "how else should i test or improve before pushing to main since i have actual people using my product?"
    );
    expect(out).toMatch(/reliability.*security/i);
    expect(out).toMatch(/highest[- ]impact/i);
  });

  it("appends debug guidance for bug-class prompts", () => {
    const out = buildDeterministicRewrite("fix this bug");
    expect(out).toMatch(/error message/i);
    expect(out).toMatch(/expected.*actual/i);
  });

  it("appends explanation guidance for explain-class prompts", () => {
    const out = buildDeterministicRewrite("can you explain this");
    expect(out).toMatch(/examples/i);
    expect(out).toMatch(/pitfalls/i);
  });

  it("handles 'make this better' with a definition-of-better appendix", () => {
    const out = buildDeterministicRewrite("make this better");
    expect(out).toMatch(/clarity, performance, style/i);
    expect(out).toMatch(/concrete.*improvements/i);
  });

  it("returns a generic safe rewrite for empty input", () => {
    const out = buildDeterministicRewrite("");
    expect(out.length).toBeGreaterThan(0);
    expect(validateRewrite(out, "").ok).toBe(true);
  });

  it("every category produces a rewrite that passes validateRewrite", () => {
    const inputs = [
      "now how can i optimize the code more",
      "how else should i test or improve before pushing to main since i have actual people using my product?",
      "fix this bug",
      "make this better",
      "can you explain this",
      "rewrite this paragraph",
      "review my pull request",
      "random untyped goal",
    ];
    for (const i of inputs) {
      const out = buildDeterministicRewrite(i);
      const v = validateRewrite(out, i);
      expect(v.ok, `fallback for "${i}" should pass validator (reason: ${v.reason})`).toBe(true);
    }
  });

  it("output is in user voice (does not start with chatbot openers)", () => {
    const out = buildDeterministicRewrite("now how can i optimize the code more");
    expect(out).not.toMatch(/^(sure|of course|let me|here'?s|i can help)/i);
  });
});
