import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.mock factories are hoisted — use vi.hoisted() for shared refs
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

import { checkMcsHealth, fetchMcsContext } from "../src/lib/mcsClient.js";

// Helper: build a minimal MCS ContextPack response
function packResponse(nodes: Array<{ content: string; label?: string; type?: string }>) {
    return {
        ok: true,
        json: async () => ({
            version: "1.0",
            target: "claude",
            graph: {
                nodes: nodes.map((n, i) => ({
                    id: `node-${i}`,
                    type: n.type ?? "Task",
                    label: n.label ?? `Label ${i}`,
                    content: n.content,
                    provenance: { truthTier: "EXTRACTED", derivedFromEventIds: [] },
                    createdAt: "2026-01-01",
                    updatedAt: "2026-01-01",
                })),
                edges: [],
                stats: { totalNodes: nodes.length, totalEdges: 0 },
            },
            meta: { selectedNodes: nodes.length, droppedNodes: 0, budgetRespected: true },
        }),
    };
}

describe("checkMcsHealth", () => {
    beforeEach(() => { mockFetch.mockReset(); mockLogger.info.mockClear(); mockLogger.warn.mockClear(); });

    it("returns true when daemon responds ok", async () => {
        mockFetch.mockResolvedValue({ ok: true, json: async () => ({ status: "ok" }) });
        expect(await checkMcsHealth()).toBe(true);
        expect(mockFetch.mock.calls[0]![0]).toBe("http://localhost:4040/health");
    });

    it("returns false on non-200", async () => {
        mockFetch.mockResolvedValue({ ok: false, status: 500 });
        expect(await checkMcsHealth()).toBe(false);
    });

    it("returns false on connection refused", async () => {
        mockFetch.mockRejectedValue(new TypeError("fetch failed"));
        expect(await checkMcsHealth()).toBe(false);
        expect(mockLogger.warn).toHaveBeenCalled();
    });

    it("returns false on timeout", async () => {
        mockFetch.mockRejectedValue(new DOMException("aborted", "AbortError"));
        expect(await checkMcsHealth()).toBe(false);
    });
});

describe("fetchMcsContext", () => {
    beforeEach(() => { mockFetch.mockReset(); mockLogger.info.mockClear(); mockLogger.warn.mockClear(); mockLogger.debug.mockClear(); });

    it("returns structured context from graph nodes", async () => {
        mockFetch.mockResolvedValue(packResponse([
            { content: "TypeScript patterns", type: "Knowledge" },
            { content: "Express middleware", type: "Artifact" },
        ]));

        const result = await fetchMcsContext({ prompt: "Write TS code", site: "claude" });
        expect(result).not.toBeNull();
        expect(result!.source).toBe("mcs-daemon");
        expect(result!.target).toBe("claude");
        expect(result!.itemCount).toBe(2);
        expect(result!.items[0]!.nodeType).toBe("Knowledge");
        expect(result!.contextSnippet).toContain("TypeScript patterns");
    });

    it("maps chatgpt site to gpt target", async () => {
        mockFetch.mockResolvedValue(packResponse([{ content: "ctx" }]));
        await fetchMcsContext({ prompt: "test", site: "chatgpt" });
        const url = mockFetch.mock.calls[0]![0] as string;
        expect(url).toContain("target=gpt");
    });

    it("maps gemini site to gemini target", async () => {
        mockFetch.mockResolvedValue(packResponse([{ content: "ctx" }]));
        await fetchMcsContext({ prompt: "test", site: "gemini" });
        const url = mockFetch.mock.calls[0]![0] as string;
        expect(url).toContain("target=gemini");
    });

    it("defaults to claude when no site/target specified", async () => {
        mockFetch.mockResolvedValue(packResponse([{ content: "ctx" }]));
        await fetchMcsContext({ prompt: "test" });
        const url = mockFetch.mock.calls[0]![0] as string;
        expect(url).toContain("target=claude");
    });

    it("returns null when contextMode is off", async () => {
        expect(await fetchMcsContext({ prompt: "test", contextMode: "off" })).toBeNull();
        expect(mockFetch).not.toHaveBeenCalled();
    });

    it("returns null when graph has no nodes", async () => {
        mockFetch.mockResolvedValue({
            ok: true,
            json: async () => ({ graph: { nodes: [], edges: [], stats: {} }, meta: {} }),
        });
        expect(await fetchMcsContext({ prompt: "test" })).toBeNull();
    });

    it("returns null on timeout and logs fallback", async () => {
        mockFetch.mockRejectedValue(new DOMException("aborted", "AbortError"));
        expect(await fetchMcsContext({ prompt: "test" })).toBeNull();
        const warns = mockLogger.warn.mock.calls.map((c: unknown[]) => JSON.stringify(c));
        expect(warns.some((w: string) => w.includes("timed out"))).toBe(true);
    });

    it("returns null on connection refused", async () => {
        mockFetch.mockRejectedValue(new TypeError("fetch failed"));
        expect(await fetchMcsContext({ prompt: "test" })).toBeNull();
    });

    it("returns null on non-200 response", async () => {
        mockFetch.mockResolvedValue({ ok: false, status: 400 });
        expect(await fetchMcsContext({ prompt: "test" })).toBeNull();
    });

    it("respects MCS_MAX_ITEMS cap", async () => {
        const manyNodes = Array.from({ length: 20 }, (_, i) => ({ content: `Node ${i}` }));
        mockFetch.mockResolvedValue(packResponse(manyNodes));
        const result = await fetchMcsContext({ prompt: "test" });
        expect(result!.items.length).toBeLessThanOrEqual(10);
    });

    it("passes conversationId and sourceApp in query params", async () => {
        mockFetch.mockResolvedValue(packResponse([{ content: "ctx" }]));
        await fetchMcsContext({ prompt: "test", conversationId: "c-1", sourceApp: "ext" });
        const url = mockFetch.mock.calls[0]![0] as string;
        expect(url).toContain("conversationId=c-1");
        expect(url).toContain("sourceApp=ext");
    });

    it("sets truncated=true when content exceeds budget", async () => {
        const bigNodes = Array.from({ length: 5 }, (_, i) => ({ content: `${"x".repeat(1500)}` }));
        mockFetch.mockResolvedValue(packResponse(bigNodes));
        const result = await fetchMcsContext({ prompt: "test" });
        expect(result!.truncated).toBe(true);
        expect(result!.snippetLength).toBeLessThanOrEqual(4000);
    });

    it("truncates task param to 200 chars", async () => {
        mockFetch.mockResolvedValue(packResponse([{ content: "ctx" }]));
        await fetchMcsContext({ prompt: "a".repeat(500) });
        const url = mockFetch.mock.calls[0]![0] as string;
        const match = url.match(/task=([^&]*)/);
        expect(decodeURIComponent(match![1]!).length).toBe(200);
    });

    it("logs MCS URL being called", async () => {
        mockFetch.mockResolvedValue(packResponse([{ content: "ctx" }]));
        await fetchMcsContext({ prompt: "test" });
        const infos = mockLogger.info.mock.calls.map((c: unknown[]) => JSON.stringify(c));
        expect(infos.some((i: string) => i.includes("http://localhost:4040"))).toBe(true);
    });
});
