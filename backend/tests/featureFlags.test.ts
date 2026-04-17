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

  it("should log ANTHROPIC_API_KEY_SET as false when env var is not set", () => {
    delete process.env["ANTHROPIC_API_KEY"];

    const mockLogger = { info: vi.fn() };
    logFeatureFlags(mockLogger);

    expect(mockLogger.info).toHaveBeenCalledWith(
      { ANTHROPIC_API_KEY_SET: false },
      "Feature flags"
    );
  });

  it("should log ANTHROPIC_API_KEY_SET as false when env var is an empty string", () => {
    process.env["ANTHROPIC_API_KEY"] = "";

    const mockLogger = { info: vi.fn() };
    logFeatureFlags(mockLogger);

    expect(mockLogger.info).toHaveBeenCalledWith(
      { ANTHROPIC_API_KEY_SET: false },
      "Feature flags"
    );
  });

  it("should log ANTHROPIC_API_KEY_SET as true when env var is set", () => {
    process.env["ANTHROPIC_API_KEY"] = "sk-ant-api03-test";

    const mockLogger = { info: vi.fn() };
    logFeatureFlags(mockLogger);

    expect(mockLogger.info).toHaveBeenCalledWith(
      { ANTHROPIC_API_KEY_SET: true },
      "Feature flags"
    );
  });
});
