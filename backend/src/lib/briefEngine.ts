// backend/src/lib/briefEngine.ts
// Extracts and updates living ConversationBrief summaries via LLM.
// All functions are fire-and-forget safe — they never throw.

import type { ConversationBrief } from "shared/types/index.ts";
import { callLlm } from "./llmClient.js";
import { EXTRACT_BRIEF_PROMPT, UPDATE_BRIEF_PROMPT, type Message } from "./llmPrompts.js";
import { logger } from "./logger.js";

const BRIEF_MAX_TOKENS = 300;

/**
 * Parse raw LLM JSON output into a ConversationBrief.
 * Returns null if the shape is invalid or JSON is malformed.
 */
function parseBriefJson(raw: string, messageCount: number): ConversationBrief | null {
  try {
    // Extract JSON from potential markdown code fences
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    const goal = typeof parsed["goal"] === "string" ? parsed["goal"] : "";
    const userStyle = typeof parsed["userStyle"] === "string" ? parsed["userStyle"] : "";
    const activeTopic = typeof parsed["activeTopic"] === "string" ? parsed["activeTopic"] : "";

    const establishedContext = Array.isArray(parsed["establishedContext"])
      ? (parsed["establishedContext"] as unknown[])
          .filter((x): x is string => typeof x === "string")
          .slice(0, 5)
      : [];

    const avoid = Array.isArray(parsed["avoid"])
      ? (parsed["avoid"] as unknown[])
          .filter((x): x is string => typeof x === "string")
          .slice(0, 5)
      : [];

    return {
      goal,
      establishedContext,
      userStyle,
      activeTopic,
      avoid,
      messageCount,
      lastUpdatedAt: Date.now(),
    };
  } catch {
    return null;
  }
}

/**
 * Extract an initial ConversationBrief from raw conversation history.
 * Called once after messageCount >= 6.
 * Returns null on any LLM failure — caller keeps using raw history.
 */
export async function extractBrief(history: Message[], apiKey?: string): Promise<ConversationBrief | null> {
  const formattedHistory = history
    .map((m) => `${m.role === "user" ? "USER" : "ASSISTANT"}: ${m.content}`)
    .join("\n\n");

  const result = await callLlm({
    system: EXTRACT_BRIEF_PROMPT,
    messages: [
      {
        role: "user",
        content: `Conversation:\n\n${formattedHistory}`,
      },
    ],
    maxTokens: BRIEF_MAX_TOKENS,
  }, apiKey);

  if (!result) {
    logger.info({ module: "briefEngine" }, "extractBrief: LLM unavailable — returning null");
    return null;
  }

  const brief = parseBriefJson(result.content, history.length);
  if (!brief) {
    logger.warn({ module: "briefEngine", raw: result.content.slice(0, 200) }, "extractBrief: JSON parse failed");
    return null;
  }

  logger.info({ module: "briefEngine", messageCount: brief.messageCount }, "Brief extracted successfully");
  return brief;
}

/**
 * Update an existing ConversationBrief with newly observed messages.
 * Called every 4 messages after brief is active.
 * Returns currentBrief unchanged on any LLM failure.
 */
export async function updateBrief(
  currentBrief: ConversationBrief,
  newMessages: Message[],
  apiKey?: string
): Promise<ConversationBrief> {
  const currentBriefJson = JSON.stringify(
    {
      goal: currentBrief.goal,
      establishedContext: currentBrief.establishedContext,
      userStyle: currentBrief.userStyle,
      activeTopic: currentBrief.activeTopic,
      avoid: currentBrief.avoid,
    },
    null,
    2
  );

  const formattedNew = newMessages
    .map((m) => `${m.role === "user" ? "USER" : "ASSISTANT"}: ${m.content}`)
    .join("\n\n");

  const userContent =
    `Current brief:\n${currentBriefJson}\n\nNew messages:\n\n${formattedNew}`;

  const result = await callLlm({
    system: UPDATE_BRIEF_PROMPT,
    messages: [{ role: "user", content: userContent }],
    maxTokens: BRIEF_MAX_TOKENS,
  }, apiKey);

  if (!result) {
    logger.info({ module: "briefEngine" }, "updateBrief: LLM unavailable — returning current brief");
    return currentBrief;
  }

  const updatedCount = currentBrief.messageCount + newMessages.length;
  const updated = parseBriefJson(result.content, updatedCount);
  if (!updated) {
    logger.warn({ module: "briefEngine" }, "updateBrief: JSON parse failed — returning current brief");
    return currentBrief;
  }

  logger.info({ module: "briefEngine", messageCount: updated.messageCount }, "Brief updated successfully");
  return updated;
}
