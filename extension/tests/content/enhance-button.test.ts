import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { injectEnhanceButton } from "../../src/content/enhance-button.js";
import type { SiteAdapter } from "shared/types/index.js";

// Mock chrome.storage.local
const mockStorageGet = vi.fn();
(global as any).chrome = {
    storage: {
        local: {
            get: mockStorageGet
        }
    },
    runtime: {
        sendMessage: vi.fn()
    }
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

        // Default mock response: Simple Mode
        mockStorageGet.mockImplementation((keys, cb) => cb({ uxMode: "simple" }));
    });

    afterEach(() => {
        HTMLElement.prototype.attachShadow = originalAttachShadow;
    });

    it("injects button with aria-label and default Simple text", () => {
        injectEnhanceButton(adapter, anchor);
        const host = document.getElementById("clairity-enhance-root");
        expect(host).not.toBeNull();

        const shadow = host?.shadowRoot;
        expect(shadow).toBeDefined();

        const btn = shadow?.querySelector("button");
        expect(btn?.getAttribute("aria-label")).toBe("Enhance prompt");
        expect(btn?.textContent).toBe("Fix my question");
    });

    it("injects Advanced text if storage returns advanced mode", () => {
        mockStorageGet.mockImplementation((keys, cb) => cb({ uxMode: "advanced" }));
        injectEnhanceButton(adapter, anchor);

        const shadow = document.getElementById("clairity-enhance-root")?.shadowRoot;
        const btn = shadow?.querySelector("button");
        expect(btn?.textContent).toBe("Enhance Request");
    });

});
