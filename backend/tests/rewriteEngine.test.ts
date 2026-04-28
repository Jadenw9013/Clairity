import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ConversationBrief } from "../../shared/types/index.js";

// Hoist mocks before module import
const mockCallLlm = vi.hoisted(() => vi.fn());
const mockBuildSystemPrompt = vi.hoisted(() => vi.fn(() => "system-prompt"));

vi.mock("../src/lib/llmClient.js", () => ({
  callLlm: mockCallLlm,
}));

vi.mock("../src/lib/llmPrompts.js", () => ({
  buildSystemPrompt: mockBuildSystemPrompt,
  LYRA_SYSTEM_PROMPT: "lyra",
}));

import { callLyra, trimHistory } from "../src/lib/rewriteEngine.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Generate N message pairs (user + assistant) */
function generateHistory(pairs: number) {
  const messages: Array<{ role: "user" | "assistant"; content: string }> = [];
  for (let i = 0; i < pairs; i++) {
    messages.push({ role: "user", content: `user message ${i + 1}` });
    messages.push({ role: "assistant", content: `assistant message ${i + 1}` });
  }
  return messages;
}

const sampleBrief: ConversationBrief = {
  goal: "Build a Chrome extension",
  establishedContext: ["Uses MV3"],
  userStyle: "Technical",
  activeTopic: "Button injection",
  avoid: ["Manifest setup"],
  messageCount: 10,
  lastUpdatedAt: Date.now(),
};

// ---------------------------------------------------------------------------
// trimHistory tests
// ---------------------------------------------------------------------------
describe("trimHistory", () => {
  it("returns full history when no brief and count < 20", () => {
    const history = generateHistory(4); // 8 messages
    const trimmed = trimHistory(history, undefined);
    expect(trimmed).toHaveLength(8);
  });

  it("returns last 4 messages when brief active and count 6–19", () => {
    const history = generateHistory(8); // 16 messages
    const brief = { ...sampleBrief, messageCount: 16 };
    const trimmed = trimHistory(history, brief);
    expect(trimmed).toHaveLength(4);
    expect(trimmed[0]!.content).toBe("user message 7"); // last 2 pairs
  });

  it("returns empty array when brief active and count >= 20", () => {
    const history = generateHistory(12); // 24 messages
    const brief = { ...sampleBrief, messageCount: 24 };
    const trimmed = trimHistory(history, brief);
    expect(trimmed).toHaveLength(0);
  });

  it("returns last 8 messages when no brief and count >= 20", () => {
    const history = generateHistory(12); // 24 messages
    const trimmed = trimHistory(history, undefined);
    expect(trimmed).toHaveLength(8);
    expect(trimmed[0]!.content).toBe("user message 9"); // last 4 pairs
  });
});

// ---------------------------------------------------------------------------
// callLyra tests
// ---------------------------------------------------------------------------
describe("callLyra", () => {
  beforeEach(() => {
    mockCallLlm.mockReset();
    mockBuildSystemPrompt.mockReset();
    mockBuildSystemPrompt.mockReturnValue("system-prompt");
  });

  it("returns enhanced prompt when LLM succeeds with empty history", async () => {
    mockCallLlm.mockResolvedValue({ content: "Optimized prompt", model: "claude-3-haiku-20240307" });

    const result = await callLyra({ prompt: "explain closures", history: [], site: "claude" });

    expect(result.enhanced_prompt).toBe("Optimized prompt");
    expect(result.model).toBe("claude-3-haiku-20240307");

    // Verify history array was forwarded to the LLM call
    const llmArgs = mockCallLlm.mock.calls[0]![0] as { messages: unknown[] };
    expect(llmArgs.messages).toHaveLength(1); // only the current prompt (no history)
    expect(llmArgs.messages[0]).toMatchObject({ role: "user", content: "<prompt_to_optimize>explain closures</prompt_to_optimize>" });
  });

  it("forwards non-empty history to the LLM call (no brief, small history)", async () => {
    mockCallLlm.mockResolvedValue({ content: "Context-aware prompt", model: "claude-3-haiku-20240307" });

    const history = [
      { role: "user" as const, content: "explain closures" },
      { role: "assistant" as const, content: "A closure captures its surrounding scope." },
    ];

    const result = await callLyra({ prompt: "give me a code example", history, site: "claude" });

    expect(result.enhanced_prompt).toBe("Context-aware prompt");

    const llmArgs = mockCallLlm.mock.calls[0]![0] as { messages: unknown[] };
    // history (2) + current prompt (1) = 3 messages
    expect(llmArgs.messages).toHaveLength(3);
    expect(llmArgs.messages[2]).toMatchObject({ role: "user", content: "<prompt_to_optimize>give me a code example</prompt_to_optimize>" });
  });

  it("returns original prompt unchanged when LLM times out (null result)", async () => {
    mockCallLlm.mockResolvedValue(null); // simulates timeout/error fallback

    const result = await callLyra({ prompt: "my original prompt", history: [], site: "chatgpt" });

    expect(result.enhanced_prompt).toBe("my original prompt");
    expect(result.model).toBe("fallback");
  });

  it("returns original prompt unchanged when ANTHROPIC_API_KEY is missing", async () => {
    // llmClient returns null when no key is set
    mockCallLlm.mockResolvedValue(null);

    const result = await callLyra({ prompt: "test prompt", history: [], site: "gemini" });

    expect(result.enhanced_prompt).toBe("test prompt");
    expect(result.model).toBe("fallback");
  });

  it("forwards x-api-key to callLlm when provided in LyraInput", async () => {
    mockCallLlm.mockResolvedValue({ content: "Enhanced", model: "claude-haiku-4-5-20251001" });

    await callLyra({ prompt: "test", history: [], site: "claude", apiKey: "sk-ant-test-key" });

    // Second arg to callLlm should be the user's api key
    const apiKeyArg = mockCallLlm.mock.calls[0]![1] as string | undefined;
    expect(apiKeyArg).toBe("sk-ant-test-key");
  });

  it("passes undefined to callLlm when no apiKey in LyraInput (env fallback)", async () => {
    mockCallLlm.mockResolvedValue({ content: "Enhanced", model: "claude-haiku-4-5-20251001" });

    await callLyra({ prompt: "test", history: [], site: "claude" });

    // Second arg should be undefined — backend uses env key
    const apiKeyArg = mockCallLlm.mock.calls[0]![1] as string | undefined;
    expect(apiKeyArg).toBeUndefined();
  });

  // -----------------------------------------------------------------------
  // 20+ message scenarios (the fix)
  // -----------------------------------------------------------------------

  it("sends only current prompt (no history messages) when brief active and 20+ messages", async () => {
    mockCallLlm.mockResolvedValue({ content: "Brief-only optimized", model: "claude-haiku-4-5-20251001" });

    const history = generateHistory(22); // 44 messages
    const brief = { ...sampleBrief, messageCount: 44 };

    const result = await callLyra({ prompt: "next question", history, site: "chatgpt", brief });

    expect(result.enhanced_prompt).toBe("Brief-only optimized");
    expect(result.model).toBe("claude-haiku-4-5-20251001");

    // Only the current prompt should be in messages — no history
    const llmArgs = mockCallLlm.mock.calls[0]![0] as { messages: unknown[] };
    expect(llmArgs.messages).toHaveLength(1);
    expect(llmArgs.messages[0]).toMatchObject({ role: "user", content: "<prompt_to_optimize>next question</prompt_to_optimize>" });
  });

  it("sends last 8 messages + current prompt when no brief and 20+ messages", async () => {
    mockCallLlm.mockResolvedValue({ content: "Fallback optimized", model: "claude-haiku-4-5-20251001" });

    const history = generateHistory(22); // 44 messages
    // No brief — simulates failed extraction

    const result = await callLyra({ prompt: "follow up", history, site: "claude" });

    expect(result.enhanced_prompt).toBe("Fallback optimized");

    const llmArgs = mockCallLlm.mock.calls[0]![0] as { messages: unknown[] };
    // 8 trimmed history + 1 current prompt = 9
    expect(llmArgs.messages).toHaveLength(9);
    expect(llmArgs.messages[8]).toMatchObject({ role: "user", content: "<prompt_to_optimize>follow up</prompt_to_optimize>" });
  });

  it("sends last 4 messages + current prompt when brief active and 6–19 messages", async () => {
    mockCallLlm.mockResolvedValue({ content: "State 2 optimized", model: "claude-haiku-4-5-20251001" });

    const history = generateHistory(8); // 16 messages
    const brief = { ...sampleBrief, messageCount: 16 };

    const result = await callLyra({ prompt: "another question", history, site: "gemini", brief });

    expect(result.enhanced_prompt).toBe("State 2 optimized");

    const llmArgs = mockCallLlm.mock.calls[0]![0] as { messages: unknown[] };
    // 4 trimmed history + 1 current prompt = 5
    expect(llmArgs.messages).toHaveLength(5);
    expect(llmArgs.messages[4]).toMatchObject({ role: "user", content: "<prompt_to_optimize>another question</prompt_to_optimize>" });
  });

  // -----------------------------------------------------------------------
  // maxTokens override for 20+ fallback
  // -----------------------------------------------------------------------

  it("passes maxTokens=800 when no brief and 20+ messages (fallback path)", async () => {
    mockCallLlm.mockResolvedValue({ content: "Fallback enhanced", model: "claude-haiku-4-5-20251001" });

    const history = generateHistory(12); // 24 messages, no brief
    await callLyra({ prompt: "test", history, site: "chatgpt" });

    const llmArgs = mockCallLlm.mock.calls[0]![0] as { maxTokens?: number };
    expect(llmArgs.maxTokens).toBe(800);
  });

  it("does not override maxTokens when brief is active at 20+ messages", async () => {
    mockCallLlm.mockResolvedValue({ content: "Brief optimized", model: "claude-haiku-4-5-20251001" });

    const history = generateHistory(12); // 24 messages
    const brief = { ...sampleBrief, messageCount: 24 };
    await callLyra({ prompt: "test", history, site: "chatgpt", brief });

    const llmArgs = mockCallLlm.mock.calls[0]![0] as { maxTokens?: number };
    expect(llmArgs.maxTokens).toBeUndefined();
  });

  it("does not override maxTokens for short conversations without brief", async () => {
    mockCallLlm.mockResolvedValue({ content: "Short enhanced", model: "claude-haiku-4-5-20251001" });

    const history = generateHistory(4); // 8 messages, no brief
    await callLyra({ prompt: "test", history, site: "chatgpt" });

    const llmArgs = mockCallLlm.mock.calls[0]![0] as { maxTokens?: number };
    expect(llmArgs.maxTokens).toBeUndefined();
  });

  // -----------------------------------------------------------------------
  // Answer-mode validator + deterministic fallback
  // -----------------------------------------------------------------------

  it("passes through valid user-voice rewrites unchanged", async () => {
    const shortPrompt = "help me with the next part of this project";
    const validRewrite =
      "Act as a senior developer. I've completed [previous step] and need guidance on [next step]. Provide step-by-step instructions.";
    mockCallLlm.mockResolvedValue({ content: validRewrite, model: "claude-haiku-4-5-20251001" });

    const result = await callLyra({ prompt: shortPrompt, history: [], site: "chatgpt" });

    expect(result.enhanced_prompt).toBe(validRewrite);
    expect(result.model).toBe("claude-haiku-4-5-20251001");
  });

  it("rejects answer-mode output and returns deterministic fallback", async () => {
    const shortPrompt = "help me with the next part";
    const tutorialAnswer =
      "To set up the VFX pipeline in your application, you'll need to follow these steps. First, install the required dependencies by running npm install three @react-three/fiber.";
    mockCallLlm.mockResolvedValue({ content: tutorialAnswer, model: "claude-haiku-4-5-20251001" });

    const result = await callLyra({ prompt: shortPrompt, history: [], site: "chatgpt" });

    // The bad LLM output is NOT shown to the user
    expect(result.enhanced_prompt).not.toBe(tutorialAnswer);
    // A deterministic fallback is returned, marked with the validator model tag
    expect(result.model).toBe("fallback-validator");
    // The fallback preserves the user's original prompt content
    expect(result.enhanced_prompt.toLowerCase()).toContain("help me with the next part");
  });

  it("does not gate long inputs on length alone (no length-based regression)", async () => {
    // 250-char input with a 1500-char rewrite — would have triggered the
    // legacy length heuristic. With the validator, only patterns matter.
    const longPrompt =
      "I have a complex React application with multiple nested contexts and I need help restructuring the state management layer because the current approach with prop drilling is causing performance issues in deeply nested component trees and I want to migrate to a more scalable solution";
    const longRewrite = longPrompt + " additional optimization content ".repeat(5);
    mockCallLlm.mockResolvedValue({ content: longRewrite, model: "claude-haiku-4-5-20251001" });

    const result = await callLyra({ prompt: longPrompt, history: [], site: "chatgpt" });

    expect(result.enhanced_prompt).toBe(longRewrite);
  });

  // -----------------------------------------------------------------------
  // Required regression cases (Cases 1–5) — Clairity must rewrite, not answer
  // -----------------------------------------------------------------------

  /**
   * Each case simulates an LLM that drifted into answer-mode and asserts that
   * Clairity replaces the bad output with the deterministic fallback. The
   * fallback must be in user voice, must NOT ask a standalone clarification
   * question, and must preserve the user's original task.
   */

  function expectGoodRewrite(actual: string, originalPrompt: string): void {
    // Must NOT start with assistant-style openers
    expect(actual).not.toMatch(/^(sure|of course|absolutely|certainly|let me|here'?s|i can help|i'?ll help)/i);
    // Must NOT be a standalone clarification question to the user
    expect(actual).not.toMatch(/^(what|which|where|when)\b.{0,80}?\b(do|did|are|were)\s+you\b/i);
    expect(actual).not.toMatch(/^(can|could) you (clarify|specify)/i);
    expect(actual).not.toMatch(/^please (clarify|specify|tell me|let me know)/i);
    // Must preserve the user's original task (substantive overlap with input)
    const sigWord = originalPrompt
      .toLowerCase()
      .split(/\s+/)
      .find((w) => w.length > 3 && !/^(this|that|with|from|some|more|been|have|just|like|need|want|please)$/.test(w));
    if (sigWord) expect(actual.toLowerCase()).toContain(sigWord);
    // Should be richer than the input (a useful prompt)
    expect(actual.length).toBeGreaterThan(originalPrompt.length);
  }

  it("Case 1: rejects 'What specific area do you want to optimize?' clarification for an optimize prompt", async () => {
    const input = "now how can i optimize the code more";
    const badOutput =
      "What specific area of the codebase do you want to optimize — backend performance, extension bundle size, API response time, database queries, or something else? Provide the relevant code or describe the current bottleneck you're seeing.";
    mockCallLlm.mockResolvedValue({ content: badOutput, model: "claude-haiku-4-5-20251001" });

    const result = await callLyra({ prompt: input, history: [], site: "chatgpt" });

    expect(result.enhanced_prompt).not.toBe(badOutput);
    expect(result.model).toBe("fallback-validator");
    expectGoodRewrite(result.enhanced_prompt, input);
    // Optimize-class fallback should mention high-impact + practical focus
    expect(result.enhanced_prompt).toMatch(/performance.*readability.*maintainability.*reliability/);
    expect(result.enhanced_prompt).toMatch(/biggest impact/i);
  });

  it("Case 2: rejects long advice-list output for the pre-deploy prompt", async () => {
    const input =
      "how else should i test or improve before pushing to main since i have actual people using my product?";
    const badOutput =
      "You should add unit tests for all critical paths. You should also run integration tests against a staging environment.";
    mockCallLlm.mockResolvedValue({ content: badOutput, model: "claude-haiku-4-5-20251001" });

    const result = await callLyra({ prompt: input, history: [], site: "chatgpt" });

    expect(result.enhanced_prompt).not.toBe(badOutput);
    expect(result.model).toBe("fallback-validator");
    expectGoodRewrite(result.enhanced_prompt, input);
    // Pre-deploy fallback should focus on reliability/security/users
    expect(result.enhanced_prompt).toMatch(/reliability.*security/i);
    // Must NOT add a senior-engineer persona
    expect(result.enhanced_prompt).not.toMatch(/senior (engineer|developer|architect)/i);
  });

  it("Case 3: rejects 'Please provide the bug details' clarification for a bug-fix prompt", async () => {
    const input = "fix this bug";
    const badOutput = "Please provide the bug details, including the error message and steps to reproduce.";
    mockCallLlm.mockResolvedValue({ content: badOutput, model: "claude-haiku-4-5-20251001" });

    const result = await callLyra({ prompt: input, history: [], site: "chatgpt" });

    expect(result.enhanced_prompt).not.toBe(badOutput);
    expect(result.model).toBe("fallback-validator");
    expectGoodRewrite(result.enhanced_prompt, input);
    // Bug-class fallback embeds the request for context inside the rewrite
    expect(result.enhanced_prompt).toMatch(/error message/i);
    expect(result.enhanced_prompt).toMatch(/expected.*actual/i);
  });

  it("Case 4: rejects 'What do you want to make better?' clarification for a 'make this better' prompt", async () => {
    const input = "make this better";
    const badOutput = "What do you want to make better — code, writing, or design? Please share more details.";
    mockCallLlm.mockResolvedValue({ content: badOutput, model: "claude-haiku-4-5-20251001" });

    const result = await callLyra({ prompt: input, history: [], site: "chatgpt" });

    expect(result.enhanced_prompt).not.toBe(badOutput);
    expect(result.model).toBe("fallback-validator");
    expectGoodRewrite(result.enhanced_prompt, input);
    // The fallback embeds the "what does 'better' mean" question in user voice
    expect(result.enhanced_prompt.toLowerCase()).toContain("better");
    expect(result.enhanced_prompt).toMatch(/clarity.*performance.*style/i);
  });

  it("Case 5: rejects 'Sure, send it over' for an explain prompt", async () => {
    const input = "can you explain this";
    const badOutput = "Sure, send it over!";
    mockCallLlm.mockResolvedValue({ content: badOutput, model: "claude-haiku-4-5-20251001" });

    const result = await callLyra({ prompt: input, history: [], site: "chatgpt" });

    expect(result.enhanced_prompt).not.toBe(badOutput);
    expect(result.model).toBe("fallback-validator");
    expectGoodRewrite(result.enhanced_prompt, input);
    // Explain-class fallback should ask the AI to explain with examples
    expect(result.enhanced_prompt).toMatch(/explain/i);
    expect(result.enhanced_prompt).toMatch(/examples/i);
  });

  // -----------------------------------------------------------------------
  // Cross-cutting assertions
  // -----------------------------------------------------------------------

  it("does not invoke the validator gate on non-LLM (null) results — preserves original prompt", async () => {
    mockCallLlm.mockResolvedValue(null);
    const result = await callLyra({ prompt: "fix this bug", history: [], site: "chatgpt" });
    // Network/key failure path: model="fallback" (NOT "fallback-validator")
    expect(result.model).toBe("fallback");
    expect(result.enhanced_prompt).toBe("fix this bug");
  });
});
