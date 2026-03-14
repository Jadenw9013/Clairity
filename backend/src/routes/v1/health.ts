import { Router } from "express";
import type { HealthResponse } from "shared/types/index.ts";

const router = Router();

router.get("/health", (_req, res) => {
  const body: HealthResponse = {
    status: "ok",
    version: "0.1.0",
    timestamp: new Date().toISOString(),
  };
  res.json(body);
});

export default router;
