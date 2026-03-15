import { describe, it, expect } from "vitest";
import {
  validatePromptLength,
  scoreColor,
  debounce,
} from "../../src/popup/popup-logic.js";

describe("validatePromptLength", () => {
  it("returns error for empty prompt", () => {
    expect(validatePromptLength("")).toBe("Please enter a prompt.");
    expect(validatePromptLength("   ")).toBe("Please enter a prompt.");
  });

  it("returns null for valid prompt", () => {
    expect(validatePromptLength("Hello world")).toBeNull();
  });

  it("returns error when exceeding 10000 characters", () => {
    const longPrompt = "a".repeat(10001);
    expect(validatePromptLength(longPrompt)).toBe(
      "Prompt exceeds 10,000 character limit."
    );
  });

  it("accepts exactly 10000 characters", () => {
    const exactPrompt = "a".repeat(10000);
    expect(validatePromptLength(exactPrompt)).toBeNull();
  });
});

describe("scoreColor", () => {
  it("returns green for high scores", () => {
    expect(scoreColor(80)).toBe("#10b981");
    expect(scoreColor(70)).toBe("#10b981");
  });

  it("returns yellow for medium scores", () => {
    expect(scoreColor(69)).toBe("#f59e0b");
    expect(scoreColor(40)).toBe("#f59e0b");
  });

  it("returns red for low scores", () => {
    expect(scoreColor(39)).toBe("#ef4444");
    expect(scoreColor(0)).toBe("#ef4444");
  });
});

describe("debounce", () => {
  it("delays execution", () => {
    return new Promise<void>((resolve) => {
      let callCount = 0;
      const fn = debounce(() => {
        callCount++;
      }, 50);

      fn();
      fn();
      fn();

      expect(callCount).toBe(0);

      setTimeout(() => {
        expect(callCount).toBe(1);
        resolve();
      }, 100);
    });
  });
});
