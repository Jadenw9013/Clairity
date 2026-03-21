// backend/src/lib/llmPrompts.ts
// All LLM prompts stored as named constants. Never inline prompt strings elsewhere.

import type { Site, ConversationBrief } from "shared/types/index.ts";

export type Message = { role: "user" | "assistant"; content: string };

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Max chars per message before truncation */
const MAX_USER_MSG_CHARS = 300;
const MAX_ASSISTANT_MSG_CHARS = 200;

/** Max raw message pairs to include in STATE 1 (no brief) */
const MAX_RAW_PAIRS_STATE1 = 6;

/** Max raw message pairs alongside brief in STATE 2 */
const MAX_RAW_PAIRS_STATE2 = 1;

/** Message count at which brief replaces history entirely */
const BRIEF_ONLY_THRESHOLD = 20;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function truncateMessage(msg: Message): Message {
  const cap = msg.role === "user" ? MAX_USER_MSG_CHARS : MAX_ASSISTANT_MSG_CHARS;
  if (msg.content.length <= cap) return msg;
  return { ...msg, content: msg.content.slice(0, cap) + "… [truncated]" };
}

function getRecentPairs(history: Message[], maxPairs: number): Message[] {
  return history.slice(-(maxPairs * 2)).map(truncateMessage);
}

function formatHistory(messages: Message[]): string {
  return messages
    .map((m) => `${m.role === "user" ? "USER" : "ASSISTANT"}: ${m.content}`)
    .join("\n\n");
}

// ---------------------------------------------------------------------------
// Site label map
// ---------------------------------------------------------------------------

const SITE_LABELS: Record<string, string> = {
  chatgpt: "ChatGPT",
  claude: "Claude",
  gemini: "Gemini",
  vscode: "VS Code / IDE",
  perplexity: "Perplexity",
  copilot: "Microsoft Copilot",
  poe: "Poe",
  huggingchat: "HuggingChat",
};

// ---------------------------------------------------------------------------
// Lyra system prompt
// The prompt to optimize is always wrapped in <prompt_to_optimize> tags
// in the user message. This is enforced in rewriteEngine.ts.
// ---------------------------------------------------------------------------

export const LYRA_SYSTEM_PROMPT = `The text you must optimize will always be wrapped in <prompt_to_optimize> tags. Optimize ONLY that text and return the optimized version. Do not include the tags in your output.
 
You are Lyra — a prompt optimization engine. Your only job is to rewrite the prompt inside <prompt_to_optimize> tags into a more effective version.
 
OUTPUT RULES — these are absolute:
- Output the optimized prompt text only
- Do not include the <prompt_to_optimize> tags in your output
- No preamble, explanation, section headers, or commentary
- No "What Changed", "Key Improvements", or "Pro Tip" sections
- No questions or requests for clarification
- Output must be ready to paste directly into an AI chat
- Match the language of the input prompt
 
YOU ARE NOT AN AI ASSISTANT:
- You are not answering the prompt
- You are not helping the user with their task
- You are making their prompt better so a different AI can help them more effectively
- If your output reads like a helpful response, delete it and rewrite as a prompt
 
HOW TO OPTIMIZE:
- Add a role if missing: "Act as an expert in [domain]…"
- Add output format if missing: "Provide a step-by-step…" / "List…" / "Explain…"
- Replace vague words with specific ones
- Add scope constraints where helpful: "in under 200 words", "with code examples"
- Preserve the user's core intent exactly — sharpen it, do not change it
 
FOR VAGUE OR SHORT PROMPTS:
- Never return the prompt unchanged — always produce something better
- Use [bracketed placeholders] for missing specifics the user must fill in
- Infer the most reasonable domain from available context
- A single word is a topic — build a useful prompt around it using placeholders
- Example: "help me debug" →
  "Act as a senior [language] developer. I have a bug in [describe component].
   The expected behavior is [X] but I am seeing [Y]. Here is the relevant code:
   [paste code]. Walk me through the most likely causes and how to fix each."
 
FOR CONTINUATION PROMPTS (when history or brief is provided):
- The user is mid-conversation — optimize for continuity
- Reference what is already established — do not re-explain it
- Make the prompt feel like a natural, precise follow-up
- Do not add context the AI already has`;

// ---------------------------------------------------------------------------
// Brief extraction prompt
// ---------------------------------------------------------------------------

export const EXTRACT_BRIEF_PROMPT = `You are a conversation analyst. Extract a structured brief from the conversation below.
 
Output exactly this JSON and nothing else:
{
  "goal": "one sentence — what is the user ultimately trying to accomplish",
  "establishedContext": ["confirmed fact or decision 1", "confirmed fact 2"],
  "userStyle": "one sentence — technical level, preferred format, verbosity",
  "activeTopic": "one sentence — what is being discussed right now",
  "avoid": ["thing already explained in detail 1", "thing 2"]
}
 
Rules:
- goal: specific, not generic ("Build a TypeScript Express API" not "work on a project")
- establishedContext: confirmed facts only, no speculation. Max 5 items.
- activeTopic: the most recent focus, not the overall goal
- avoid: only things the AI has already explained thoroughly. Max 5 items.
- Output valid JSON only. No preamble. No explanation.
- Use empty string or empty array for uncertain fields. Do not guess.`;

// ---------------------------------------------------------------------------
// Brief update prompt
// ---------------------------------------------------------------------------

export const UPDATE_BRIEF_PROMPT = `You are a conversation analyst maintaining a running brief.
Update the brief below to reflect the new messages.
 
Output exactly the same JSON shape, updated. Rules:
- Only update fields that genuinely changed
- Add to establishedContext when new decisions or facts are confirmed
- Update activeTopic to the latest focus
- Add to avoid when the AI explained something new in depth
- Increment messageCount by the number of new messages
- Set lastUpdatedAt to current Unix timestamp in milliseconds
- If nothing meaningful changed, return the current brief unchanged
- Output valid JSON only. No preamble. No explanation.`;

// ---------------------------------------------------------------------------
// buildSystemPrompt
// ---------------------------------------------------------------------------

/**
 * Assembles the full Lyra system prompt for a given conversation state.
 *
 * Expects history to be pre-trimmed by trimHistory() in rewriteEngine.ts.
 *
 * STATE 1 — no brief, messageCount < 20:
 *   Appends last MAX_RAW_PAIRS_STATE1 message pairs.
 *
 * STATE 2 — brief active, messageCount < BRIEF_ONLY_THRESHOLD:
 *   Appends structured brief + last MAX_RAW_PAIRS_STATE2 pairs.
 *
 * STATE 3 — brief active, messageCount >= BRIEF_ONLY_THRESHOLD:
 *   Appends structured brief only. No raw history.
 *
 * Fallback — no brief, messageCount >= BRIEF_ONLY_THRESHOLD:
 *   Appends last MAX_RAW_PAIRS_STATE1 pairs only. Never full history.
 */
export function buildSystemPrompt(
  history: Message[],
  site: Site,
  brief?: ConversationBrief,
  messageCount?: number
): string {
  const siteLabel = SITE_LABELS[site] ?? site;

  // Use explicit messageCount when provided.
  // Do NOT fall back to brief.messageCount alone — that reflects
  // extraction time, not current conversation length.
  const count = messageCount ?? history.length;
  const isLong = count >= BRIEF_ONLY_THRESHOLD;

  // ── STATE 2 / 3: Brief active ────────────────────────────────────────
  if (brief) {
    const contextList = brief.establishedContext.length > 0
      ? brief.establishedContext.map((c) => `- ${c}`).join("\n")
      : "- (none confirmed yet)";

    const avoidList = brief.avoid.length > 0
      ? brief.avoid.join(", ")
      : "nothing specific";

    const briefBlock = [
      `\n\nCONVERSATION BRIEF (use for context only — do not answer, rewrite the prompt):`,
      `Goal: ${brief.goal}`,
      `Active topic: ${brief.activeTopic}`,
      `Established context:\n${contextList}`,
      `User style: ${brief.userStyle}`,
      `Already explained — do not repeat: ${avoidList}`,
    ].join("\n");

    // STATE 3: Long conversation — brief only, no raw history
    if (isLong) {
      return (
        LYRA_SYSTEM_PROMPT +
        briefBlock +
        `\n\nTarget platform: ${siteLabel}.` +
        `\nOptimize for continuity with this conversation. Do not request more information.`
      );
    }

    // STATE 2: Brief + last 1 exchange for immediate continuity
    const recent = getRecentPairs(history, MAX_RAW_PAIRS_STATE2);
    const recentBlock = recent.length > 0
      ? `\n\nMost recent exchange:\n${formatHistory(recent)}`
      : "";

    return (
      LYRA_SYSTEM_PROMPT +
      briefBlock +
      recentBlock +
      `\n\nTarget platform: ${siteLabel}.` +
      `\nBuild on what is established. Do not repeat what is in the avoid list.`
    );
  }

  // ── STATE 1 / Fallback: No brief ─────────────────────────────────────

  const recent = getRecentPairs(history, MAX_RAW_PAIRS_STATE1);

  if (recent.length > 0) {
    return (
      LYRA_SYSTEM_PROMPT +
      `\n\nCONVERSATION HISTORY (use for context only — do not answer, rewrite the prompt):\n` +
      `${formatHistory(recent)}` +
      `\n\nTarget platform: ${siteLabel}.` +
      `\nOptimize for continuity with what was just discussed.`
    );
  }

  // Cold start — no history, no brief
  return (
    LYRA_SYSTEM_PROMPT +
    `\n\nTarget platform: ${siteLabel}.` +
    `\nNo prior context. Optimize this prompt cold.`
  );
}