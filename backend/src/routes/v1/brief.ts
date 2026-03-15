// backend/src/routes/v1/brief.ts
// POST /v1/brief/extract — extract a ConversationBrief from raw history
// POST /v1/brief/update  — update an existing brief with new messages
// Both routes require auth (applied at server.ts level).

import { Router } from "express";
import { z } from "zod";
import { validate } from "../../middleware/validate.js";
import { extractBrief, updateBrief } from "../../lib/briefEngine.js";

const router = Router();

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

const extractSchema = z.object({
  history: z.array(messageSchema).min(1).max(40),
});

const updateSchema = z.object({
  currentBrief: briefSchema,
  newMessages: z.array(messageSchema).min(1).max(20),
});

// POST /v1/brief/extract
router.post("/brief/extract", validate(extractSchema), async (req, res) => {
  const { history } = req.body as z.infer<typeof extractSchema>;
  const brief = await extractBrief(history);
  res.json({ brief });
});

// POST /v1/brief/update
router.post("/brief/update", validate(updateSchema), async (req, res) => {
  const { currentBrief, newMessages } = req.body as z.infer<typeof updateSchema>;
  const brief = await updateBrief(currentBrief, newMessages);
  res.json({ brief });
});

export default router;
