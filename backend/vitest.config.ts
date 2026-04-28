import { defineConfig } from "vitest/config";
import path from "path";

// Must be set here (not in setupFiles) because server.ts evaluates its
// SESSION_SECRET guard at import time — before setupFiles run.
process.env["SESSION_SECRET"] ??= "test-secret-with-at-least-thirty-two-characters";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
  },
  resolve: {
    alias: {
      "shared": path.resolve(__dirname, "../shared"),
    },
  },
});
