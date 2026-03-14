/** Supported AI chat sites */
export type Site = "chatgpt" | "claude" | "gemini";

/** Conversation context type */
export type ConversationType = "new" | "continuing";

/** Prompt rewrite mode */
export type RewriteMode = "enhance" | "restructure" | "expand";

/** Intent category detected from prompt analysis */
export type PromptIntent =
  | "coding"
  | "writing"
  | "research"
  | "career"
  | "general";

/** Tone preset for rewrite output */
export type RewriteTone = "concise" | "detailed" | "professional";

/** Output format preset */
export type OutputFormat = "paragraph" | "bullets" | "step-by-step" | "json" | "code";

/** User-selected presets sent with rewrite request */
export interface RewritePreset {
  intent?: PromptIntent;
  tone?: RewriteTone;
  output_format?: OutputFormat;
  additional_context?: string;
}

/** Request body for POST /v1/rewrite */
export interface RewriteRequest {
  prompt: string;
  context: {
    site: Site;
    conversation_type?: ConversationType;
    language?: string;
  };
  options?: {
    mode?: RewriteMode;
    preserve_intent?: boolean;
    max_length?: number;
  };
  preset?: RewritePreset;
}

/** Quality score breakdown for a rewritten prompt */
export interface PromptScore {
  clarity: number;
  specificity: number;
  constraints: number;
  overall: number;
  confidence: number;
}

/** A single change made during rewrite */
export interface PromptChange {
  type: "added" | "modified" | "restructured";
  description: string;
}

/** Successful response from POST /v1/rewrite */
export interface RewriteResponse {
  enhanced_prompt: string;
  score: PromptScore;
  changes: PromptChange[];
  warnings: string[];
  clarifying_question?: string;
  metadata: {
    model_used: string;
    tokens_used: {
      input: number;
      output: number;
    };
    rewrite_mode: RewriteMode;
    processing_time_ms: number;
    detected_intent: PromptIntent;
    /** MCS context enrichment status (only present when MCS integration is configured) */
    mcs_context?: Record<string, unknown>;
  };
  request_id: string;
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
  | { type: "REWRITE_PROMPT"; payload: { prompt: string; site: Site; preset?: RewritePreset } }
  | { type: "REWRITE_RESULT"; payload: RewriteResponse }
  | { type: "REWRITE_ERROR"; payload: ErrorResponse };

export * from "./quality.js";
