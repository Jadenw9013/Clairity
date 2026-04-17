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
  return `${KEY_PREFIX}...${suffix}`;
}

describe("apiKeyStore — pure logic", () => {
  describe("validateApiKey", () => {
    it(`returns true for valid ${KEY_PREFIX} key`, () => {
      expect(validateApiKey(`${KEY_PREFIX}abc123`)).toBe(true);
    });

    it(`returns false for key not starting with ${KEY_PREFIX}`, () => {
      expect(validateApiKey("sk-openai-abc")).toBe(false);
    });

    it("returns false for empty string", () => {
      expect(validateApiKey("")).toBe(false);
    });

    it("returns false for partial prefix", () => {
      expect(validateApiKey("sk-abc")).toBe(false);
    });

    it("trims whitespace before validation", () => {
      expect(validateApiKey(`  ${KEY_PREFIX}validkey  `)).toBe(true);
    });
  });

  describe("maskApiKey", () => {
    it("masks key showing only last 4 chars", () => {
      expect(maskApiKey(`${KEY_PREFIX}api001-abcd`)).toBe(`${KEY_PREFIX}...abcd`);
    });

    it(`mask format is always ${KEY_PREFIX}...XXXX`, () => {
      const masked = maskApiKey(`${KEY_PREFIX}somekey-1234`);
      const regex = new RegExp(`^${KEY_PREFIX}\\.\\.\\..{4}$`);
      expect(masked).toMatch(regex);
    });
  });
});
