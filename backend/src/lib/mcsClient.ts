// backend/src/lib/mcsClient.ts
// MCS integration removed. Both functions are stubs returning safe no-op values.
// The extension and rewrite route never call MCS.

/** Always returns null — MCS integration is disabled. */
export async function fetchMcsContext(): Promise<null> {
  return null;
}

/** Always returns false — MCS integration is disabled. */
export async function checkMcsHealth(): Promise<false> {
  return false;
}
