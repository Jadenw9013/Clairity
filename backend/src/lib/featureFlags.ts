// backend/src/lib/featureFlags.ts
// Feature flags read from environment variables.
// Logged at startup via logFeatureFlags().

export function logFeatureFlags(logger: { info: (...args: unknown[]) => void }): void {
  logger.info(
    {
      ANTHROPIC_API_KEY_SET: (process.env["ANTHROPIC_API_KEY"] ?? "").length > 0,
    },
    "Feature flags"
  );
}
