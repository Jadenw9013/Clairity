import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Request, Response } from "express";
import { validateApiKey } from "../src/middleware/validateApiKey.js";

function makeRes(): Response {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  };
  return res as unknown as Response;
}

describe("validateApiKey", () => {
  const originalEnv = process.env["NODE_ENV"];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env["NODE_ENV"] = originalEnv;
  });

  describe("non-production (dev/test)", () => {
    beforeEach(() => {
      process.env["NODE_ENV"] = "development";
    });

    it("returns null when x-api-key is missing (allows env fallback)", () => {
      const res = makeRes();
      const result = validateApiKey({ headers: {} } as Request, res);
      expect(result).toBeNull();
      expect(res.status).not.toHaveBeenCalled();
    });

    it("returns the key when a valid sk-ant- key is provided", () => {
      const res = makeRes();
      const req = { headers: { "x-api-key": "sk-ant-abc123" } } as unknown as Request;
      expect(validateApiKey(req, res)).toBe("sk-ant-abc123");
      expect(res.status).not.toHaveBeenCalled();
    });

    it("returns false with 400 for malformed keys", () => {
      const res = makeRes();
      const req = { headers: { "x-api-key": "sk-openai-xyz" } } as unknown as Request;
      expect(validateApiKey(req, res)).toBe(false);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: "INVALID_API_KEY" })
      );
    });
  });

  describe("production", () => {
    beforeEach(() => {
      process.env["NODE_ENV"] = "production";
    });

    it("returns false with 401 when x-api-key is missing", () => {
      // Regression: previously returned null in production, silently spending
      // operator env key for anonymous callers.
      const res = makeRes();
      const result = validateApiKey({ headers: {} } as Request, res);
      expect(result).toBe(false);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: "MISSING_API_KEY" })
      );
    });

    it("returns false with 401 for empty-string x-api-key", () => {
      const res = makeRes();
      const req = { headers: { "x-api-key": "" } } as unknown as Request;
      expect(validateApiKey(req, res)).toBe(false);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it("accepts a valid sk-ant- key in production", () => {
      const res = makeRes();
      const req = { headers: { "x-api-key": "sk-ant-prod-xyz" } } as unknown as Request;
      expect(validateApiKey(req, res)).toBe("sk-ant-prod-xyz");
      expect(res.status).not.toHaveBeenCalled();
    });

    it("rejects overlong keys with 400", () => {
      const res = makeRes();
      const longKey = "sk-ant-" + "a".repeat(250);
      const req = { headers: { "x-api-key": longKey } } as unknown as Request;
      expect(validateApiKey(req, res)).toBe(false);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });
});
