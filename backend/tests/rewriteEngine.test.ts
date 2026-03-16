import { describe, it, expect, vi, beforeEach } from "vitest";

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

import { callLyra } from "../src/lib/rewriteEngine.js";

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
    expect(llmArgs.messages[0]).toMatchObject({ role: "user", content: "explain closures" });
  });

  it("forwards non-empty history to the LLM call", async () => {
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
    expect(llmArgs.messages[2]).toMatchObject({ role: "user", content: "give me a code example" });
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
});
