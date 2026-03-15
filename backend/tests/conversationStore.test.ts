import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock chrome.storage.session
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
} from "../../extension/src/lib/conversationStore.js";

const CONV_ID = "test-conv";

describe("conversationStore", () => {
  beforeEach(() => {
    // Reset storage between tests
    for (const key of Object.keys(mockStorage)) {
      delete mockStorage[key];
    }
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
    // Add 21 pairs
    for (let i = 0; i < 21; i++) {
      await appendUserMessage(CONV_ID, `user msg ${i}`);
      await appendAssistantMessage(CONV_ID, `assistant msg ${i}`);
    }

    const history = await getHistory(CONV_ID);
    expect(history.length).toBeLessThanOrEqual(40);

    // Oldest (pair 0) should have been dropped; pair 1 should be first
    expect(history[0]).toMatchObject({ content: "user msg 1" });
    // Newest (pair 20) should be last
    expect(history[history.length - 1]).toMatchObject({ content: "assistant msg 20" });
  });
});
