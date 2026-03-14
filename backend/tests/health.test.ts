import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../src/server.js";

beforeAll(() => {
  process.env["SESSION_SECRET"] = "test-secret-at-least-16-chars!!";
});

/** Helper: get a valid session token */
async function getToken(): Promise<string> {
  const res = await request(app).post("/v1/session");
  return res.body.token as string;
}

describe("GET /v1/health", () => {
  it("returns status ok with version and timestamp", async () => {
    const res = await request(app).get("/v1/health");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("status", "ok");
    expect(res.body).toHaveProperty("version", "0.1.0");
    expect(res.body).toHaveProperty("timestamp");
  });
});

describe("POST /v1/rewrite", () => {
  it("returns enhanced prompt for valid request", async () => {
    const token = await getToken();
    const res = await request(app)
      .post("/v1/rewrite")
      .set("Authorization", `Bearer ${token}`)
      .send({
        prompt: "Help me write a function",
        context: { site: "chatgpt" },
      });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("enhanced_prompt");
    expect(res.body).toHaveProperty("score");
    expect(res.body.score).toHaveProperty("clarity");
    expect(res.body.score).toHaveProperty("confidence");
    expect(res.body).toHaveProperty("changes");
    expect(res.body).toHaveProperty("warnings");
    expect(res.body).toHaveProperty("metadata");
    expect(res.body.metadata).toHaveProperty("model_used", "deterministic-v1");
    expect(res.body.metadata).toHaveProperty("rewrite_mode", "enhance");
    expect(res.body.metadata).toHaveProperty("detected_intent");
    expect(res.body).toHaveProperty("request_id");
  });

  it("returns 400 when prompt is missing", async () => {
    const token = await getToken();
    const res = await request(app)
      .post("/v1/rewrite")
      .set("Authorization", `Bearer ${token}`)
      .send({ context: { site: "chatgpt" } });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("code", "VALIDATION_ERROR");
  });

  it("returns 400 when site is invalid", async () => {
    const token = await getToken();
    const res = await request(app)
      .post("/v1/rewrite")
      .set("Authorization", `Bearer ${token}`)
      .send({ prompt: "test", context: { site: "invalid" } });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("code", "VALIDATION_ERROR");
  });

  it("returns 400 when prompt is empty string", async () => {
    const token = await getToken();
    const res = await request(app)
      .post("/v1/rewrite")
      .set("Authorization", `Bearer ${token}`)
      .send({ prompt: "", context: { site: "claude" } });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("code", "VALIDATION_ERROR");
  });

  it("respects rewrite mode option", async () => {
    const token = await getToken();
    const res = await request(app)
      .post("/v1/rewrite")
      .set("Authorization", `Bearer ${token}`)
      .send({
        prompt: "Help me",
        context: { site: "gemini" },
        options: { mode: "expand" },
      });
    expect(res.status).toBe(200);
    expect(res.body.metadata.rewrite_mode).toBe("expand");
  });

  it("accepts preset fields", async () => {
    const token = await getToken();
    const res = await request(app)
      .post("/v1/rewrite")
      .set("Authorization", `Bearer ${token}`)
      .send({
        prompt: "Help me write a REST API",
        context: { site: "chatgpt" },
        preset: {
          intent: "coding",
          tone: "professional",
          output_format: "step-by-step",
          additional_context: "Using Node.js and Express",
        },
      });
    expect(res.status).toBe(200);
    expect(res.body.metadata.detected_intent).toBe("coding");
    expect(res.body.enhanced_prompt).toContain("Using Node.js and Express");
    expect(res.body.enhanced_prompt).toContain("step-by-step");
  });
});
