import { Router } from "express";
import { randomUUID } from "node:crypto";
import { createToken, TOKEN_LIFETIME_S } from "../../lib/token.js";

const router = Router();

/**
 * POST /v1/session
 * Issues an anonymous session token.
 * No user accounts yet — any client can request a session.
 */
router.post("/session", (_req, res) => {
  const sessionId = randomUUID();
  const token = createToken(sessionId);
  const expiresAt = new Date(
    Date.now() + TOKEN_LIFETIME_S * 1000
  ).toISOString();

  res.status(201).json({
    token,
    session_id: sessionId,
    expires_at: expiresAt,
  });
});

export default router;
