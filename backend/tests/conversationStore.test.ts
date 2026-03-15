import { describe, it, expect, beforeEach, vi } from "vitest";
import type { ConversationBrief } from "../../shared/types/index.js";

// ---------------------------------------------------------------------------
// Mock chrome.storage.session
// ---------------------------------------------------------------------------
const mockStorage: Record<string, unknown> = {};
const chromeMock = {
  storage: {
    session: {
      get: vi.fn(async (key: string) => ({ [key]: mockStorage[key] })),
      set: vi.fn(async (data: Record<string, unknown>) => {
        Object.assign(mockStorage, data);
      }),
    },
  },
};

vi.stubGlobal("chrome", chromeMock);

import {
  getHistory,
  appendUserMessage,
  appendAssistantMessage,
  getBrief,
  setBrief,
  shouldExtractBrief,
  shouldUpdateBrief,
} from "../../extension/src/lib/conversationStore.js";

const CONV_ID = "test-conv";

const makeBrief = (messageCount: number): ConversationBrief => ({
  goal: "Build a Chrome extension",
  establishedContext: ["Uses Shadow DOM"],
  userStyle: "Technical, concise",
  activeTopic: "Button injection",
  avoid: ["manifest.json setup explained"],
  messageCount,
  lastUpdatedAt: Date.now(),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function addMessages(n: number): Promise<void> {
  for (let i = 0; i < n; i++) {
    await appendUserMessage(CONV_ID, `user msg ${i}`);
    await appendAssistantMessage(CONV_ID, `assistant msg ${i}`);
  }
}

// ---------------------------------------------------------------------------
// Existing history tests (preserved)
// ---------------------------------------------------------------------------
describe("conversationStore — history", () => {
  beforeEach(() => {
    for (const key of Object.keys(mockStorage)) delete mockStorage[key];
    chromeMock.storage.session.get.mockClear();
    chromeMock.storage.session.set.mockClear();
  });

  it("returns empty array for unknown conversationId", async () => {
    const history = await getHistory(CONV_ID);
    expect(history).toEqual([]);
  });

  it("stores a user+assistant pair correctly", async () => {
    await appendUserMessage(CONV_ID, "explain closures");
    await appendAssistantMessage(CONV_ID, "A closure captures its lexical scope.");

    const history = await getHistory(CONV_ID);
    expect(history).toHaveLength(2);
    expect(history[0]).toEqual({ role: "user", content: "explain closures" });
    expect(history[1]).toEqual({ role: "assistant", content: "A closure captures its lexical scope." });
  });

  it("caps at 20 pairs (40 messages) by dropping oldest pair first", async () => {
    for (let i = 0; i < 21; i++) {
      await appendUserMessage(CONV_ID, `user msg ${i}`);
      await appendAssistantMessage(CONV_ID, `assistant msg ${i}`);
    }

    const history = await getHistory(CONV_ID);
    expect(history.length).toBeLessThanOrEqual(40);
    expect(history[0]).toMatchObject({ content: "user msg 1" });
    expect(history[history.length - 1]).toMatchObject({ content: "assistant msg 20" });
  });
});

// ---------------------------------------------------------------------------
// Brief storage tests
// ---------------------------------------------------------------------------
describe("conversationStore — brief storage", () => {
  beforeEach(() => {
    for (const key of Object.keys(mockStorage)) delete mockStorage[key];
  });

  it("getBrief returns null when no brief stored", async () => {
    const brief = await getBrief(CONV_ID);
    expect(brief).toBeNull();
  });

  it("setBrief and getBrief round-trip correctly", async () => {
    const brief = makeBrief(10);
    await setBrief(CONV_ID, brief);

    const retrieved = await getBrief(CONV_ID);
    expect(retrieved).toEqual(brief);
  });

  it("setBrief atomically replaces existing brief", async () => {
    await setBrief(CONV_ID, makeBrief(6));
    const updated = makeBrief(10);
    updated.goal = "Updated goal";
    await setBrief(CONV_ID, updated);

    const retrieved = await getBrief(CONV_ID);
    expect(retrieved!.goal).toBe("Updated goal");
    expect(retrieved!.messageCount).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// shouldExtractBrief tests
// ---------------------------------------------------------------------------
describe("conversationStore — shouldExtractBrief", () => {
  beforeEach(() => {
    for (const key of Object.keys(mockStorage)) delete mockStorage[key];
  });

  it("returns false when messageCount < 6", async () => {
    await addMessages(2); // 4 messages total
    expect(await shouldExtractBrief(CONV_ID)).toBe(false);
  });

  it("returns false when messageCount is exactly 5 messages", async () => {
    // 2 pairs = 4 messages, add one more user message = 5
    await addMessages(2);
    await appendUserMessage(CONV_ID, "one more");
    expect(await shouldExtractBrief(CONV_ID)).toBe(false);
  });

  it("returns true at exactly 6 messages (3 pairs) with no brief", async () => {
    await addMessages(3); // 6 messages
    expect(await shouldExtractBrief(CONV_ID)).toBe(true);
  });

  it("returns false when brief already exists (even at 6+ messages)", async () => {
    await addMessages(3);
    await setBrief(CONV_ID, makeBrief(6));
    expect(await shouldExtractBrief(CONV_ID)).toBe(false);
  });

  it("returns true at 8+ messages with no brief", async () => {
    await addMessages(5); // 10 messages
    expect(await shouldExtractBrief(CONV_ID)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// shouldUpdateBrief tests
// ---------------------------------------------------------------------------
describe("conversationStore — shouldUpdateBrief", () => {
  beforeEach(() => {
    for (const key of Object.keys(mockStorage)) delete mockStorage[key];
  });

  it("returns false when no brief exists", async () => {
    await addMessages(5);
    expect(await shouldUpdateBrief(CONV_ID)).toBe(false);
  });

  it("returns false immediately after brief creation (no new messages)", async () => {
    await addMessages(3); // 6 messages
    await setBrief(CONV_ID, makeBrief(6)); // brief covers all 6
    expect(await shouldUpdateBrief(CONV_ID)).toBe(false);
  });

  it("returns true when 4 new messages added after brief creation", async () => {
    await addMessages(3); // 6 messages
    await setBrief(CONV_ID, makeBrief(6));
    await addMessages(2); // 4 more messages (2 pairs)
    expect(await shouldUpdateBrief(CONV_ID)).toBe(true);
  });

  it("returns false when only 2 new messages added after brief creation", async () => {
    await addMessages(3); // 6 messages
    await setBrief(CONV_ID, makeBrief(6));
    await addMessages(1); // 2 more messages
    expect(await shouldUpdateBrief(CONV_ID)).toBe(false);
  });

  it("returns true every 4 messages after brief is active", async () => {
    await addMessages(3); // 6 messages
    await setBrief(CONV_ID, makeBrief(6));

    // 4 more messages — should update
    await addMessages(2);
    expect(await shouldUpdateBrief(CONV_ID)).toBe(true);

    // Simulate brief update (now covers 10 messages)
    await setBrief(CONV_ID, makeBrief(10));

    // 4 more (14 total) — should update again
    await addMessages(2);
    expect(await shouldUpdateBrief(CONV_ID)).toBe(true);
  });
});
