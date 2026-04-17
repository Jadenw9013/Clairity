import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { requireAuth } from "../src/middleware/auth.js";
import * as tokenLib from "../src/lib/token.js";

vi.mock("../src/lib/token.js", () => ({
  verifyToken: vi.fn(),
}));

describe("requireAuth middleware", () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    vi.resetAllMocks();
    mockReq = {
      headers: {},
    };
    mockRes = {
      json: vi.fn(),
    };
    mockRes.status = vi.fn().mockReturnValue(mockRes);
    mockNext = vi.fn();
  });

  it("should return 401 if Authorization header is missing", () => {
    requireAuth(mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: "Missing or malformed Authorization header",
      code: "UNAUTHORIZED",
    });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it("should return 401 if Authorization header does not start with Bearer", () => {
    mockReq.headers!.authorization = "Basic dG9rZW4=";

    requireAuth(mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: "Missing or malformed Authorization header",
      code: "UNAUTHORIZED",
    });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it("should return 401 if token is invalid or expired", () => {
    mockReq.headers!.authorization = "Bearer invalid-token";
    vi.mocked(tokenLib.verifyToken).mockReturnValue(null);

    requireAuth(mockReq as Request, mockRes as Response, mockNext);

    expect(tokenLib.verifyToken).toHaveBeenCalledWith("invalid-token");
    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: "Invalid or expired session token",
      code: "UNAUTHORIZED",
    });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it("should attach sessionId and call next if token is valid", () => {
    mockReq.headers!.authorization = "Bearer valid-token";
    const payload = { sid: "session-123", exp: Date.now() + 1000 };
    vi.mocked(tokenLib.verifyToken).mockReturnValue(payload);

    requireAuth(mockReq as Request, mockRes as Response, mockNext);

    expect(tokenLib.verifyToken).toHaveBeenCalledWith("valid-token");
    expect((mockReq as any).sessionId).toBe("session-123");
    expect(mockNext).toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalled();
    expect(mockRes.json).not.toHaveBeenCalled();
  });
});
