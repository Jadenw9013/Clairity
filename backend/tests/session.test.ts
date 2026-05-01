import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../src/server.js";

// Set a test secret so token signing works
beforeAll(() => {
  process.env["SESSION_SECRET"] = "test-secret-at-least-16-chars!!";
});

describe("POST /v1/session", () => {
  it("returns a session token with 201", async () => {
    const res = await request(app).post("/v1/session");
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("token");
    expect(res.body).toHaveProperty("session_id");
    expect(res.body).toHaveProperty("expires_at");
    expect(typeof res.body.token).toBe("string");
    expect(res.body.token.split(".")).toHaveLength(2);
  });

  it("returns unique session IDs on each call", async () => {
    const res1 = await request(app).post("/v1/session");
    const res2 = await request(app).post("/v1/session");
    expect(res1.body.session_id).not.toBe(res2.body.session_id);
  });
});

describe("Auth middleware", () => {
  it("rejects /v1/rewrite without Authorization header", async () => {
    const res = await request(app)
      .post("/v1/rewrite")
      .send({ prompt: "test", context: { site: "chatgpt" } });
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty("code", "UNAUTHORIZED");
  });

  it("rejects /v1/rewrite with malformed Bearer token", async () => {
    const res = await request(app)
      .post("/v1/rewrite")
      .set("Authorization", "Bearer garbage-token")
      .send({ prompt: "test", context: { site: "chatgpt" } });
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty("code", "UNAUTHORIZED");
  });

  it("rejects /v1/rewrite with non-Bearer auth scheme", async () => {
    const res = await request(app)
      .post("/v1/rewrite")
      .set("Authorization", "Basic dXNlcjpwYXNz")
      .send({ prompt: "test", context: { site: "chatgpt" } });
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty("code", "UNAUTHORIZED");
  });

  it("accepts /v1/rewrite with valid session token", async () => {
    const sessionRes = await request(app).post("/v1/session");
    const token = sessionRes.body.token as string;

    const res = await request(app)
      .post("/v1/rewrite")
      .set("Authorization", `Bearer ${token}`)
      .set("x-api-key", "sk-ant-test-key-for-unit-tests")
      .send({ prompt: "Help me code", site: "chatgpt", history: [] });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("enhanced_prompt");
  }, 15000);

  it("does not require auth for /v1/health", async () => {
    const res = await request(app).get("/v1/health");
    expect(res.status).toBe(200);
  });

  it("does not require auth for /v1/session", async () => {
    const res = await request(app).post("/v1/session");
    expect(res.status).toBe(201);
  });
});

describe("Token verification", () => {
  it("rejects tampered signature", async () => {
    const sessionRes = await request(app).post("/v1/session");
    const token = sessionRes.body.token as string;
    const tamperedToken = token.slice(0, -4) + "XXXX";

    const res = await request(app)
      .post("/v1/rewrite")
      .set("Authorization", `Bearer ${tamperedToken}`)
      .send({ prompt: "test", site: "chatgpt", history: [] });
    expect(res.status).toBe(401);
  });

  it("rejects actually expired tokens", async () => {
    // Create a token, then advance time past expiry
    const sessionRes = await request(app).post("/v1/session");
    const token = sessionRes.body.token as string;

    // Decode the payload, manually set exp to the past, re-sign
    // We can't re-sign without the secret, so instead we test via verifyToken directly
    const { verifyToken, createToken } = await import("../src/lib/token.js");

    // Create token then mock Date.now to be past expiry
    const originalNow = Date.now;
    Date.now = () => originalNow() + 4_000_000; // 4000s > 3600s TTL

    const result = verifyToken(token);
    expect(result).toBeNull();

    Date.now = originalNow; // restore
  });

  it("rejects empty token string", async () => {
    const res = await request(app)
      .post("/v1/rewrite")
      .set("Authorization", "Bearer ")
      .send({ prompt: "test", site: "chatgpt", history: [] });
    expect(res.status).toBe(401);
  });

  it("rejects token with too many parts", async () => {
    const res = await request(app)
      .post("/v1/rewrite")
      .set("Authorization", "Bearer a.b.c")
      .send({ prompt: "test", site: "chatgpt", history: [] });
    expect(res.status).toBe(401);
  });

  it("rejects token with no separator", async () => {
    const res = await request(app)
      .post("/v1/rewrite")
      .set("Authorization", "Bearer noseparatortoken")
      .send({ prompt: "test", site: "chatgpt", history: [] });
    expect(res.status).toBe(401);
  });

  it("returns null when payload is not valid JSON", async () => {
    const { verifyToken } = await import("../src/lib/token.js");
    const { createHmac } = await import("node:crypto");
    const secret = process.env["SESSION_SECRET"]!;

    // Create an invalid JSON string but encode it correctly
    const invalidJson = "{ invalid_json: true ";
    const encoded = Buffer.from(invalidJson).toString("base64url");

    // Sign it properly so it passes signature verification
    const sig = createHmac("sha256", secret).update(encoded).digest("base64url");

    const token = `${encoded}.${sig}`;
    const result = verifyToken(token);

    expect(result).toBeNull();
  });
});
