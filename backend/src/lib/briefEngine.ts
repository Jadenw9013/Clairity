// backend/src/lib/briefEngine.ts
// Extracts and updates living ConversationBrief summaries via LLM.
// All functions are fire-and-forget safe — they never throw.

import type { ConversationBrief } from "shared/types/index.ts";
import { callLlm } from "./llmClient.js";
import { EXTRACT_BRIEF_PROMPT, UPDATE_BRIEF_PROMPT, type Message } from "./llmPrompts.js";
import { logger } from "./logger.js";

const BRIEF_MAX_TOKENS = 300;

/** Max messages to include when extracting a brief — prevents token overflow */
const MAX_BRIEF_HISTORY_MESSAGES = 20;

/** Max chars per message in brief extraction — keeps payload compact */
const MAX_BRIEF_MSG_CHARS = 500;

/**
 * Extract the first balanced JSON object from a string. Tolerates markdown
 * code fences or trailing commentary around a single `{...}` object.
 * Returns the substring or null if no balanced object is found.
 *
 * Preferred over a greedy `/\{[\s\S]*\}/` regex because that pattern picks
 * up stray trailing braces and can fail on inputs with multiple objects.
 */
export function extractJsonObject(raw: string): string | null {
  const start = raw.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < raw.length; i++) {
    const ch = raw[i];
    if (inString) {
      if (escape) { escape = false; continue; }
      if (ch === "\\") { escape = true; continue; }
      if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') { inString = true; continue; }
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return raw.slice(start, i + 1);
    }
  }
  return null;
}

/**
 * Defense-in-depth sanitiser for LLM-emitted brief strings.
 * Strips ASCII and Unicode control characters (which have no semantic
 * meaning in a brief and can break logs/UIs). HTML angle brackets are
 * preserved — the client is responsible for safe rendering via textContent.
 */
function sanitizeBriefString(s: string): string {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    // Strip C0 (0-31), DEL (127), and C1 (128-159) control blocks
    if (code <= 31 || code === 127 || (code >= 128 && code <= 159)) continue;
    out += s[i];
  }
  return out.trim();
}

/**
 * Parse raw LLM JSON output into a ConversationBrief.
 * Returns null if the shape is invalid or JSON is malformed.
 */
function parseBriefJson(raw: string, messageCount: number): ConversationBrief | null {
  try {
    const jsonText = extractJsonObject(raw);
    if (!jsonText) return null;

    const parsed = JSON.parse(jsonText) as Record<string, unknown>;
    const goal = typeof parsed["goal"] === "string" ? sanitizeBriefString(parsed["goal"]) : "";
    const userStyle = typeof parsed["userStyle"] === "string" ? sanitizeBriefString(parsed["userStyle"]) : "";
    const activeTopic = typeof parsed["activeTopic"] === "string" ? sanitizeBriefString(parsed["activeTopic"]) : "";

    const establishedContext = Array.isArray(parsed["establishedContext"])
      ? (parsed["establishedContext"] as unknown[])
          .filter((x): x is string => typeof x === "string")
          .map(sanitizeBriefString)
          .filter((x) => x.length > 0)
          .slice(0, 5)
      : [];

    const avoid = Array.isArray(parsed["avoid"])
      ? (parsed["avoid"] as unknown[])
          .filter((x): x is string => typeof x === "string")
          .map(sanitizeBriefString)
          .filter((x) => x.length > 0)
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
 * Prepare history for brief extraction: cap message count and truncate content.
 * Uses the most recent messages (they carry the most relevant context).
 */
export function prepareBriefHistory(history: Message[]): Message[] {
  const capped = history.slice(-MAX_BRIEF_HISTORY_MESSAGES);
  return capped.map((m) => ({
    ...m,
    content: m.content.length > MAX_BRIEF_MSG_CHARS
      ? m.content.slice(0, MAX_BRIEF_MSG_CHARS) + "… [truncated]"
      : m.content,
  }));
}

/**
 * Extract an initial ConversationBrief from raw conversation history.
 * Called once after messageCount >= 6.
 * Returns null on any LLM failure — caller keeps using raw history.
 */
export async function extractBrief(history: Message[], apiKey?: string): Promise<ConversationBrief | null> {
  const prepared = prepareBriefHistory(history);

  const formattedHistory = prepared
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
