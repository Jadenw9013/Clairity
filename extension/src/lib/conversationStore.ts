// extension/src/lib/conversationStore.ts
// Session-scoped conversation memory backed by chrome.storage.session.
// Clears automatically when the browser closes — intentional, no cross-session persistence.
// Cap: 20 message pairs per conversationId; oldest pair dropped when exceeded.

export interface Message {
  role: "user" | "assistant";
  content: string;
}

const MAX_PAIRS = 20;
const STORAGE_KEY = "clairity_conversations";

type ConversationMemory = Record<string, Message[]>;

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
