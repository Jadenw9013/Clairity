// Vitest global setup — runs before any test module is imported so that
// server.ts can evaluate its SESSION_SECRET guard without crashing the
// test runner. Individual tests may override this value later.
process.env["SESSION_SECRET"] ??= "test-secret-with-at-least-thirty-two-characters";
