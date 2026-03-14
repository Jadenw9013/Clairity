import { describe, it, expect, vi, beforeEach } from "vitest";

const mockLogger = vi.hoisted(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
}));

const mockFetch = vi.hoisted(() => vi.fn());

vi.mock("../src/lib/featureFlags.js", () => ({
    MCS_ENABLED: true,
    MCS_BASE_URL: "http://localhost:4040",
    MCS_CONTEXT_MODE: "auto" as const,
    MCS_TIMEOUT_MS: 2000,
    MCS_MAX_ITEMS: 10,
    MCS_MAX_CONTEXT_TOKENS: 4000,
    MCS_PINNED_CATEGORIES: [],
}));

vi.mock("../src/lib/logger.js", () => ({ logger: mockLogger }));
vi.stubGlobal("fetch", mockFetch);

import { fetchMcsContext } from "../src/lib/mcsClient.js";

describe("fetchMcsContext integration edge cases", () => {
    beforeEach(() => {
        mockFetch.mockReset();
        mockLogger.info.mockClear();
        mockLogger.warn.mockClear();
        mockLogger.debug.mockClear();
    });

    it("handles malformed JSON response gracefully", async () => {
        mockFetch.mockResolvedValue({
            ok: true,
            json: () => Promise.reject(new Error("Invalid JSON")),
        });

        const result = await fetchMcsContext({ prompt: "test" });
        expect(result).toBeNull();
        expect(mockLogger.warn).toHaveBeenCalledWith(
            expect.objectContaining({ url: expect.stringContaining("/pack") }),
            expect.stringContaining("MCS request failed")
        );
    });

    it("handles unexpected JSON structure (not an object)", async () => {
        mockFetch.mockResolvedValue({
            ok: true,
            json: async () => ["not", "an", "object"],
        });

        const result = await fetchMcsContext({ prompt: "test" });
        expect(result).toBeNull();
    });

    it("handles missing graph property", async () => {
        mockFetch.mockResolvedValue({
            ok: true,
            json: async () => ({ version: "1.0" }), // missing graph
        });

        const result = await fetchMcsContext({ prompt: "test" });
        expect(result).toBeNull();
    });

    it("handles graph property that is not an object", async () => {
        mockFetch.mockResolvedValue({
            ok: true,
            json: async () => ({ graph: "not-an-object" }),
        });

        const result = await fetchMcsContext({ prompt: "test" });
        expect(result).toBeNull();
    });

    it("handles nodes property that is not an array", async () => {
        mockFetch.mockResolvedValue({
            ok: true,
            json: async () => ({ graph: { nodes: "not-an-array" } }),
        });

        const result = await fetchMcsContext({ prompt: "test" });
        expect(result).toBeNull();
    });

    it("handles nodes with missing content and label", async () => {
        mockFetch.mockResolvedValue({
            ok: true,
            json: async () => ({
                graph: {
                    nodes: [
                        { id: "1" }, // no content or label
                    ],
                },
            }),
        });

        const result = await fetchMcsContext({ prompt: "test" });
        expect(result).toBeNull();
    });

    it("handles nodes with only labels", async () => {
        mockFetch.mockResolvedValue({
            ok: true,
            json: async () => ({
                graph: {
                    nodes: [
                        { id: "1", label: "Just a label" },
                    ],
                },
            }),
        });

        const result = await fetchMcsContext({ prompt: "test" });
        expect(result).not.toBeNull();
        expect(result!.contextSnippet).toBe("Just a label");
    });
});
