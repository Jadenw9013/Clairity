// backend/src/lib/featureFlags.ts
// Feature flags read from environment variables.
// Logged at startup via logFeatureFlags().

/** Anthropic API key — also accepts legacy LLM_API_KEY for backwards compat */
export const ANTHROPIC_API_KEY =
  process.env["ANTHROPIC_API_KEY"] ?? process.env["LLM_API_KEY"] ?? "";

export function logFeatureFlags(logger: { info: (...args: unknown[]) => void }): void {
  logger.info(
    {
      ANTHROPIC_API_KEY_SET: ANTHROPIC_API_KEY.length > 0,
    },
    "Feature flags"
  );
}
