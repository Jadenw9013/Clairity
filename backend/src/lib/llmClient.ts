// backend/src/lib/llmClient.ts
// Single Anthropic SDK entry point for all LLM calls.
// Never throws — returns null on any error.
// Never logs prompt content or API keys.

import Anthropic from "@anthropic-ai/sdk";
import { logger } from "./logger.js";

const MODEL = process.env["ANTHROPIC_MODEL"] ?? "claude-haiku-4-5-20251001";
const TIMEOUT_MS = 3000;
const MAX_RETRIES = 1;
const MAX_TOKENS = 600;

export interface LlmCallParams {
  system: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
}

export interface LlmResult {
  content: string;
  model: string;
}

let _client: Anthropic | null = null;

function getClient(): Anthropic | null {
  const apiKey = process.env["ANTHROPIC_API_KEY"] ?? process.env["LLM_API_KEY"] ?? "";
  if (!apiKey) {
    logger.warn({ module: "llmClient" }, "ANTHROPIC_API_KEY not set — rewrite will fallback");
    return null;
  }
  if (!_client) {
    _client = new Anthropic({ apiKey, timeout: TIMEOUT_MS, maxRetries: MAX_RETRIES });
  }
  return _client;
}

/**
 * Call Claude and return the text response.
 * Returns null on any failure — caller MUST apply fallback.
 */
export async function callLlm(params: LlmCallParams): Promise<LlmResult | null> {
  const client = getClient();
  if (!client) return null;

  const start = Date.now();
  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
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
