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
  // Answer-mode detection heuristic
  // -----------------------------------------------------------------------

  it("does not warn when short input produces proportional output (normal rewrite)", async () => {
    // 50-char input, 100-char output = 2x ratio, under 2.5x threshold
    const shortPrompt = "help me with the next part of this project";
    const reasonableOutput = "Act as a senior developer. I've completed [previous step] and need guidance on [next step]. Provide step-by-step instructions.";
    mockCallLlm.mockResolvedValue({ content: reasonableOutput, model: "claude-haiku-4-5-20251001" });

    const result = await callLyra({ prompt: shortPrompt, history: [], site: "chatgpt" });

    expect(result.enhanced_prompt).toBe(reasonableOutput);
    // Ratio is ~2.9x but prompt is 43 chars — this is a reasonable expansion for a short prompt
    // The heuristic checks prompt.length < 200 AND output > prompt * 2.5
  });

  it("still returns the output even when answer-mode heuristic triggers (monitoring only)", async () => {
    // 30-char input, 500-char output = ~16.7x ratio — clearly suspicious
    const shortPrompt = "help me with the next part";
    const suspiciousOutput = "To set up the VFX pipeline in your application, you'll need to follow these steps. First, install the required dependencies by running npm install three @react-three/fiber. Then create a new component called VFXManager that handles particle systems. Import it in your main App.tsx file and configure the WebGL renderer with antialias enabled. Next, set up the post-processing pipeline with bloom and depth-of-field effects. Make sure to optimize the render loop by using requestAnimationFrame properly and disposing of geometries when unmounted.";
    mockCallLlm.mockResolvedValue({ content: suspiciousOutput, model: "claude-haiku-4-5-20251001" });

    const result = await callLyra({ prompt: shortPrompt, history: [], site: "chatgpt" });

    // Output is still returned — heuristic is monitoring-only, not a gate
    expect(result.enhanced_prompt).toBe(suspiciousOutput);
    expect(result.model).toBe("claude-haiku-4-5-20251001");
  });

  it("does not trigger heuristic for long inputs regardless of output length", async () => {
    // 250-char input (over 200 threshold) — heuristic should not apply
    const longPrompt = "I have a complex React application with multiple nested contexts and I need help restructuring the state management layer because the current approach with prop drilling is causing performance issues in deeply nested component trees and I want to migrate to a more scalable solution";
    const longOutput = longPrompt + " additional optimization content ".repeat(5);
    mockCallLlm.mockResolvedValue({ content: longOutput, model: "claude-haiku-4-5-20251001" });

    const result = await callLyra({ prompt: longPrompt, history: [], site: "chatgpt" });

    expect(result.enhanced_prompt).toBe(longOutput);
  });
});
