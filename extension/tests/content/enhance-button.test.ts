import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { injectEnhanceButton, buildBriefPanel } from "../../src/content/enhance-button.js";
import type { SiteAdapter, ConversationBrief } from "shared/types/index.js";

(global as any).chrome = {
    runtime: {
        sendMessage: vi.fn(),
    },
};

describe("injectEnhanceButton", () => {
    let adapter: SiteAdapter;
    let anchor: HTMLElement;
    const originalAttachShadow = HTMLElement.prototype.attachShadow;

    beforeEach(() => {
        HTMLElement.prototype.attachShadow = function (init) {
            return originalAttachShadow.call(this, { ...init, mode: "open" });
        };

        document.body.innerHTML = "";
        anchor = document.createElement("textarea");
        document.body.appendChild(anchor);

        adapter = {
            id: "test",
            name: "Test",
            urlPattern: /.*/,
            detect: () => true,
            getPromptElement: () => anchor,
            getPromptText: () => "test prompt",
            setPromptText: vi.fn(),
            getButtonAnchor: () => anchor,
            destroy: vi.fn()
        } as any;
    });

    afterEach(() => {
        HTMLElement.prototype.attachShadow = originalAttachShadow;
    });

    it("injects a button with the accessible label", () => {
        injectEnhanceButton(adapter, anchor);
        const host = document.getElementById("clairity-enhance-root");
        expect(host).not.toBeNull();

        const shadow = host?.shadowRoot;
        expect(shadow).toBeDefined();

        const btn = shadow?.querySelector("button");
        expect(btn?.getAttribute("aria-label")).toBe("Enhance prompt with Clairity");
        // textContent concatenates the icon glyph and label inside the pill button.
        expect(btn?.textContent).toContain("Enhance Request");
    });

    it("is idempotent — repeat calls do not inject a second button", () => {
        injectEnhanceButton(adapter, anchor);
        injectEnhanceButton(adapter, anchor);
        const hosts = document.querySelectorAll("#clairity-enhance-root");
        expect(hosts.length).toBe(1);
    });

});

describe("buildBriefPanel — XSS regression", () => {
    // Regression: the brief panel previously used innerHTML, so an LLM-emitted
    // brief containing HTML/JS (via prompt-injection) would execute in the host
    // page origin. All fields must now be rendered via textContent.
    function makeBrief(overrides: Partial<ConversationBrief>): ConversationBrief {
        return {
            goal: "",
            establishedContext: [],
            userStyle: "",
            activeTopic: "",
            avoid: [],
            messageCount: 0,
            lastUpdatedAt: 0,
            ...overrides,
        };
    }

    it("renders an <img onerror> payload in goal as plain text, not an element", () => {
        const payload = '<img src=x onerror="window.__xss=1">';
        const panel = buildBriefPanel(makeBrief({ goal: payload }));

        expect(panel.querySelector("img")).toBeNull();
        expect(panel.textContent).toContain(payload);
        expect((window as unknown as Record<string, unknown>)["__xss"]).toBeUndefined();
    });

    it("renders <script> tags in activeTopic as plain text", () => {
        const payload = '<script>window.__pwned=1</script>';
        const panel = buildBriefPanel(makeBrief({ activeTopic: payload }));

        expect(panel.querySelector("script")).toBeNull();
        expect(panel.textContent).toContain(payload);
        expect((window as unknown as Record<string, unknown>)["__pwned"]).toBeUndefined();
    });

    it("renders HTML payloads inside establishedContext[] and avoid[] list items as text", () => {
        const ctxPayload = '<iframe src="javascript:alert(1)"></iframe>';
        const avoidPayload = '<svg onload=alert(1)>';
        const panel = buildBriefPanel(makeBrief({
            establishedContext: [ctxPayload],
            avoid: [avoidPayload],
        }));

        expect(panel.querySelector("iframe")).toBeNull();
        expect(panel.querySelector("svg")).toBeNull();

        const listItems = Array.from(panel.querySelectorAll("li")).map((li) => li.textContent);
        expect(listItems).toContain(ctxPayload);
        expect(listItems).toContain(avoidPayload);
    });

    it("omits sections whose string is empty and lists that are empty", () => {
        const panel = buildBriefPanel(makeBrief({ goal: "Only goal" }));
        // Goal present, Topic/Context/Not-repeating skipped
        expect(panel.textContent).toContain("Goal");
        expect(panel.textContent).toContain("Only goal");
        expect(panel.textContent).not.toContain("Topic");
        expect(panel.textContent).not.toContain("Context");
        expect(panel.textContent).not.toContain("Not repeating");
    });
});
