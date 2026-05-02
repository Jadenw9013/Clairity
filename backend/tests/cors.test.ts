import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../src/server.js";

describe("CORS Security", () => {
  it("should allow any chrome-extension origin (zero-config for users)", async () => {
    const res = await request(app)
      .get("/v1/health")
      .set("Origin", "chrome-extension://any-extension-id");

    expect(res.headers["access-control-allow-origin"]).toBe("chrome-extension://any-extension-id");
  });

  it("should reject non-allowlisted web origins", async () => {
    const res = await request(app)
      .get("/v1/health")
      .set("Origin", "https://evil-site.com");

    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });
});
