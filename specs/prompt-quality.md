# Prompt Quality Engine Specification

## Purpose

Deterministic, pure-function analysis of user prompts before LLM
rewriting. Produces lint diagnostics, hallucination risk scores,
and intent classification. Runs server-side with zero external calls.

## Public API

```typescript
lint(prompt: string, options?: LintOptions): LintResult
risk(prompt: string, options?: RiskOptions): RiskAssessment
intent(prompt: string): IntentResult
```

All functions are synchronous, deterministic, and side-effect-free.

## Lint Rules

Each rule is one file under `backend/src/engine/lint/rules/`.
Signature: `(prompt: string) => Diagnostic | null`.

| ID | Severity | Detects |
|---|---|---|
| `vague-prompt` | warning | Under-specified prompt (< 15 words) |
| `no-output-format` | info | Missing output format instruction |
| `no-constraints` | warning | Missing boundaries or limits |
| `ambiguous-pronoun` | info | Unclear "it/this/that" referent |
| `missing-context` | warning | No domain or audience context |
| `multiple-questions` | info | Multiple distinct questions |
| `negative-only` | info | Only negative constraints |
| `wall-of-text` | warning | Long text without structure |
| `missing-language` | info | Coding prompt without language |
| `conflicting-instructions` | warning | Contradictory directives |

## Quality Score

`quality_score = 100 - Σ(penalty per diagnostic)`

Penalties: warning = 10, info = 5, error = 20. Floor at 0.

## Risk Scoring

Additive signals, integer 0–100 (capped).

| Signal | Points | Trigger |
|---|---|---|
| `numeric-precision` | +20 | Specific numbers without source |
| `sensitive-domain` | +25 | Medical/legal/financial keywords |
| `absolutism` | +10 | "always"/"never" demands |
| `multi-domain` | +15 | > 2 unrelated domains |
| `recency-dependent` | +20 | "latest"/"current" data requests |
| `ambiguous-referent` | +5 | Ambiguous pronoun lint fired |
| `unconstrained-output` | +10 | No-constraints lint fired |
| `exhaustive-request` | +10 | Requests complete/exhaustive list |

Levels: 0–29 low, 30–59 medium, 60–100 high.

## Intent Detection

Keyword-density classification into existing `PromptIntent` enum.
Confidence 0–100. When confidence < 60, engine returns up to 3
clarifying questions. Questions are yes/no or single-phrase.

## Golden Regression

Fixtures in `tests/golden/quality/*.json`. Each fixture:
```json
{ "prompt": "...", "expected": { "lint_ids": [], "risk_level": "...", "intent": "..." } }
```
Runner asserts stable output across changes.

## Consumer-Facing Language

All `message`, `suggestion`, `description`, and `guardrail` strings
must be plain English, ≤ 120 characters, no jargon. The UX agent
renders these directly to users.
