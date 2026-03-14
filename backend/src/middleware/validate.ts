import type { Request, Response, NextFunction } from "express";
import type { ZodSchema, ZodError } from "zod";

/**
 * Express middleware factory: validates request body against a Zod schema.
 * Returns 400 with structured error on failure.
 */
export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const zodError = result.error as ZodError;
      res.status(400).json({
        error: zodError.errors.map((e) => e.message).join("; "),
        code: "VALIDATION_ERROR",
      });
      return;
    }
    req.body = result.data;
    next();
  };
}
