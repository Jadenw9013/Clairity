import { describe, it, expect } from "vitest";
import type { Request } from "express";
import { getApiLimitKey } from "../src/middleware/rateLimit.js";

describe("getApiLimitKey", () => {
  it("returns the client IP when present", () => {
    const req = { ip: "10.0.0.5" } as Request;
    expect(getApiLimitKey(req)).toBe("10.0.0.5");
  });

  it("falls back to 'unknown' when IP is undefined", () => {
    const req = {} as Request;
    expect(getApiLimitKey(req)).toBe("unknown");
  });

  it("ignores any attached sessionId — session rotation must not bypass IP cap", () => {
    // Regression: previously keyed on sessionId first, allowing a caller to
    // multiply throughput by requesting new sessions. Key must depend only
    // on IP so rotating tokens shares the same bucket.
    const a = { ip: "10.0.0.5", sessionId: "aaa" } as unknown as Request;
    const b = { ip: "10.0.0.5", sessionId: "bbb" } as unknown as Request;
    expect(getApiLimitKey(a)).toBe(getApiLimitKey(b));
  });
});
