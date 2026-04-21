// Focused tests for the hardened brief parser (extractJsonObject) and the
// control-character sanitisation applied to LLM-emitted brief strings.
import { describe, it, expect, vi } from "vitest";

const mockCallLlm = vi.hoisted(() => vi.fn());
vi.mock("../src/lib/llmClient.js", () => ({ callLlm: mockCallLlm }));

import { extractBrief, extractJsonObject } from "../src/lib/briefEngine.js";

describe("extractJsonObject", () => {
  it("extracts a plain JSON object", () => {
    expect(extractJsonObject('{"goal":"x"}')).toBe('{"goal":"x"}');
  });

  it("strips markdown code fence prefix/suffix", () => {
    const raw = '```json\n{"goal":"x"}\n```';
    expect(extractJsonObject(raw)).toBe('{"goal":"x"}');
  });

  it("tolerates trailing commentary after the object", () => {
    const raw = '{"goal":"x"}\n\nHere is your brief.';
    expect(extractJsonObject(raw)).toBe('{"goal":"x"}');
  });

  it("respects balanced braces inside nested objects", () => {
    // Regression: the old /\{[\s\S]*\}/ greedy regex would swallow trailing
    // braces; the balanced extractor must stop at the matching `}`.
    const raw = '{"a":{"b":1},"c":2} trailing }}}';
    expect(extractJsonObject(raw)).toBe('{"a":{"b":1},"c":2}');
  });

  it("ignores braces inside strings", () => {
    const raw = '{"goal":"this has { and } inside"}';
    expect(extractJsonObject(raw)).toBe(raw);
  });

  it("handles escaped quotes in strings", () => {
    const raw = '{"goal":"say \\"hi\\"","topic":"t"}';
    expect(extractJsonObject(raw)).toBe(raw);
  });

  it("returns null when no opening brace exists", () => {
    expect(extractJsonObject("no object here")).toBeNull();
  });

  it("returns null for unbalanced braces", () => {
    expect(extractJsonObject('{"goal":"x"')).toBeNull();
  });
});

describe("extractBrief — sanitisation", () => {
  const NUL = String.fromCharCode(0x00);
  const ESC = String.fromCharCode(0x1b);
  const DEL = String.fromCharCode(0x7f);

  it("strips ASCII C0, DEL, and C1 control characters from brief string fields", async () => {
    const raw = JSON.stringify({
      goal: `Build an app${NUL}${DEL}`,
      establishedContext: [`Uses TS${ESC}`],
      userStyle: "Technical",
      activeTopic: `Setup${ESC}[31m`,
      avoid: [`${NUL}control-only`],
    });
    mockCallLlm.mockResolvedValueOnce({ content: raw, model: "test" });

    const brief = await extractBrief([
      { role: "user", content: "seed" },
      { role: "assistant", content: "ack" },
    ]);

    expect(brief).not.toBeNull();
    expect(brief!.goal).toBe("Build an app");
    expect(brief!.establishedContext).toEqual(["Uses TS"]);
    expect(brief!.activeTopic).toBe("Setup[31m");
    expect(brief!.avoid).toEqual(["control-only"]);
  });

  it("preserves HTML angle brackets (client renders via textContent)", async () => {
    const raw = JSON.stringify({
      goal: "Learn about <script> tags",
      establishedContext: [],
      userStyle: "",
      activeTopic: "",
      avoid: [],
    });
    mockCallLlm.mockResolvedValueOnce({ content: raw, model: "test" });

    const brief = await extractBrief([{ role: "user", content: "seed" }]);
    expect(brief!.goal).toBe("Learn about <script> tags");
  });
});
