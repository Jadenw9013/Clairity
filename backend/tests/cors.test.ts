import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../src/server.js";

describe("CORS Security", () => {
  it("should reject chrome-extension origins not in EXTENSION_ORIGINS", async () => {
    const res = await request(app)
      .get("/v1/health")
      .set("Origin", "chrome-extension://unknown-extension-id");

    // Only extensions listed in EXTENSION_ORIGINS env var are allowed
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("should reject non-allowlisted web origins", async () => {
    const res = await request(app)
      .get("/v1/health")
      .set("Origin", "https://evil-site.com");

    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });
});

