import { describe, it, expect, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";
import type { Logger } from "pino";
import { errorHandler } from "../../src/middleware/errorHandler.js";

describe("errorHandler middleware", () => {
  it("should log the error and send a 500 status with standard JSON response", () => {
    const mockLogger = {
      error: vi.fn(),
    } as unknown as Logger;

    const mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as Response;

    const mockReq = {} as Request;
    const mockNext = vi.fn() as NextFunction;

    const error = new Error("Test error");

    const handler = errorHandler(mockLogger);
    handler(error, mockReq, mockRes, mockNext);

    expect(mockLogger.error).toHaveBeenCalledWith({ err: error }, "Unhandled error");
    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: "Internal server error",
      code: "INTERNAL_ERROR",
    });
    expect(mockNext).not.toHaveBeenCalled();
  });
});
