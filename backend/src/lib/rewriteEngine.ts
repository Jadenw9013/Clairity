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
 * Run the Lyra prompt optimization pipeline.
 * On any LLM failure returns the original prompt unchanged with model="fallback".
 * Never throws.
 */
export async function callLyra(input: LyraInput): Promise<LyraOutput> {
  const { prompt, history, site, brief, apiKey } = input;

  const system = buildSystemPrompt(history, site, brief);

  // Compose message list: history context + the user's current prompt
  const messages: Message[] = [
    ...history,
    { role: "user", content: prompt },
  ];

  const result = await callLlm({ system, messages }, apiKey);

  if (!result) {
    logger.info({ module: "rewriteEngine", historyLen: history.length, briefActive: !!brief }, "LLM unavailable — returning original prompt");
    return { enhanced_prompt: prompt, model: "fallback" };
  }

  return { enhanced_prompt: result.content, model: result.model };
}
