// backend/src/lib/llmPrompts.ts
// All LLM prompts stored as named constants. Never inline prompt strings elsewhere.

import type { Site, ConversationBrief } from "shared/types/index.ts";

export type Message = { role: "user" | "assistant"; content: string };

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Max characters per individual message before truncation */
const MAX_USER_MSG_CHARS = 400;
const MAX_ASSISTANT_MSG_CHARS = 250;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Truncate a single message to its character cap */
function truncateMessage(msg: Message): Message {
  const cap = msg.role === "user" ? MAX_USER_MSG_CHARS : MAX_ASSISTANT_MSG_CHARS;
  if (msg.content.length <= cap) return msg;
  return { ...msg, content: msg.content.slice(0, cap) + "... [truncated]" };
}

/** Format a message array as readable USER/ASSISTANT pairs */
function formatHistory(messages: Message[]): string {
  return messages
    .map((m) => `${m.role === "user" ? "USER" : "ASSISTANT"}: ${m.content}`)
    .join("\n\n");
}

// ---------------------------------------------------------------------------
// Lyra system prompt
// ---------------------------------------------------------------------------

export const LYRA_SYSTEM_PROMPT = `ABSOLUTE RULE — READ THIS FIRST:
You are NOT an AI assistant. You are NOT answering questions.
You are NOT helping the user with their task.
You are a PROMPT REWRITER. Your only output is a rewritten version of the prompt the user is about to send.
 
If the input is "ok i just got it" your output is a better version of "ok i just got it" as a prompt — not a response to it.
 
If you find yourself writing anything that sounds like an answer, a suggestion, a next step, or a helpful response — STOP. Delete it. Write the optimized prompt instead.
 
WRONG output: "Great! Now that you have the ingredients, here is how to cook..."
RIGHT output: "I just got all the ingredients for spaghetti aglio e olio. Walk me through the cooking process step by step, with timing for each stage and tips to avoid common mistakes."
 
You transform inputs. You do not respond to them.
 
You are a prompt optimization engine. You receive a raw prompt and return one optimized version of it. That is your only job.
 
RULES — these override everything else:
- Return the optimized prompt text and nothing else
- No questions. No clarifications. No "I need more info".
- No preamble. No explanation. No section headers.
- No "What Changed". No "Key Improvements". No "Pro Tip".
- Never ask what the user means. Assume reasonable intent and optimize.
- Always optimize. Even vague prompts get optimized.
- If the prompt is one sentence, make it a better one sentence.
- If the prompt is a question, make it a better question.
- The output must be ready to paste directly into an AI chat.
 
WHAT YOU ARE OPTIMIZING:
The text you receive is a prompt the user is about to send to an AI assistant. You are not the AI assistant. You are not answering the question. You are rewriting the question to be more effective when someone else answers it.
 
Example:
Input:  "can you help me with my resume"
Output: "Act as an expert technical recruiter. Review my resume for a software engineering role and provide specific feedback on: impact of bullet points, technical skills presentation, and ATS optimization. Here is my resume: [paste resume]"
 
The output is always a better version of the input prompt — never an answer to it.
 
HOW TO OPTIMIZE:
- Add role context if missing ("As an expert in X...")
- Add output format if missing ("Provide a step-by-step...")
- Add specificity if missing (replace vague words with precise ones)
- Add constraints if helpful ("in under 200 words", "with examples")
- Keep the user's core intent exactly — only make it clearer and more effective
 
WHEN HISTORY OR BRIEF IS PROVIDED:
- The user is continuing an existing conversation
- Optimize the prompt to flow naturally from what was already discussed
- Reference established context — do not re-explain it
- Make the prompt feel like a natural expert follow-up`;

// ---------------------------------------------------------------------------
// Brief extraction prompt
// ---------------------------------------------------------------------------

export const EXTRACT_BRIEF_PROMPT = `You are a conversation analyst. Read the conversation below and extract a structured brief as JSON.
 
Output exactly this JSON shape and nothing else:
{
  "goal": "one sentence describing what the user is trying to accomplish",
  "establishedContext": ["fact 1", "fact 2", "fact 3"],
  "userStyle": "one sentence describing how the user communicates",
  "activeTopic": "one sentence describing what is being discussed now",
  "avoid": ["thing already explained 1", "thing already explained 2"]
}
 
Rules:
- goal must be specific, not generic
- establishedContext: only confirmed decisions and facts. Max 5 items.
- userStyle: note technical level, preferred format, verbosity preference
- activeTopic: the most recent focus, not the overall goal
- avoid: things the AI has already explained in detail. Max 5 items.
- Output valid JSON only. No preamble. No explanation.
- If uncertain about any field, use an empty string or empty array.
  Do not guess. Do not invent facts not present in the conversation.`;

// ---------------------------------------------------------------------------
// Brief update prompt
// ---------------------------------------------------------------------------

export const UPDATE_BRIEF_PROMPT = `You are a conversation analyst maintaining a running brief.
You have the current brief and new messages from the conversation.
Update the brief to reflect what has changed.
 
Output exactly the same JSON shape as the current brief, updated to reflect the new messages. Rules:
- Only update fields that have genuinely changed
- Add new items to establishedContext if new decisions were made
- Update activeTopic to reflect the latest focus
- Add to avoid if the AI explained something new in detail
- Refine userStyle only if new evidence changes it
- Increment messageCount by the number of new messages
- Set lastUpdatedAt to current Unix timestamp in milliseconds
- Output valid JSON only. No preamble. No explanation.
- If nothing meaningful changed, return the current brief unchanged.`;

// ---------------------------------------------------------------------------
// buildSystemPrompt
// ---------------------------------------------------------------------------

/**
 * Assembles the full system prompt for Lyra based on conversation state.
 *
 * The history argument should already be trimmed by trimHistory() in
 * rewriteEngine.ts before being passed here.
 *
 * STATE 1 — no brief: raw (trimmed) history appended.
 * STATE 2 — brief + messageCount < 20: brief + recent exchanges from trimmed history.
 * STATE 3 — brief + messageCount >= 20: brief only, no raw history.
 *
 * @param history      - already-trimmed history (from trimHistory)
 * @param site         - target AI platform
 * @param brief        - conversation brief if available
 * @param messageCount - total messages in the conversation (for tiered logic)
 */
export function buildSystemPrompt(
  history: Message[],
  site: Site,
  brief?: ConversationBrief,
  messageCount?: number
): string {
  const SITE_LABELS: Record<string, string> = {
    chatgpt: "ChatGPT",
    claude: "Claude",
    gemini: "Gemini",
    vscode: "VS Code / IDE",
    perplexity: "Perplexity",
    grok: "Grok",
    copilot: "Microsoft Copilot",
    poe: "Poe",
    huggingchat: "HuggingChat",
  };
  const siteLabel = SITE_LABELS[site] ?? site;
  const count = messageCount ?? brief?.messageCount ?? history.length;

  // ── STATE 2 / 3: Brief active ──────────────────────────────────────────
  if (brief) {
    const contextList = brief.establishedContext.length > 0
      ? brief.establishedContext.map((c) => `- ${c}`).join("\n")
      : "- (none yet)";

    const avoidList = brief.avoid.length > 0
      ? brief.avoid.join(", ")
      : "(none)";

    const briefBlock =
      `\n\nREMINDER: You are rewriting the prompt below into a better prompt. ` +
      `You are not answering it. Use the brief for context only.\n\n` +
      `CONVERSATION BRIEF:\n` +
      `Goal: ${brief.goal}\n` +
      `Active topic: ${brief.activeTopic}\n` +
      `Established context:\n${contextList}\n` +
      `User style: ${brief.userStyle}\n` +
      `Do not re-explain: ${avoidList}`;

    // STATE 3: 20+ messages — brief only, no raw history
    if (count >= 20) {
      return (
        LYRA_SYSTEM_PROMPT +
        briefBlock +
        `\n\nThe conversation is long. Use only the brief above as context. ` +
        `Do not ask for more information. ` +
        `Tailor your optimization to ${siteLabel}.`
      );
    }

    // STATE 2: Brief + recent exchanges from trimmed history
    const recent = history.map(truncateMessage);
    const recentBlock = recent.length > 0
      ? `\n\nMost recent exchange:\n${formatHistory(recent)}`
      : "";

    return (
      LYRA_SYSTEM_PROMPT +
      briefBlock +
      recentBlock +
      `\n\nTailor your optimization to ${siteLabel}. ` +
      `Build directly on what is established. ` +
      `Do not repeat what is in the avoid list.`
    );
  }

  // ── STATE 1 / Fallback: No brief ──────────────────────────────────────

  const recent = history.map(truncateMessage);

  if (recent.length > 0) {
    return (
      LYRA_SYSTEM_PROMPT +
      `\n\nYou have recent conversation history below. ` +
      `The user is continuing this conversation. ` +
      `Optimize their next prompt with awareness of what was recently discussed. ` +
      `Do not re-explain things already covered. ` +
      `Tailor your optimization to ${siteLabel}.\n\n` +
      `Recent conversation:\n\n${formatHistory(recent)}`
    );
  }

  // Cold start — no history at all
  return (
    LYRA_SYSTEM_PROMPT +
    `\n\nREMINDER: Rewrite the prompt. Do not answer it.\n\n` +
    `There is no prior conversation history. Optimize this prompt cold. ` +
    `Tailor your optimization to ${siteLabel}.`
  );
}