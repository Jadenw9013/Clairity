import rateLimit from "express-rate-limit";

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
  keyGenerator: (req) => {
    // Prefer session ID if authenticated, else fall back to IP
    const sessionId = (req as unknown as Record<string, unknown>)["sessionId"];
    if (typeof sessionId === "string") return sessionId;
    return req.ip ?? "unknown";
  },
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
