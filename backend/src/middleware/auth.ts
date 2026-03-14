import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "../lib/token.js";

/**
 * Middleware that validates the Authorization: Bearer <token> header.
 * Attaches `req.sessionId` on success.
 * Returns 401 UNAUTHORIZED on failure.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    res.status(401).json({
      error: "Missing or malformed Authorization header",
      code: "UNAUTHORIZED",
    });
    return;
  }

  const token = header.slice(7);
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({
      error: "Invalid or expired session token",
      code: "UNAUTHORIZED",
    });
    return;
  }

  // Attach session ID for downstream use (rate limiting, logging)
  (req as Request & { sessionId: string }).sessionId = payload.sid;
  next();
}
