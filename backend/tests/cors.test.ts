import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../src/server.js";

describe("CORS Security", () => {
  it("should not allow any chrome-extension origin in development if it is an arbitrary extension", async () => {
    // In dev mode, we want to ensure the wildcard behavior is removed or restricted.
    const res = await request(app)
      .get("/v1/health")
      .set("Origin", "chrome-extension://malicious-extension-id");

    // Express `cors` middleware omits the `Access-Control-Allow-Origin` header if origin is not allowed
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });
});
