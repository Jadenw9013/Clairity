import { Router } from "express";
import { z } from "zod";
import { validate } from "../../middleware/validate.js";
import { runImprovedPipeline } from "../../lib/rewriteEngine.js";
import { llmRewrite } from "../../lib/llmRewrite.js";
import { IMPROVED_MVP_ENABLED, MCS_ENABLED } from "../../lib/featureFlags.js";
import { fetchMcsContext } from "../../lib/mcsClient.js";
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

const improveSchema = z.object({
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

router.post("/improve", validate(improveSchema), async (req, res) => {
    if (!IMPROVED_MVP_ENABLED) {
        res.status(404).json({
            error: "Improve endpoint is not enabled",
            code: "FEATURE_DISABLED",
        });
        return;
    }

    const startTime = Date.now();
    const { prompt, context, options, preset, mcs } = req.body as z.infer<typeof improveSchema>;
    const mode = options?.mode ?? "enhance";

    // --- MCS context enrichment (same pattern as rewrite.ts) ---
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
                    logger.info({ mcs_status: "enriched", items: mcsResult.itemCount }, "Improve using MCS context");
                } else {
                    mcsContextMeta = { status: "fallback", reason: "no_data" };
                    logger.info("Improve fallback — MCS returned no usable context");
                }
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                logger.warn({ error: msg }, "Improve fallback — MCS context fetch failed unexpectedly");
                mcsContextMeta = { status: "fallback", reason: "error", error: msg };
            }
        } else {
            mcsContextMeta = { status: "skipped", reason: "contextMode=off" };
        }
    }

    // Run improved deterministic pipeline
    const result = runImprovedPipeline({ prompt, mode, preset: enrichedPreset });

    // Attempt LLM rewrite (returns null if disabled or fails → uses deterministic)
    const llmResult = await llmRewrite(prompt, result.detected_intent, mode);
    const finalPrompt = llmResult?.enhanced_prompt ?? result.enhanced_prompt;
    const modelUsed = llmResult?.model_used ?? result.model_used;

    const body: RewriteResponse & { risk?: unknown } = {
        enhanced_prompt: finalPrompt,
        score: result.score,
        changes: result.changes,
        warnings: result.warnings,
        clarifying_question: result.clarifying_question,
        risk: result.risk,
        metadata: {
            model_used: modelUsed,
            tokens_used: { input: prompt.length, output: finalPrompt.length },
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
