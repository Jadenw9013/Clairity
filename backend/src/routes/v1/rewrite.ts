import { Router } from "express";
import { z } from "zod";
import { validate } from "../../middleware/validate.js";
import { runRewritePipeline } from "../../lib/rewriteEngine.js";
import { fetchMcsContext } from "../../lib/mcsClient.js";
import { MCS_ENABLED } from "../../lib/featureFlags.js";
import { logger } from "../../lib/logger.js";
import type { RewriteResponse } from "shared/types/index.ts";

const mcsSchema = z.object({
  workspaceId: z.string().optional(),
  projectId: z.string().optional(),
  conversationId: z.string().optional(),
  sourceApp: z.string().optional(),
  contextMode: z.enum(["off", "auto", "pinned"]).optional(),
  pinnedCategories: z.array(z.string()).optional(),
}).optional();

const rewriteSchema = z.object({
  prompt: z.string().min(1, "Prompt is required").max(10000),
  context: z.object({
    site: z.enum(["chatgpt", "claude", "gemini"]),
    conversation_type: z.enum(["new", "continuing"]).default("new"),
    language: z.string().default("en"),
  }),
  options: z
    .object({
      mode: z.enum(["enhance", "restructure", "expand"]).default("enhance"),
      preserve_intent: z.boolean().default(true),
      max_length: z.number().positive().optional(),
    })
    .optional(),
  preset: z
    .object({
      intent: z
        .enum(["coding", "writing", "research", "career", "general"])
        .optional(),
      tone: z.enum(["concise", "detailed", "professional"]).optional(),
      output_format: z
        .enum(["paragraph", "bullets", "step-by-step", "json", "code"])
        .optional(),
      additional_context: z.string().max(2000).optional(),
    })
    .optional(),
  mcs: mcsSchema,
});

const router = Router();

router.post("/rewrite", validate(rewriteSchema), async (req, res) => {
  const startTime = Date.now();
  const { prompt, context, options, preset, mcs } = req.body as z.infer<typeof rewriteSchema>;

  const mode = options?.mode ?? "enhance";

  // --- MCS context enrichment (optional, never blocks on failure) ---
  let mcsContextMeta: Record<string, unknown> = { status: "disabled" };
  let enrichedPreset = preset;

  if (MCS_ENABLED) {
    mcsContextMeta = { status: "skipped" };

    const effectiveMode = mcs?.contextMode ?? "auto";
    if (effectiveMode !== "off") {
      try {
        const mcsResult = await fetchMcsContext({
          prompt,
          site: context.site,
          workspaceId: mcs?.workspaceId,
          projectId: mcs?.projectId,
          conversationId: mcs?.conversationId,
          sourceApp: mcs?.sourceApp,
          contextMode: mcs?.contextMode,
          pinnedCategories: mcs?.pinnedCategories,
        });

        if (mcsResult) {
          const existingContext = preset?.additional_context ?? "";
          const mergedContext = existingContext
            ? `${existingContext}\n\n--- MCS Context ---\n${mcsResult.contextSnippet}`
            : mcsResult.contextSnippet;

          enrichedPreset = {
            ...preset,
            additional_context: mergedContext,
          };

          mcsContextMeta = {
            status: "enriched",
            source: mcsResult.source,
            item_count: mcsResult.itemCount,
            snippet_length: mcsResult.snippetLength,
            truncated: mcsResult.truncated,
          };
          logger.info({ mcs_status: "enriched", items: mcsResult.itemCount }, "Rewrite using MCS context");
        } else {
          mcsContextMeta = { status: "fallback", reason: "no_data" };
          logger.info("Rewrite fallback — MCS returned no usable context");
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.warn({ error: msg }, "Rewrite fallback — MCS context fetch failed unexpectedly");
        mcsContextMeta = { status: "fallback", reason: "error", error: msg };
      }
    } else {
      mcsContextMeta = { status: "skipped", reason: "contextMode=off" };
    }
  }

  const result = runRewritePipeline({ prompt, mode, preset: enrichedPreset });

  const body: RewriteResponse = {
    enhanced_prompt: result.enhanced_prompt,
    score: result.score,
    changes: result.changes,
    warnings: result.warnings,
    clarifying_question: result.clarifying_question,
    metadata: {
      model_used: "deterministic-v1",
      tokens_used: { input: prompt.length, output: result.enhanced_prompt.length },
      rewrite_mode: mode,
      processing_time_ms: Date.now() - startTime,
      detected_intent: result.detected_intent,
      mcs_context: mcsContextMeta,
    },
    request_id: crypto.randomUUID(),
  };

  res.json(body);
});

export default router;
