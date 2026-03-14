/** Severity level for a prompt diagnostic */
export type DiagnosticSeverity = "info" | "warning" | "error";

/** A single diagnostic produced by a lint rule */
export interface Diagnostic {
  /** Unique rule identifier, e.g. "vague-prompt" */
  id: string;
  /** Severity level */
  severity: DiagnosticSeverity;
  /** Plain-English message describing the issue */
  message: string;
  /** Optional actionable suggestion to fix the issue */
  suggestion?: string;
  /** Optional character range in the original prompt */
  range?: { start: number; end: number };
}

/** Options for the lint runner */
export interface LintOptions {
  /** Rule IDs to skip */
  disabledRules?: string[];
}

/** Result of running lint analysis on a prompt */
export interface LintResult {
  diagnostics: Diagnostic[];
  /** Overall quality score 0–100 (100 = no issues) */
  quality_score: number;
}

/** Risk level classification */
export type RiskLevel = "low" | "medium" | "high";

/** A single risk factor contributing to the overall score */
export interface RiskFactor {
  /** Signal identifier, e.g. "numeric-precision" */
  signal: string;
  /** Points contributed to the risk score */
  points: number;
  /** Plain-English explanation */
  description: string;
  /** Suggested guardrail to mitigate this risk */
  guardrail: string;
}

/** Result of risk analysis on a prompt */
export interface RiskAssessment {
  /** Risk score 0–100 */
  risk_score: number;
  /** Classified risk level */
  risk_level: RiskLevel;
  /** Individual risk factors that fired */
  risk_factors: RiskFactor[];
  /** Aggregated guardrail recommendations */
  recommended_guardrails: string[];
}

/** Options for risk analysis */
export interface RiskOptions {
  /** Diagnostics from lint (used for cross-signal scoring) */
  diagnostics?: Diagnostic[];
}

/** Detected prompt intent with confidence */
export interface IntentResult {
  /** Detected intent category */
  intent: import("./index.js").PromptIntent;
  /** Confidence score 0–100 */
  confidence: number;
  /** Clarifying questions (only when confidence < 60, max 3) */
  clarifying_questions: string[];
}

/** Combined quality analysis result */
export interface QualityResult {
  lint: LintResult;
  risk: RiskAssessment;
  intent: IntentResult;
}
