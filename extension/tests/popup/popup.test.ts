import { describe, it, expect, beforeEach } from "vitest";
import {
  validatePromptLength,
  collectPreset,
  scoreColor,
  debounce,
} from "../../src/popup/popup-logic.js";
import { renderLintTips } from "../../src/popup/components/lint-tips.js";
import { renderRiskBadge } from "../../src/popup/components/risk-badge.js";
import type { Diagnostic, RiskAssessment } from "shared/types/index.js";

describe("validatePromptLength", () => {
  it("returns error for empty prompt", () => {
    expect(validatePromptLength("")).toBe("Please enter a prompt.");
  });

  it("returns null for valid prompt", () => {
    expect(validatePromptLength("Write a function")).toBeNull();
  });

  it("returns error when exceeding 10000 characters", () => {
    const long = "a".repeat(10001);
    const result = validatePromptLength(long);
    expect(result).toContain("10,000");
  });

  it("accepts exactly 10000 characters", () => {
    const exact = "a".repeat(10000);
    expect(validatePromptLength(exact)).toBeNull();
  });
});

describe("collectPreset", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("returns preset object with defaults", () => {
    document.body.innerHTML = `
      <select id="intent"><option value="" selected>Auto</option></select>
      <select id="format"><option value="paragraph" selected>Paragraph</option></select>
      <select id="tone"><option value="concise" selected>Concise</option></select>
      <textarea id="ctx"></textarea>
    `;
    const preset = collectPreset(
      document.getElementById("intent") as HTMLSelectElement,
      document.getElementById("tone") as HTMLSelectElement,
      document.getElementById("format") as HTMLSelectElement,
      document.getElementById("ctx") as HTMLTextAreaElement
    );
    expect(preset.tone).toBe("concise");
    expect(preset.output_format).toBe("paragraph");
    expect(preset.intent).toBeUndefined();
    expect(preset.additional_context).toBeUndefined();
  });

  it("captures selected intent and context", () => {
    document.body.innerHTML = `
      <select id="intent"><option value="coding" selected>Coding</option></select>
      <select id="format"><option value="bullets" selected>Bullets</option></select>
      <select id="tone"><option value="professional" selected>Pro</option></select>
      <textarea id="ctx">Using React</textarea>
    `;
    const preset = collectPreset(
      document.getElementById("intent") as HTMLSelectElement,
      document.getElementById("tone") as HTMLSelectElement,
      document.getElementById("format") as HTMLSelectElement,
      document.getElementById("ctx") as HTMLTextAreaElement
    );
    expect(preset.intent).toBe("coding");
    expect(preset.output_format).toBe("bullets");
    expect(preset.tone).toBe("professional");
    expect(preset.additional_context).toBe("Using React");
  });
});

describe("scoreColor", () => {
  it("returns green for high scores", () => {
    expect(scoreColor(80)).toBe("#10b981");
  });

  it("returns yellow for medium scores", () => {
    expect(scoreColor(50)).toBe("#f59e0b");
  });

  it("returns red for low scores", () => {
    expect(scoreColor(20)).toBe("#ef4444");
  });
});

describe("debounce", () => {
  it("delays execution", async () => {
    let count = 0;
    const fn = debounce(() => { count++; }, 10);
    fn();
    fn();
    fn();
    expect(count).toBe(0);
    await new Promise(r => setTimeout(r, 20));
    expect(count).toBe(1);
  });
});

describe("renderLintTips", () => {
  it("renders at most 1 tip in simple mode", () => {
    const div = document.createElement("div");
    const diags: Diagnostic[] = [
      { id: "1", severity: "warning", message: "m1" },
      { id: "2", severity: "warning", message: "m2" }
    ];
    renderLintTips(div, diags, "simple");
    expect(div.innerHTML).toContain("m1");
    expect(div.innerHTML).not.toContain("m2");
  });

  it("renders up to 3 tips in advanced mode", () => {
    const div = document.createElement("div");
    const diags: Diagnostic[] = [
      { id: "1", severity: "info", message: "m1" },
      { id: "2", severity: "info", message: "m2" },
      { id: "3", severity: "info", message: "m3" },
      { id: "4", severity: "info", message: "m4" }
    ];
    renderLintTips(div, diags, "advanced");
    expect(div.innerHTML).toContain("m1");
    expect(div.innerHTML).toContain("m3");
    expect(div.innerHTML).not.toContain("m4");
  });
});

describe("renderRiskBadge", () => {
  const risk: RiskAssessment = {
    risk_score: 50,
    risk_level: "medium",
    risk_factors: [{ signal: "test", points: 50, description: "reason 1", guardrail: "g1" }],
    recommended_guardrails: ["Add more context"]
  };

  it("always shows risk label", () => {
    const div = document.createElement("div");
    renderRiskBadge(div, risk, "simple");
    expect(div.innerHTML).toContain("Accuracy risk: Medium");
    expect(div.innerHTML).not.toContain("Add-on idea:");
  });

  it("shows guardrail and reasons in advanced mode", () => {
    const div = document.createElement("div");
    renderRiskBadge(div, risk, "advanced");
    expect(div.innerHTML).toContain("Accuracy risk: Medium");
    expect(div.innerHTML).toContain("reason 1");
    expect(div.innerHTML).toContain("Add-on idea:");
  });
});
