// shared/types/index.ts
// Shared TypeScript types used by both extension and backend.

/** Supported AI chat sites */
export type Site = "chatgpt" | "claude" | "gemini";

/** A single message in the conversation history */
export interface Message {
  role: "user" | "assistant";
  content: string;
}

/**
 * Living structured brief of a conversation.
 * Created after 6 messages, updated every 4 messages thereafter.
 * Replaces raw history truncation as the primary context payload.
 */
export interface ConversationBrief {
  /** User's inferred overarching goal */
  goal: string;
  /** Confirmed decisions, facts, and constraints */
  establishedContext: string[];
  /** How the user communicates (technical level, format preference, verbosity) */
  userStyle: string;
  /** What is being discussed right now */
  activeTopic: string;
  /** Things already covered in detail — Lyra must not repeat these */
  avoid: string[];
  /** Total messages seen so far */
  messageCount: number;
  /** Timestamp of last brief update */
  lastUpdatedAt: number;
}

/** Request body for POST /v1/rewrite */
export interface RewriteRequest {
  prompt: string;
  history: Message[];
  site: Site;
  brief?: ConversationBrief;
}

/** Successful response from POST /v1/rewrite */
export interface RewriteResponse {
  enhanced_prompt: string;
  history_length: number;
  model: string;
  brief_active?: boolean;
}

/** Standard error response from all endpoints */
export interface ErrorResponse {
  error: string;
  code: string;
  request_id?: string;
}

/** Site adapter interface for DOM interaction */
export interface SiteAdapter {
  /** Unique identifier for this adapter */
  readonly id: string;

  /** Display name (e.g., "ChatGPT") */
  readonly name: string;

  /** URL pattern this adapter handles */
  readonly urlPattern: RegExp;

  /** Check if this adapter should activate on current page */
  detect(): boolean;

  /** Find the prompt input element (textarea or contentEditable div) */
  getPromptElement(): HTMLElement | null;

  /** Extract current prompt text */
  getPromptText(): string;

  /** Insert text into the prompt input */
  setPromptText(text: string): void;

  /** Find the insertion point for the Enhance button */
  getButtonAnchor(): HTMLElement | null;

  /** Read existing conversation messages from the page DOM. Returns [] if none found. */
  getConversationHistory(): Message[];

  /** Clean up when adapter is deactivated */
  destroy(): void;
}

/** Response from POST /v1/session */
export interface SessionResponse {
  token: string;
  session_id: string;
  expires_at: string;
}

/** Health check response from GET /v1/health */
export interface HealthResponse {
  status: "ok";
  version: string;
  timestamp: string;
}

/** Response from POST /v1/brief/extract and /v1/brief/update */
export interface BriefResponse {
  brief: ConversationBrief | null;
}

/** Message types for chrome.runtime messaging */
export type ExtensionMessage =
  | { type: "REWRITE_PROMPT"; payload: { prompt: string; site: Site; history: Message[]; conversationId: string; brief?: ConversationBrief } }
  | { type: "REWRITE_RESULT"; payload: RewriteResponse & { briefActive: boolean; brief?: ConversationBrief } }
  | { type: "REWRITE_ERROR"; payload: ErrorResponse };
