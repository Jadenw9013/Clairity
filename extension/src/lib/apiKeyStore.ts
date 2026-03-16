// extension/src/lib/apiKeyStore.ts
// Per-user Anthropic API key stored locally in chrome.storage.local.
// Keys are NEVER synced across devices (storage.local, not storage.sync).
// Never returns or logs the full key value.

const STORAGE_KEY = "clairity_api_key";
const KEY_PREFIX = "sk-ant-";

export async function getApiKey(): Promise<string | null> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const key = result[STORAGE_KEY] as string | undefined;
  return key && key.length > 0 ? key : null;
}

/**
 * Validate and store the API key.
 * Throws if key does not start with "sk-ant-".
 */
export async function setApiKey(key: string): Promise<void> {
  const trimmed = key.trim();
  if (!trimmed.startsWith(KEY_PREFIX)) {
    throw new Error(`Invalid key format. Anthropic keys must start with "${KEY_PREFIX}".`);
  }
  await chrome.storage.local.set({ [STORAGE_KEY]: trimmed });
}

export async function clearApiKey(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEY);
}

export async function hasApiKey(): Promise<boolean> {
  const key = await getApiKey();
  return key !== null;
}

/**
 * Returns a masked display string for UI: "sk-ant-...xxxx" (last 4 chars).
 * Safe to display — never exposes full key.
 */
export function maskApiKey(key: string): string {
  const suffix = key.slice(-4);
  return `sk-ant-...${suffix}`;
}
