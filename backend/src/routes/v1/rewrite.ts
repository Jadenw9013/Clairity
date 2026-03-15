// backend/src/routes/v1/rewrite.ts
// POST /v1/rewrite — conversation-aware prompt enhancement via Lyra.

import { Router } from "express";
import { z } from "zod";
import { validate } from "../../middleware/validate.js";
import { callLyra } from "../../lib/rewriteEngine.js";

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(20000),
});

const rewriteSchema = z.object({
  prompt: z.string().min(1, "Prompt is required").max(10000),
  history: z.array(messageSchema).max(40).default([]),
  site: z.enum(["chatgpt", "claude", "gemini"]),
});

const router = Router();

router.post("/rewrite", validate(rewriteSchema), async (req, res) => {
  const { prompt, history, site } = req.body as z.infer<typeof rewriteSchema>;

  const result = await callLyra({ prompt, history, site });

  res.json({
    enhanced_prompt: result.enhanced_prompt,
    history_length: history.length,
    model: result.model,
  });
});

export default router;
