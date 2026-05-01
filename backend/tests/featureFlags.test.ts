import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { logFeatureFlags } from "../src/lib/featureFlags.js";

describe("logFeatureFlags", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save the original process.env
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    // Restore process.env
    process.env = { ...originalEnv };
  });

  it("should log default ANTHROPIC_MODEL when env var is not set", () => {
    delete process.env["ANTHROPIC_MODEL"];

    const mockLogger = { info: vi.fn() };
    logFeatureFlags(mockLogger);

    expect(mockLogger.info).toHaveBeenCalledWith(
      { ANTHROPIC_MODEL: "claude-haiku-4-5-20251001", API_KEY_MODE: "per-request" },
      "Feature flags"
    );
  });

  it("should log custom ANTHROPIC_MODEL when env var is set", () => {
    process.env["ANTHROPIC_MODEL"] = "claude-sonnet-4-20250514";

    const mockLogger = { info: vi.fn() };
    logFeatureFlags(mockLogger);

    expect(mockLogger.info).toHaveBeenCalledWith(
      { ANTHROPIC_MODEL: "claude-sonnet-4-20250514", API_KEY_MODE: "per-request" },
      "Feature flags"
    );
  });

  it("should always log API_KEY_MODE as per-request", () => {
    const mockLogger = { info: vi.fn() };
    logFeatureFlags(mockLogger);

    const loggedObj = mockLogger.info.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(loggedObj["API_KEY_MODE"]).toBe("per-request");
  });
});
