import rateLimit from "express-rate-limit";
import type { Request } from "express";

/**
 * Rate-limit key derivation.
 *
 * Always keys on the client IP so that a caller cannot multiply their
 * effective throughput by rotating session tokens. Exported for tests.
 */
export function getApiLimitKey(req: Request): string {
  return req.ip ?? "unknown";
}

/**
 * Rate limiter for general API endpoints.
 * Uses in-memory store (suitable for single-instance dev/staging).
 * NOTE: For multi-instance production, replace with Redis store.
 */
export const apiLimiter = rateLimit({
  windowMs: 60_000, // 1 minute
  limit: 60,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: getApiLimitKey,
  handler: (_req, res) => {
    res.status(429).json({
      error: "Rate limit exceeded. Please wait before retrying.",
      code: "RATE_LIMITED",
    });
  },
});

/**
 * Stricter limiter for session creation endpoint.
 */
export const sessionLimiter = rateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      error: "Too many session requests. Please wait.",
      code: "RATE_LIMITED",
    });
  },
});
