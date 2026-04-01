// extension/src/lib/conversationStore.ts
// Session-scoped conversation memory backed by chrome.storage.session.
// Clears automatically when the browser closes — intentional, no cross-session persistence.
// Cap: 20 message pairs per conversationId; oldest pair dropped when exceeded.

import type { ConversationBrief, Message } from "shared/types/index.ts";

const MAX_PAIRS = 20;
const STORAGE_KEY = "clairity_conversations";
const BRIEF_STORAGE_KEY = "clairity_briefs";

// Brief extraction threshold: create brief when message count reaches this
const BRIEF_THRESHOLD = 6;
// Brief update interval: update brief every N messages after initial creation
const BRIEF_UPDATE_INTERVAL = 4;

type ConversationMemory = Record<string, Message[]>;
type BriefMemory = Record<string, ConversationBrief>;

// ---------------------------------------------------------------------------
// History (existing)
// ---------------------------------------------------------------------------

async function getAllConversations(): Promise<ConversationMemory> {
  const result = await chrome.storage.session.get(STORAGE_KEY);
  return (result[STORAGE_KEY] as ConversationMemory) ?? {};
}

async function saveAllConversations(memory: ConversationMemory): Promise<void> {
  await chrome.storage.session.set({ [STORAGE_KEY]: memory });
}

/** Get history for a conversation. Returns [] if none exists. */
export async function getHistory(conversationId: string): Promise<Message[]> {
  const memory = await getAllConversations();
  return memory[conversationId] ?? [];
}

/** Append a user message and enforce the 20-pair cap. */
export async function appendUserMessage(
  conversationId: string,
  content: string
): Promise<void> {
  const memory = await getAllConversations();
  const history = memory[conversationId] ?? [];
  memory[conversationId] = [...history, { role: "user", content }];
  await saveAllConversations(memory);
}

/** Append an assistant message and enforce the 20-pair cap. */
export async function appendAssistantMessage(
  conversationId: string,
  content: string
): Promise<void> {
  const memory = await getAllConversations();
  let history = memory[conversationId] ?? [];
  history = [...history, { role: "assistant", content }];

  // Enforce cap: drop the oldest complete pair (2 messages) when over limit
  while (history.length > MAX_PAIRS * 2) {
    history = history.slice(2);
  }

  memory[conversationId] = history;
  await saveAllConversations(memory);
}

/** Get the total stored message count for a conversation. */
export async function getMessageCount(conversationId: string): Promise<number> {
  const history = await getHistory(conversationId);
  return history.length;
}

// ---------------------------------------------------------------------------
// Brief storage
// ---------------------------------------------------------------------------

async function getAllBriefs(): Promise<BriefMemory> {
  const result = await chrome.storage.session.get(BRIEF_STORAGE_KEY);
  return (result[BRIEF_STORAGE_KEY] as BriefMemory) ?? {};
}

async function saveAllBriefs(briefs: BriefMemory): Promise<void> {
  await chrome.storage.session.set({ [BRIEF_STORAGE_KEY]: briefs });
}

/** Get the stored brief for a conversation. Returns null if none exists. */
export async function getBrief(conversationId: string): Promise<ConversationBrief | null> {
  const briefs = await getAllBriefs();
  return briefs[conversationId] ?? null;
}

/** Store a brief for a conversation (atomic replace). */
export async function setBrief(conversationId: string, brief: ConversationBrief): Promise<void> {
  const briefs = await getAllBriefs();
  briefs[conversationId] = brief;
  await saveAllBriefs(briefs);
}

// ---------------------------------------------------------------------------
// State decision helpers
// ---------------------------------------------------------------------------

/**
 * Returns true when the conversation has enough history for a brief
 * but none has been created yet.
 * STATE 1 → STATE 2 transition trigger.
 */
export async function shouldExtractBrief(conversationId: string): Promise<boolean> {
  const count = await getMessageCount(conversationId);
  if (count < BRIEF_THRESHOLD) return false;
  const brief = await getBrief(conversationId);
  return brief === null;
}

/**
 * Returns true every BRIEF_UPDATE_INTERVAL messages after a brief is active.
 * STATE 2/3 update trigger.
 */
export async function shouldUpdateBrief(conversationId: string): Promise<boolean> {
  const brief = await getBrief(conversationId);
  if (!brief) return false;
  const count = await getMessageCount(conversationId);
  const messagesSinceBriefCreation = count - brief.messageCount;
  return messagesSinceBriefCreation > 0 && messagesSinceBriefCreation % BRIEF_UPDATE_INTERVAL === 0;
}
