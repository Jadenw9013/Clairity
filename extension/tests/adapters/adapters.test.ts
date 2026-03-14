import { describe, it, expect, beforeEach } from "vitest";
import { chatgptAdapter } from "../../src/adapters/chatgpt.js";
import { claudeAdapter } from "../../src/adapters/claude.js";

describe("ChatGPT adapter", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("detects chatgpt.com origin", () => {
    Object.defineProperty(window, "location", {
      value: { origin: "https://chat.openai.com" },
      writable: true,
    });
    expect(chatgptAdapter.detect()).toBe(true);
  });

  it("does not detect unrelated origin", () => {
    Object.defineProperty(window, "location", {
      value: { origin: "https://example.com" },
      writable: true,
    });
    expect(chatgptAdapter.detect()).toBe(false);
  });

  it("finds prompt element by id", () => {
    const div = document.createElement("div");
    div.id = "prompt-textarea";
    div.contentEditable = "true";
    document.body.appendChild(div);
    expect(chatgptAdapter.getPromptElement()).toBe(div);
  });

  it("finds prompt element by data-testid fallback", () => {
    const div = document.createElement("div");
    div.setAttribute("data-testid", "prompt-textarea");
    document.body.appendChild(div);
    expect(chatgptAdapter.getPromptElement()).toBe(div);
  });

  it("returns null when no prompt element exists", () => {
    expect(chatgptAdapter.getPromptElement()).toBeNull();
  });

  it("reads text from contentEditable div", () => {
    const div = document.createElement("div");
    div.id = "prompt-textarea";
    div.setAttribute("contenteditable", "true");
    div.textContent = "Hello world";
    document.body.appendChild(div);
    expect(chatgptAdapter.getPromptText()).toBe("Hello world");
  });

  it("reads text from textarea fallback", () => {
    const form = document.createElement("form");
    const ta = document.createElement("textarea");
    ta.value = "Test prompt";
    form.appendChild(ta);
    document.body.appendChild(form);
    expect(chatgptAdapter.getPromptText()).toBe("Test prompt");
  });

  it("sets text on contentEditable div", () => {
    const div = document.createElement("div");
    div.id = "prompt-textarea";
    div.contentEditable = "true";
    document.body.appendChild(div);
    chatgptAdapter.setPromptText("New text");
    expect(div.textContent).toBe("New text");
  });

  it("sets text on textarea fallback", () => {
    const form = document.createElement("form");
    const ta = document.createElement("textarea");
    form.appendChild(ta);
    document.body.appendChild(form);
    chatgptAdapter.setPromptText("New text");
    expect(ta.value).toBe("New text");
  });

  it("returns empty string when no element for getPromptText", () => {
    expect(chatgptAdapter.getPromptText()).toBe("");
  });

  it("getButtonAnchor returns parent of prompt element", () => {
    const wrapper = document.createElement("div");
    const div = document.createElement("div");
    div.id = "prompt-textarea";
    wrapper.appendChild(div);
    document.body.appendChild(wrapper);
    expect(chatgptAdapter.getButtonAnchor()).toBe(wrapper);
  });

  it("getButtonAnchor returns null when no prompt element", () => {
    expect(chatgptAdapter.getButtonAnchor()).toBeNull();
  });
});

describe("Claude adapter", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("detects claude.ai origin", () => {
    Object.defineProperty(window, "location", {
      value: { origin: "https://claude.ai" },
      writable: true,
    });
    expect(claudeAdapter.detect()).toBe(true);
  });

  it("does not detect unrelated origin", () => {
    Object.defineProperty(window, "location", {
      value: { origin: "https://example.com" },
      writable: true,
    });
    expect(claudeAdapter.detect()).toBe(false);
  });

  it("finds ProseMirror contentEditable div", () => {
    const div = document.createElement("div");
    div.setAttribute("contenteditable", "true");
    div.classList.add("ProseMirror");
    document.body.appendChild(div);
    expect(claudeAdapter.getPromptElement()).toBe(div);
  });

  it("finds by aria-label fallback", () => {
    const div = document.createElement("div");
    div.setAttribute("contenteditable", "true");
    div.setAttribute("aria-label", "Write a message");
    document.body.appendChild(div);
    expect(claudeAdapter.getPromptElement()).toBe(div);
  });

  it("returns null when no prompt element exists", () => {
    expect(claudeAdapter.getPromptElement()).toBeNull();
  });

  it("reads text from contentEditable", () => {
    const div = document.createElement("div");
    div.setAttribute("contenteditable", "true");
    div.classList.add("ProseMirror");
    div.textContent = "Claude prompt";
    document.body.appendChild(div);
    expect(claudeAdapter.getPromptText()).toBe("Claude prompt");
  });

  it("sets text on contentEditable", () => {
    const div = document.createElement("div");
    div.setAttribute("contenteditable", "true");
    div.classList.add("ProseMirror");
    document.body.appendChild(div);
    claudeAdapter.setPromptText("New prompt");
    expect(div.textContent).toBe("New prompt");
  });

  it("returns empty string when no element", () => {
    expect(claudeAdapter.getPromptText()).toBe("");
  });

  it("getButtonAnchor returns parent of prompt element", () => {
    const wrapper = document.createElement("div");
    const div = document.createElement("div");
    div.setAttribute("contenteditable", "true");
    div.classList.add("ProseMirror");
    wrapper.appendChild(div);
    document.body.appendChild(wrapper);
    expect(claudeAdapter.getButtonAnchor()).toBe(wrapper);
  });
});
