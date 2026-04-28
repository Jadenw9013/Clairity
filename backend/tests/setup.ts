import { vi } from "vitest";

// Vitest global setup — runs before any test module is imported so that
// server.ts can evaluate its SESSION_SECRET guard without crashing the
// test runner. Individual tests may override this value later.
process.env["SESSION_SECRET"] ??= "test-secret-with-at-least-thirty-two-characters";

// Mock the Anthropic SDK so integration tests that pass an `x-api-key`
// header never reach the network. callLlm() catches the rejection and
// returns null, so callers exercise the same fallback path as a real
// Anthropic 401 — but deterministically and offline-safe.
vi.mock("@anthropic-ai/sdk", () => {
  class MockAnthropic {
    messages = {
      create: () =>
        Promise.reject(new Error("Anthropic SDK is mocked in tests")),
    };
    constructor(_opts?: unknown) {}
  }
  return { default: MockAnthropic };
});
