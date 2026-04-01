// backend/src/lib/rewriteEngine.ts
// Conversation-aware Lyra rewrite engine.
// Delegates to llmClient; falls back to original prompt on any failure.

import { buildSystemPrompt, type Message } from "./llmPrompts.js";
import { callLlm } from "./llmClient.js";
import { logger } from "./logger.js";
import type { Site, ConversationBrief } from "shared/types/index.ts";

export interface LyraInput {
  prompt: string;
  history: Message[];
  site: Site;
  brief?: ConversationBrief;
  apiKey?: string;
}

export interface LyraOutput {
  enhanced_prompt: string;
  model: string;
}

/**
 * Trim history based on message count tier and brief presence.
 *
 * - messageCount < 6 (no brief):          pass full history (small, STATE 1)
 * - messageCount 6–19 (brief active):     last 2 pairs (4 messages)
 * - messageCount >= 20 (brief active):    no history, brief is sufficient
 * - messageCount >= 20 (brief null):      last 4 pairs (8 messages), never full
 */
export function trimHistory(
  history: Message[],
  brief: ConversationBrief | undefined
): Message[] {
  const messageCount = brief?.messageCount ?? history.length;

  if (brief) {
    // Brief is active — trim aggressively
    if (messageCount >= 20) {
      return []; // brief-only, no raw history
    }
    // 6–19: last 2 pairs
    return history.slice(-4);
  }

  // No brief
  if (messageCount >= 20) {
    // Brief extraction failed — use last 4 pairs as safety net
    return history.slice(-8);
  }

  // STATE 1: small conversation, full history is fine
  return history;
}

/**
 * Run the Lyra prompt optimization pipeline.
 * On any LLM failure returns the original prompt unchanged with model="fallback".
 * Never throws.
 */
export async function callLyra(input: LyraInput): Promise<LyraOutput> {
  const { prompt, history, site, brief, apiKey } = input;

  const trimmed = trimHistory(history, brief);
  const messageCount = brief?.messageCount ?? history.length;

  const system = buildSystemPrompt(trimmed, site, brief, messageCount);

  // When no brief is available at 20+ messages, increase output token budget.
  // The fallback path includes 8 history messages in the payload, leaving less
  // room for output under the default 600-token cap.
  const isLongFallback = !brief && messageCount >= 20;
  const maxTokens = isLongFallback ? 800 : undefined;

  if (isLongFallback) {
    logger.warn(
      { module: "rewriteEngine", historyLen: history.length, messageCount },
      "No brief available at 20+ messages — using fallback history trim. Brief extraction may have failed."
    );
  }

  // Compose message list: trimmed history context + the user's current prompt
  // Wrap prompt in XML tags so Claude unambiguously knows what text to optimize
  const messages: Message[] = [
    ...trimmed,
    { role: "user", content: `<prompt_to_optimize>${prompt}</prompt_to_optimize>` },
  ];

  const result = await callLlm({ system, messages, maxTokens }, apiKey);

  if (!result) {
    logger.info({ module: "rewriteEngine", historyLen: history.length, trimmedLen: trimmed.length, briefActive: !!brief }, "LLM unavailable — returning original prompt");
    return { enhanced_prompt: prompt, model: "fallback" };
  }

  return { enhanced_prompt: result.content, model: result.model };
}
