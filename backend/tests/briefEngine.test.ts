import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ConversationBrief } from "../../shared/types/index.js";

// ---------------------------------------------------------------------------
// Mock llmClient so tests never hit the network
// ---------------------------------------------------------------------------
const mockCallLlm = vi.hoisted(() => vi.fn());

vi.mock("../src/lib/llmClient.js", () => ({
  callLlm: mockCallLlm,
}));

import { extractBrief, updateBrief, prepareBriefHistory } from "../src/lib/briefEngine.js";
import { buildSystemPrompt } from "../src/lib/llmPrompts.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const sampleHistory = [
  { role: "user" as const, content: "I want to build a Chrome extension" },
  { role: "assistant" as const, content: "Great! You'll need manifest.json and a content script." },
  { role: "user" as const, content: "How do I inject a button into the page?" },
  { role: "assistant" as const, content: "Use document.createElement and appendChild." },
  { role: "user" as const, content: "Should I use Shadow DOM?" },
  { role: "assistant" as const, content: "Yes — Shadow DOM isolates your styles from the host page." },
];

const validBriefJson = JSON.stringify({
  goal: "Build a Chrome extension that injects UI into AI chat pages",
  establishedContext: [
    "Using manifest.json and content script",
    "Shadow DOM used for style isolation",
  ],
  userStyle: "Technical developer, prefers concise answers",
  activeTopic: "Shadow DOM usage for style isolation",
  avoid: ["Basic Chrome extension setup already explained"],
});

const sampleBrief: ConversationBrief = {
  goal: "Build a Chrome prompt enhancer extension",
  establishedContext: ["Uses MV3 manifest", "Shadow DOM for isolation"],
  userStyle: "Technical, concise",
  activeTopic: "Button injection into chat UI",
  avoid: ["Already covered manifest.json setup"],
  messageCount: 6,
  lastUpdatedAt: Date.now(),
};

// ---------------------------------------------------------------------------
// extractBrief tests
// ---------------------------------------------------------------------------
describe("extractBrief", () => {
  beforeEach(() => {
    mockCallLlm.mockReset();
  });

  it("returns all 5 fields populated for valid history", async () => {
    mockCallLlm.mockResolvedValueOnce({ content: validBriefJson, model: "claude-haiku" });

    const brief = await extractBrief(sampleHistory);

    expect(brief).not.toBeNull();
    expect(brief!.goal).toBeTruthy();
    expect(brief!.userStyle).toBeTruthy();
    expect(brief!.activeTopic).toBeTruthy();
    expect(Array.isArray(brief!.establishedContext)).toBe(true);
    expect(Array.isArray(brief!.avoid)).toBe(true);
    expect(brief!.messageCount).toBe(sampleHistory.length);
  });

  it("returns null when LLM is unavailable (timeout/failure)", async () => {
    mockCallLlm.mockResolvedValueOnce(null);

    const brief = await extractBrief(sampleHistory);

    expect(brief).toBeNull();
  });

  it("returns null when LLM returns invalid JSON", async () => {
    mockCallLlm.mockResolvedValueOnce({ content: "Sorry, I cannot help with that.", model: "claude-haiku" });

    const brief = await extractBrief(sampleHistory);

    expect(brief).toBeNull();
  });

  it("strips markdown fences when parsing JSON", async () => {
    const fenced = "```json\n" + validBriefJson + "\n```";
    mockCallLlm.mockResolvedValueOnce({ content: fenced, model: "claude-haiku" });

    const brief = await extractBrief(sampleHistory);

    expect(brief).not.toBeNull();
    expect(brief!.goal).toBeTruthy();
  });

  it("truncates history to last 20 messages before sending to LLM", async () => {
    // Generate 30 messages (15 pairs) — should be capped to last 20
    const longHistory: Array<{ role: "user" | "assistant"; content: string }> = [];
    for (let i = 0; i < 15; i++) {
      longHistory.push({ role: "user", content: `user message ${i + 1}` });
      longHistory.push({ role: "assistant", content: `assistant message ${i + 1}` });
    }

    mockCallLlm.mockResolvedValueOnce({ content: validBriefJson, model: "claude-haiku" });

    await extractBrief(longHistory);

    // Verify the LLM was called with truncated content
    const llmArgs = mockCallLlm.mock.calls[0]![0] as { messages: Array<{ content: string }> };
    const userContent = llmArgs.messages[0]!.content;

    // Should NOT contain the first 10 messages (indices 0-9)
    expect(userContent).not.toContain("user message 1\n");
    // Should contain the last 20 messages (indices 10-29)
    expect(userContent).toContain("user message 11");
    expect(userContent).toContain("assistant message 15");
  });

  it("truncates individual long messages in brief extraction", async () => {
    const longMessage = "x".repeat(1000);
    const history = [
      { role: "user" as const, content: longMessage },
      { role: "assistant" as const, content: "short reply" },
    ];

    mockCallLlm.mockResolvedValueOnce({ content: validBriefJson, model: "claude-haiku" });

    await extractBrief(history);

    const llmArgs = mockCallLlm.mock.calls[0]![0] as { messages: Array<{ content: string }> };
    const userContent = llmArgs.messages[0]!.content;

    // 500 chars + "… [truncated]" = 514 chars max per message, not the full 1000
    expect(userContent).not.toContain("x".repeat(600));
    expect(userContent).toContain("[truncated]");
  });
});

// ---------------------------------------------------------------------------
// prepareBriefHistory tests
// ---------------------------------------------------------------------------
describe("prepareBriefHistory", () => {
  it("returns all messages when under cap", () => {
    const result = prepareBriefHistory(sampleHistory);
    expect(result).toHaveLength(sampleHistory.length);
  });

  it("caps at 20 messages using the most recent", () => {
    const longHistory: Array<{ role: "user" | "assistant"; content: string }> = [];
    for (let i = 0; i < 15; i++) {
      longHistory.push({ role: "user", content: `user ${i + 1}` });
      longHistory.push({ role: "assistant", content: `assistant ${i + 1}` });
    }
    // 30 messages → should cap to last 20
    const result = prepareBriefHistory(longHistory);
    expect(result).toHaveLength(20);
    // First message should be user message 6 (index 10 of the original 30)
    expect(result[0]!.content).toBe("user 6");
  });

  it("truncates individual messages exceeding 500 chars", () => {
    const history = [
      { role: "user" as const, content: "a".repeat(600) },
      { role: "assistant" as const, content: "short" },
    ];
    const result = prepareBriefHistory(history);
    expect(result[0]!.content.length).toBeLessThan(600);
    expect(result[0]!.content).toContain("[truncated]");
    // Short message unchanged
    expect(result[1]!.content).toBe("short");
  });
});

// ---------------------------------------------------------------------------
// updateBrief tests
// ---------------------------------------------------------------------------
describe("updateBrief", () => {
  beforeEach(() => {
    mockCallLlm.mockReset();
  });

  it("returns updated brief with incremented messageCount", async () => {
    const newMessages = [
      { role: "user" as const, content: "How do I debug the extension?" },
      { role: "assistant" as const, content: "Use chrome://extensions and the devtools." },
    ];

    const updatedJson = JSON.stringify({
      ...sampleBrief,
      activeTopic: "Debugging Chrome extensions",
      avoid: [...sampleBrief.avoid, "Debugging via chrome://extensions explained"],
    });

    mockCallLlm.mockResolvedValueOnce({ content: updatedJson, model: "claude-haiku" });

    const result = await updateBrief(sampleBrief, newMessages);

    expect(result.messageCount).toBe(sampleBrief.messageCount + newMessages.length);
    expect(result.activeTopic).toBe("Debugging Chrome extensions");
  });

  it("returns currentBrief unchanged when LLM fails", async () => {
    mockCallLlm.mockResolvedValueOnce(null);

    const result = await updateBrief(sampleBrief, [
      { role: "user" as const, content: "new question" },
    ]);

    expect(result).toEqual(sampleBrief);
  });

  it("returns currentBrief unchanged when LLM returns malformed JSON", async () => {
    mockCallLlm.mockResolvedValueOnce({ content: "not json at all", model: "claude-haiku" });

    const result = await updateBrief(sampleBrief, [
      { role: "user" as const, content: "new question" },
    ]);

    expect(result).toEqual(sampleBrief);
  });
});

// ---------------------------------------------------------------------------
// buildSystemPrompt tests (brief integration)
// ---------------------------------------------------------------------------
describe("buildSystemPrompt", () => {
  it("includes goal and avoid list when brief is provided", () => {
    const system = buildSystemPrompt(sampleHistory, "chatgpt", sampleBrief, 10);

    expect(system).toContain(sampleBrief.goal);
    expect(system).toContain(sampleBrief.avoid[0]!);
    expect(system).toContain("CONVERSATION BRIEF");
    expect(system).toContain("ChatGPT");
  });

  it("does not include raw history block when brief is provided", () => {
    const system = buildSystemPrompt(sampleHistory, "claude", sampleBrief, 10);

    // Brief mode: should NOT include the raw "Conversation so far:" block
    expect(system).not.toContain("Conversation so far:");
  });

  it("uses raw history block when no brief is provided", () => {
    const system = buildSystemPrompt(sampleHistory, "gemini");

    expect(system).toContain("CONVERSATION HISTORY");
    expect(system).not.toContain("CONVERSATION BRIEF");
    expect(system).toContain("Gemini");
  });

  it("uses cold-start message when history is empty and no brief", () => {
    const system = buildSystemPrompt([], "chatgpt");

    expect(system).toContain("No prior context");
    expect(system).toContain("ChatGPT");
  });

  it("includes recent exchanges block from history in brief mode (messageCount < 20)", () => {
    const system = buildSystemPrompt(sampleHistory, "claude", sampleBrief, 10);

    // Should include last messages for immediate continuity
    expect(system).toContain("Most recent exchange:");
  });

  it("excludes recent exchanges when messageCount >= 20 (brief-only mode)", () => {
    const longBrief: ConversationBrief = { ...sampleBrief, messageCount: 22 };
    const system = buildSystemPrompt(sampleHistory, "claude", longBrief, 22);

    expect(system).toContain(longBrief.goal);
    expect(system).not.toContain("Most recent exchange:");
    expect(system).toContain("Optimize for continuity");
  });
});
