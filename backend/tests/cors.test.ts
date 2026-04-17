import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import request from "supertest";

// We need to re-import or re-require the app to test with different env variables
// However, server.ts reads process.env at module level. We can test via vitest by modifying process.env before importing,
// but since the app is exported, we might need to reset modules.
// Let's create tests for the CORS headers.
// Supertest and Express will handle setting the Origin header and we can check Access-Control-Allow-Origin.

describe("CORS behavior", () => {
  let app: any;

  beforeEach(async () => {
    vi.resetModules();
    // Set environment variables for the test
    process.env["NODE_ENV"] = "development";
    process.env["CORS_ORIGIN"] = "*";
    process.env["EXTENSION_ORIGINS"] = "chrome-extension://allowed-extension-id,chrome-extension://another-allowed-id";

    // Dynamically import to ensure env variables are read
    const serverModule = await import("../src/server.js");
    app = serverModule.app;
  });

  afterEach(() => {
    delete process.env["NODE_ENV"];
    delete process.env["CORS_ORIGIN"];
    delete process.env["EXTENSION_ORIGINS"];
  });

  it("allows requests from allowed extension origins", async () => {
    const res = await request(app)
      .get("/v1/health")
      .set("Origin", "chrome-extension://allowed-extension-id");

    expect(res.status).toBe(200);
    expect(res.headers["access-control-allow-origin"]).toBe("chrome-extension://allowed-extension-id");
  });

  it("rejects requests from unauthorized extension origins", async () => {
    const res = await request(app)
      .get("/v1/health")
      .set("Origin", "chrome-extension://unauthorized-id");

    // cors middleware either drops the Access-Control-Allow-Origin header or returns it empty,
    // or rejects it. Since it's health check without auth, it will just not include the header.
    // If we make a preflight request, it will be 204 or rejected. Let's do an OPTIONS request.
    const optionsRes = await request(app)
      .options("/v1/health")
      .set("Origin", "chrome-extension://unauthorized-id")
      .set("Access-Control-Request-Method", "GET");

    // Supertest expects no CORS headers for unauthorized origin
    expect(optionsRes.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("allows requests with no origin (e.g. curl)", async () => {
    const res = await request(app)
      .get("/v1/health");

    expect(res.status).toBe(200);
    // Since there's no Origin, CORS headers are not set or set to * depending on cors package
    // The important thing is it succeeds
  });

  it("allows requests from DEV_WEB_ORIGINS in development", async () => {
    const res = await request(app)
      .get("/v1/health")
      .set("Origin", "http://localhost:3001");

    expect(res.status).toBe(200);
    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:3001");
  });
});
