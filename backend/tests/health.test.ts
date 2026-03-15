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
        history: [],
        site: "chatgpt",
      });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("enhanced_prompt");
    expect(res.body).toHaveProperty("history_length", 0);
    expect(res.body).toHaveProperty("model");
  });

  it("returns 400 when prompt is missing", async () => {
    const token = await getToken();
    const res = await request(app)
      .post("/v1/rewrite")
      .set("Authorization", `Bearer ${token}`)
      .send({ site: "chatgpt", history: [] });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("code", "VALIDATION_ERROR");
  });

  it("returns 400 when site is invalid", async () => {
    const token = await getToken();
    const res = await request(app)
      .post("/v1/rewrite")
      .set("Authorization", `Bearer ${token}`)
      .send({ prompt: "test", site: "invalid", history: [] });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("code", "VALIDATION_ERROR");
  });

  it("returns 400 when prompt is empty string", async () => {
    const token = await getToken();
    const res = await request(app)
      .post("/v1/rewrite")
      .set("Authorization", `Bearer ${token}`)
      .send({ prompt: "", site: "claude", history: [] });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("code", "VALIDATION_ERROR");
  });

  it("respects history field", async () => {
    const token = await getToken();
    const history = [
      { role: "user", content: "explain closures" },
      { role: "assistant", content: "A closure captures its lexical scope." },
    ];
    const res = await request(app)
      .post("/v1/rewrite")
      .set("Authorization", `Bearer ${token}`)
      .send({ prompt: "give me an example", site: "gemini", history });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("history_length", 2);
  }, 15000);

  it("returns model field in response", async () => {
    const token = await getToken();
    const res = await request(app)
      .post("/v1/rewrite")
      .set("Authorization", `Bearer ${token}`)
      .send({ prompt: "Help me write a REST API", site: "claude", history: [] });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("model");
    expect(typeof res.body.model).toBe("string");
  }, 15000);
});
