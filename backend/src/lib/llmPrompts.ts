// backend/src/lib/llmPrompts.ts
// All LLM prompts stored as named constants. Never inline prompt strings elsewhere.

import type { Site, ConversationBrief } from "shared/types/index.ts";

export type Message = { role: "user" | "assistant"; content: string };

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

WHEN HISTORY IS PROVIDED:
- The user is continuing an existing conversation
- Optimize the prompt to flow naturally from what was already discussed
- Reference established context — do not re-explain it
- Make the prompt feel like a natural expert follow-up`;

// ---------------------------------------------------------------------------
// Brief extraction prompt — returns JSON-only ConversationBrief shape
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
- goal must be specific, not generic ("Build a Chrome extension prompt enhancer" not "work on a project")
- establishedContext: only confirmed decisions and facts, not speculation. Max 5 items.
- userStyle: note technical level, preferred format, verbosity preference
- activeTopic: the most recent focus, not the overall goal
- avoid: things the AI has already explained in detail. Max 5 items.
- Output valid JSON only. No preamble. No explanation.
- If uncertain about any field, use an empty string or empty array. Do not guess. Do not invent facts not present in the conversation.`;

// ---------------------------------------------------------------------------
// Brief update prompt — merges new messages into existing brief
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
// buildSystemPrompt — assembles system prompt for Lyra at runtime
// ---------------------------------------------------------------------------

/**
 * Build the full system prompt by appending the dynamic history/site block.
 * When a brief is provided (STATE 2/3), uses structured brief + last 2 message pairs.
 * When no brief (STATE 1), falls back to raw history block.
 * Called at runtime before each LLM call.
 */
export function buildSystemPrompt(
  history: Message[],
  site: Site,
  brief?: ConversationBrief
): string {
  const siteLabel = site === "chatgpt" ? "ChatGPT" : site === "claude" ? "Claude" : "Gemini";

  // STATE 2/3: Brief active — use structured context + last 2 message pairs
  if (brief) {
    const contextList = brief.establishedContext.length > 0
      ? brief.establishedContext.map((c) => `- ${c}`).join("\n")
      : "- (none yet)";

    const avoidList = brief.avoid.length > 0
      ? brief.avoid.join(", ")
      : "(none)";

    // Last 2 message pairs (up to 4 messages) for immediate continuity
    const recentMessages = history.slice(-4);
    const recentBlock = recentMessages.length > 0
      ? "\n\nRecent exchanges:\n" +
        recentMessages
          .map((m) => `${m.role === "user" ? "USER" : "ASSISTANT"}: ${m.content}`)
          .join("\n\n")
      : "";

    return (
      LYRA_SYSTEM_PROMPT +
      `\n\nREMINDER: You are rewriting the prompt below into a better prompt. You are not answering it. Use the brief for context only — to make the rewritten prompt smarter, not to respond to the user's situation.\n\n` +
      `You have a structured brief of this conversation below. ` +
      `Use it to make the rewritten prompt contextually precise.\n\n` +
      `Goal: ${brief.goal}\n` +
      `Active topic: ${brief.activeTopic}\n` +
      `Established context:\n${contextList}\n` +
      `User style: ${brief.userStyle}\n` +
      `Do not re-explain: ${avoidList}` +
      recentBlock +
      `\n\nTailor your optimization to the target platform: ${siteLabel}. ` +
      `Build directly on what is established. Do not repeat what is in the avoid list.`
    );
  }

  // STATE 1: No brief yet — use raw history
  if (history.length > 0) {
    const formattedHistory = history
      .map((m) => `${m.role === "user" ? "USER" : "ASSISTANT"}: ${m.content}`)
      .join("\n\n");

    return (
      LYRA_SYSTEM_PROMPT +
      `\n\nYou have the conversation history below. The user is continuing ` +
      `this conversation. Their next prompt should be optimized with full ` +
      `awareness of what has already been discussed, decided, and answered. ` +
      `Do not re-explain things already covered. Do not ask what the ` +
      `conversation is about — you can see it. Build directly on the ` +
      `existing context. Tailor your optimization to the target platform: ${siteLabel}.` +
      `\n\nConversation so far:\n\n${formattedHistory}`
    );
  }

  return (
    LYRA_SYSTEM_PROMPT +
    `\n\nREMINDER: Rewrite the prompt. Do not answer it.` +
    `\n\nThere is no prior conversation history. Optimize this prompt cold. ` +
    `Tailor your optimization to the target platform: ${siteLabel}.`
  );
}
