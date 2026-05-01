// backend/src/lib/llmClient.ts
// Single Anthropic SDK entry point for all LLM calls.
// Never throws — returns null on any error.
// Never logs prompt content or API keys.

import Anthropic from "@anthropic-ai/sdk";
import { logger } from "./logger.js";

const MODEL = process.env["ANTHROPIC_MODEL"] ?? "claude-haiku-4-5-20251001";
const TIMEOUT_MS = 8000;
const MAX_RETRIES = 2;
const MAX_TOKENS = 600;

export interface LlmCallParams {
  system: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  maxTokens?: number;
}

export interface LlmResult {
  content: string;
  model: string;
}

function getClient(apiKey?: string): Anthropic | null {
  if (!apiKey) {
    logger.warn({ module: "llmClient" }, "No API key provided — rewrite will fallback");
    return null;
  }
  return new Anthropic({ apiKey, timeout: TIMEOUT_MS, maxRetries: MAX_RETRIES });
}

/**
 * Call Claude and return the text response.
 * Returns null on any failure — caller MUST apply fallback.
 */
export async function callLlm(params: LlmCallParams, apiKey?: string): Promise<LlmResult | null> {
  const client = getClient(apiKey);
  if (!client) return null;

  const start = Date.now();
  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: params.maxTokens ?? MAX_TOKENS,
      system: params.system,
      messages: params.messages,
    });

    const latencyMs = Date.now() - start;
    const content =
      response.content[0]?.type === "text" ? response.content[0].text.trim() : null;

    if (!content) {
      logger.warn({ module: "llmClient", latencyMs }, "LLM returned empty content — fallback");
      return null;
    }

    logger.info({ module: "llmClient", model: response.model, latencyMs, success: true }, "LLM call succeeded");
    return { content, model: response.model };
  } catch (err) {
    const latencyMs = Date.now() - start;
    const errMsg = err instanceof Error ? err.message : String(err);
    logger.warn({ module: "llmClient", latencyMs, success: false, error: errMsg }, "LLM call failed — fallback");
    return null;
  }
}

