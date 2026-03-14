import express from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import healthRouter from "./routes/v1/health.js";
import rewriteRouter from "./routes/v1/rewrite.js";
import sessionRouter from "./routes/v1/session.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { requireAuth } from "./middleware/auth.js";
import { apiLimiter, sessionLimiter } from "./middleware/rateLimit.js";
import improveRouter from "./routes/v1/improve.js";
import { logFeatureFlags } from "./lib/featureFlags.js";
import { logger } from "./lib/logger.js";

// Re-export logger for any existing consumers
export { logger };

const PORT = parseInt(process.env["PORT"] ?? "3001", 10);
const CORS_ORIGIN = process.env["CORS_ORIGIN"] ?? "*";
const NODE_ENV = process.env["NODE_ENV"] ?? "development";
logFeatureFlags(logger);

// Strict production validations
if (NODE_ENV === "production") {
  if (CORS_ORIGIN === "*") {
    logger.fatal("CORS_ORIGIN=* is not allowed in production. Set an explicit origin.");
    process.exit(1);
  }
  if (!process.env["SESSION_SECRET"]) {
    logger.fatal("SESSION_SECRET is required in production. Must be at least 32 characters.");
    process.exit(1);
  }
}

// --- CORS allowlist ---
const EXTENSION_ORIGINS_RAW = process.env["EXTENSION_ORIGINS"] ?? "";
const extensionOrigins = EXTENSION_ORIGINS_RAW
  ? EXTENSION_ORIGINS_RAW.split(",").map(o => o.trim()).filter(Boolean)
  : [];

const DEV_WEB_ORIGINS = ["http://localhost:3001"];

if (NODE_ENV === "production" && extensionOrigins.length === 0) {
  logger.warn("EXTENSION_ORIGINS is not set. No Chrome extension origins will be allowed.");
}

function buildAllowedOrigins(): string[] {
  const envOrigins = CORS_ORIGIN === "*" ? [] : CORS_ORIGIN.split(",").map(o => o.trim());
  if (NODE_ENV === "production") {
    return [...new Set([...envOrigins, ...extensionOrigins])];
  }
  // Dev: explicit origins + extension env origins (chrome-extension:// handled dynamically below)
  return [...new Set([...envOrigins, ...DEV_WEB_ORIGINS, ...extensionOrigins])];
}

const allowedOrigins = buildAllowedOrigins();
logger.info({ allowedOrigins, devMode: NODE_ENV !== "production" }, "CORS allowlist configured");

function corsOriginCallback(
  origin: string | undefined,
  callback: (err: Error | null, allow?: boolean) => void
): void {
  // Allow requests with no origin (e.g., curl, server-to-server)
  if (!origin) {
    callback(null, true);
    return;
  }

  // Check explicit allowlist first
  if (allowedOrigins.includes(origin)) {
    if (NODE_ENV !== "production") {
      logger.debug({ origin, rule: "allowlist" }, "CORS allowed");
    }
    callback(null, true);
    return;
  }

  // In development: auto-allow ANY chrome-extension:// origin (handles ID churn)
  if (NODE_ENV !== "production" && origin.startsWith("chrome-extension://")) {
    logger.debug({ origin, rule: "dev-extension-wildcard" }, "CORS allowed (dev: any extension)");
    callback(null, true);
    return;
  }

  // Rejected — log in dev, return clean rejection (no Error = no 500)
  if (NODE_ENV !== "production") {
    logger.debug({ origin }, "CORS rejected");
  }
  callback(null, false);
}

export const app = express();

// Trust proxy for rate limiter IP extraction behind reverse proxy
app.set("trust proxy", NODE_ENV === "production" ? 1 : false);

// Global middleware
app.use(cors({ origin: corsOriginCallback }));
app.use(express.json({ limit: "10kb" }));
app.use(
  pinoHttp({
    logger,
    autoLogging: { ignore: (req) => req.url === "/v1/health" },
  })
);

// Public routes (no auth)
app.use("/v1", healthRouter);
app.use("/v1/session", sessionLimiter);
app.use("/v1", sessionRouter);

// Protected routes (auth required + rate limited)
app.use("/v1", requireAuth, apiLimiter, rewriteRouter);
app.use("/v1", requireAuth, apiLimiter, improveRouter);

// Global error handler (must be last)
app.use(errorHandler(logger));

// Start server only when run directly (not imported by tests)
const isDirectRun =
  process.argv[1] &&
  import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"));
if (isDirectRun) {
  app.listen(PORT, () => {
    logger.info({ port: PORT, env: NODE_ENV }, "Clairity backend started");
  });
}
