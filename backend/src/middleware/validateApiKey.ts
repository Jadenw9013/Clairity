import type { Request, Response } from "express";

const API_KEY_PREFIX = "sk-ant-";
const API_KEY_MAX_LENGTH = 200;

/**
 * Validate and extract the x-api-key header.
 *
 * Returns:
 *  - string: valid API key
 *  - null: no key provided (rely on server-side env key)
 *  - false: malformed key — 400 already sent on res
 */
export function validateApiKey(req: Request, res: Response): string | null | false {
  const raw = req.headers["x-api-key"];
  if (!raw || (typeof raw === "string" && raw.length === 0)) {
    return null; // No user key — backend will use env key
  }

  const key = Array.isArray(raw) ? raw[0] : raw;
  if (!key || typeof key !== "string") {
    return null;
  }

  if (!key.startsWith(API_KEY_PREFIX)) {
    res.status(400).json({
      error: `Invalid API key format. Keys must start with "${API_KEY_PREFIX}".`,
      code: "INVALID_API_KEY",
    });
    return false;
  }

  if (key.length > API_KEY_MAX_LENGTH) {
    res.status(400).json({
      error: "API key exceeds maximum length.",
      code: "INVALID_API_KEY",
    });
    return false;
  }

  return key;
}
