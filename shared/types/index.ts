// shared/types/index.ts
// Shared TypeScript types used by both extension and backend.

/** Supported AI chat sites */
export type Site = "chatgpt" | "claude" | "gemini";

/** A single message in the conversation history */
export interface Message {
  role: "user" | "assistant";
  content: string;
}

/** Request body for POST /v1/rewrite */
export interface RewriteRequest {
  prompt: string;
  history: Message[];
  site: Site;
}

/** Successful response from POST /v1/rewrite */
export interface RewriteResponse {
  enhanced_prompt: string;
  history_length: number;
  model: string;
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

/** Message types for chrome.runtime messaging */
export type ExtensionMessage =
  | { type: "REWRITE_PROMPT"; payload: { prompt: string; site: Site; history: Message[]; conversationId: string } }
  | { type: "REWRITE_RESULT"; payload: RewriteResponse }
  | { type: "REWRITE_ERROR"; payload: ErrorResponse };

