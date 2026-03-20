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

const briefSchema = z.object({
  goal: z.string().max(500).default(""),
  establishedContext: z.array(z.string().max(300)).max(5).default([]),
  userStyle: z.string().max(300).default(""),
  activeTopic: z.string().max(300).default(""),
  avoid: z.array(z.string().max(300)).max(5).default([]),
  messageCount: z.number().int().min(0).default(0),
  lastUpdatedAt: z.number().min(0).default(0),
});

const rewriteSchema = z.object({
  prompt: z.string().min(1, "Prompt is required").max(10000),
  history: z.array(messageSchema).max(40).default([]),
  site: z.enum(["chatgpt", "claude", "gemini", "vscode"]),
  brief: briefSchema.optional(),
});

const router = Router();

router.post("/rewrite", validate(rewriteSchema), async (req, res) => {
  const { prompt, history, site, brief } = req.body as z.infer<typeof rewriteSchema>;
  const userApiKey = req.headers["x-api-key"] as string | undefined;

  const result = await callLyra({ prompt, history, site, brief, apiKey: userApiKey });

  res.json({
    enhanced_prompt: result.enhanced_prompt,
    history_length: history.length,
    model: result.model,
    brief_active: !!brief,
  });
});

export default router;
