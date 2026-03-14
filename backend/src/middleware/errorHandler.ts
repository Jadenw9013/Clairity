import type { Request, Response, NextFunction } from "express";
import type { Logger } from "pino";

/**
 * Global Express error handler.
 * Returns structured JSON matching the ErrorResponse contract.
 */
export function errorHandler(logger: Logger) {
  return (
    err: Error,
    _req: Request,
    res: Response,
    _next: NextFunction
  ): void => {
    logger.error({ err }, "Unhandled error");
    res.status(500).json({
      error: "Internal server error",
      code: "INTERNAL_ERROR",
    });
  };
}
