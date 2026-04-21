import { describe, it, expect, beforeAll } from "vitest";
import { createHmac } from "node:crypto";

import { createToken, verifyToken } from "../src/lib/token.js";

const SECRET = "test-secret-with-at-least-thirty-two-characters";

beforeAll(() => {
  process.env["SESSION_SECRET"] = SECRET;
});

function sign(encoded: string): string {
  return createHmac("sha256", SECRET).update(encoded).digest("base64url");
}

function craft(payload: unknown): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

describe("verifyToken — payload shape validation", () => {
  it("accepts a well-formed payload produced by createToken", () => {
    const token = createToken("sess-abc");
    const payload = verifyToken(token);
    expect(payload).not.toBeNull();
    expect(payload?.sid).toBe("sess-abc");
  });

  it("rejects a signed payload whose sid is not a string", () => {
    const token = craft({ sid: 123, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 60 });
    expect(verifyToken(token)).toBeNull();
  });

  it("rejects a signed payload with missing sid", () => {
    const token = craft({ iat: 1, exp: Math.floor(Date.now() / 1000) + 60 });
    expect(verifyToken(token)).toBeNull();
  });

  it("rejects a signed payload whose exp is a string", () => {
    const token = craft({ sid: "x", iat: 1, exp: "9999999999" });
    expect(verifyToken(token)).toBeNull();
  });

  it("rejects a signed payload whose exp is NaN / Infinity", () => {
    const inf = craft({ sid: "x", iat: 1, exp: Number.POSITIVE_INFINITY });
    expect(verifyToken(inf)).toBeNull();
  });

  it("rejects a signed array payload (non-object top-level)", () => {
    const token = craft(["sid", 1, 2]);
    expect(verifyToken(token)).toBeNull();
  });

  it("rejects a signed null payload", () => {
    const token = craft(null);
    expect(verifyToken(token)).toBeNull();
  });

  it("rejects a token missing the signature half", () => {
    const encoded = Buffer.from(JSON.stringify({ sid: "x", iat: 1, exp: 2 })).toString("base64url");
    expect(verifyToken(`${encoded}.`)).toBeNull();
  });
});
