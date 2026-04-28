import { describe, it, expect, beforeEach } from "vitest";
import { detectAdapter } from "../../src/adapters/registry.js";

describe("Adapter registry", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("detects ChatGPT adapter for chat.openai.com", () => {
    Object.defineProperty(window, "location", {
      value: { origin: "https://chat.openai.com" },
      writable: true,
    });
    const adapter = detectAdapter();
    expect(adapter).not.toBeNull();
    expect(adapter?.id).toBe("chatgpt");
  });

  it("detects ChatGPT adapter for chatgpt.com", () => {
    Object.defineProperty(window, "location", {
      value: { origin: "https://chatgpt.com" },
      writable: true,
    });
    const adapter = detectAdapter();
    expect(adapter).not.toBeNull();
    expect(adapter?.id).toBe("chatgpt");
  });

  it("detects Claude adapter for claude.ai", () => {
    Object.defineProperty(window, "location", {
      value: { origin: "https://claude.ai" },
      writable: true,
    });
    const adapter = detectAdapter();
    expect(adapter).not.toBeNull();
    expect(adapter?.id).toBe("claude");
  });

  it("returns null for unsupported site", () => {
    Object.defineProperty(window, "location", {
      value: { origin: "https://example.com" },
      writable: true,
    });
    expect(detectAdapter()).toBeNull();
  });

  it("returns null for gemini (not yet implemented)", () => {
    Object.defineProperty(window, "location", {
      value: { origin: "https://gemini.google.com" },
      writable: true,
    });
    expect(detectAdapter()).toBeNull();
  });
});
