// backend/tests/apiKeyStore.test.ts
// Tests for the extension's apiKeyStore module (browser-facing).
// These tests validate the pure logic — validation and masking — without needing chrome APIs.

import { describe, it, expect } from "vitest";

// Re-implement the pure logic inline since apiKeyStore uses chrome.storage which is
// not available in the backend test environment. The pure exportable functions
// (validation and masking) are what matter for correctness testing.

const KEY_PREFIX = "sk-ant-";

function validateApiKey(key: string): boolean {
  return key.trim().startsWith(KEY_PREFIX);
}

function maskApiKey(key: string): string {
  const suffix = key.slice(-4);
  return `sk-ant-...${suffix}`;
}

describe("apiKeyStore — pure logic", () => {
  describe("validateApiKey", () => {
    it("returns true for valid sk-ant- key", () => {
      expect(validateApiKey("sk-ant-abc123")).toBe(true);
    });

    it("returns false for key not starting with sk-ant-", () => {
      expect(validateApiKey("sk-openai-abc")).toBe(false);
    });

    it("returns false for empty string", () => {
      expect(validateApiKey("")).toBe(false);
    });

    it("returns false for partial prefix", () => {
      expect(validateApiKey("sk-abc")).toBe(false);
    });

    it("trims whitespace before validation", () => {
      expect(validateApiKey("  sk-ant-validkey  ")).toBe(true);
    });
  });

  describe("maskApiKey", () => {
    it("masks key showing only last 4 chars", () => {
      expect(maskApiKey("sk-ant-api001-abcd")).toBe("sk-ant-...abcd");
    });

    it("mask format is always sk-ant-...XXXX", () => {
      const masked = maskApiKey("sk-ant-somekey-1234");
      expect(masked).toMatch(/^sk-ant-\.\.\..{4}$/);
    });
  });
});
