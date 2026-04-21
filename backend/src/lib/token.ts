import { createHmac, timingSafeEqual } from "node:crypto";

const SEPARATOR = ".";
const TOKEN_LIFETIME_S = 3600; // 1 hour
const MIN_SECRET_LENGTH = 32;

function getSecret(): string {
  const secret = process.env["SESSION_SECRET"];
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `SESSION_SECRET must be set and at least ${MIN_SECRET_LENGTH} characters`
    );
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
    if (!encoded || !providedSig) return null;
    const expectedSig = sign(encoded, secret);

    // Constant-time comparison to prevent timing attacks
    const sigBuf = Buffer.from(providedSig, "base64url");
    const expectedBuf = Buffer.from(expectedSig, "base64url");
    if (sigBuf.length !== expectedBuf.length) return null;
    if (!timingSafeEqual(sigBuf, expectedBuf)) return null;

    // Treat the decoded JSON as untrusted input until every field is
    // shape-validated. A signature match proves integrity, not structure.
    const raw: unknown = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8")
    );
    if (!raw || typeof raw !== "object") return null;
    const obj = raw as Record<string, unknown>;
    if (typeof obj["sid"] !== "string" || obj["sid"].length === 0) return null;
    if (typeof obj["exp"] !== "number" || !Number.isFinite(obj["exp"])) return null;
    if (typeof obj["iat"] !== "number" || !Number.isFinite(obj["iat"])) return null;

    const payload: TokenPayload = {
      sid: obj["sid"] as string,
      iat: obj["iat"] as number,
      exp: obj["exp"] as number,
    };

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
