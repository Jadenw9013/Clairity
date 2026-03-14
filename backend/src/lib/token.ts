import { createHmac, timingSafeEqual } from "node:crypto";

const SEPARATOR = ".";
const TOKEN_LIFETIME_S = 3600; // 1 hour

function getSecret(): string {
  const secret = process.env["SESSION_SECRET"];
  if (!secret || secret.length < 16) {
    throw new Error("SESSION_SECRET must be set and at least 16 characters");
  }
  return secret;
}

function base64url(buf: Buffer): string {
  return buf.toString("base64url");
}

function sign(payload: string, secret: string): string {
  return base64url(createHmac("sha256", secret).update(payload).digest());
}

interface TokenPayload {
  sid: string;
  iat: number;
  exp: number;
}

/** Create a signed session token */
export function createToken(sessionId: string): string {
  const secret = getSecret();
  const now = Math.floor(Date.now() / 1000);
  const payload: TokenPayload = {
    sid: sessionId,
    iat: now,
    exp: now + TOKEN_LIFETIME_S,
  };
  const encoded = base64url(Buffer.from(JSON.stringify(payload)));
  const sig = sign(encoded, secret);
  return `${encoded}${SEPARATOR}${sig}`;
}

/** Verify a signed token; returns payload or null if invalid/expired */
export function verifyToken(token: string): TokenPayload | null {
  try {
    const secret = getSecret();
    const parts = token.split(SEPARATOR);
    if (parts.length !== 2) return null;

    const [encoded, providedSig] = parts as [string, string];
    const expectedSig = sign(encoded, secret);

    // Constant-time comparison to prevent timing attacks
    const sigBuf = Buffer.from(providedSig, "base64url");
    const expectedBuf = Buffer.from(expectedSig, "base64url");
    if (sigBuf.length !== expectedBuf.length) return null;
    if (!timingSafeEqual(sigBuf, expectedBuf)) return null;

    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8")
    ) as TokenPayload;

    // Check expiry
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp <= now) return null;

    return payload;
  } catch {
    return null;
  }
}

export { TOKEN_LIFETIME_S };
export type { TokenPayload };
