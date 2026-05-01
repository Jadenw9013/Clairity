// backend/src/lib/featureFlags.ts
// Feature flags read from environment variables.
// Logged at startup via logFeatureFlags().

export function logFeatureFlags(logger: { info: (...args: unknown[]) => void }): void {
  logger.info(
    {
      ANTHROPIC_MODEL: process.env["ANTHROPIC_MODEL"] ?? "claude-haiku-4-5-20251001",
      API_KEY_MODE: "per-request",
    },
    "Feature flags"
  );
}

