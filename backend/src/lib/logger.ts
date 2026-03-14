// backend/src/lib/logger.ts
// Standalone logger instance to avoid circular imports.
// server.ts re-exports this; other modules should import from here.

import pino from "pino";

const LOG_LEVEL = process.env["LOG_LEVEL"] ?? "info";

export const logger = pino({ level: LOG_LEVEL });
