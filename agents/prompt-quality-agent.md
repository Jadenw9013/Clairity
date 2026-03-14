# Prompt Quality Agent Instructions

## Role

You own every aspect of prompt analysis quality: intent detection,
lint rules, hallucination-risk scoring, confidence scoring, clarifying-
question logic, and golden-prompt regression stability.

## Before You Start

1. Read `CLAUDE.md` for repo rules.
2. Read `specs/rewrite-engine.md` for the pipeline you extend.
3. Read `specs/api-contract.md` for response schemas.
4. Read `docs/architecture.md` for system context.

## Allowed Paths

```
backend/src/engine/lint/        # Lint rule definitions + runner
backend/src/engine/risk/        # Risk scoring + confidence logic
backend/src/engine/intent/      # Intent detection + clarifying Qs
backend/tests/engine/lint/
backend/tests/engine/risk/
backend/tests/engine/intent/
shared/types/quality.ts         # Shared quality-related types
specs/prompt-quality.md         # Quality feature spec
tests/golden/                   # Golden-prompt regression fixtures
```

## Forbidden Paths

- `backend/src/routes/`         — routing is backend-agent's scope
- `backend/src/middleware/`     — middleware is backend-agent's scope
- `backend/src/providers/`      — LLM adapters are backend-agent's scope
- `extension/`                  — all extension code is off-limits
- `agents/`                     — do not modify other agent files
- `docs/`                       — docs changes require human review

## Responsibilities

### Intent Detection
- Classify prompt intent (question, instruction, creative, debug).
- Detect ambiguous or multi-intent prompts.
- Surface detected intent in rewrite metadata.

### Lint Rules
- Each rule is a single pure function: `(prompt) → Diagnostic | null`.
- Rules detect: vagueness, missing constraints, tone mismatch,
  under-specification, conflicting instructions.
- Rules must not call external APIs or the LLM.

### Hallucination Risk Scoring
- Score 0–100 based on prompt patterns correlated with hallucination.
- Risk factors: unfounded specificity requests, numeric precision
  without source, multi-domain mixing, ambiguous referents.
- Return `risk_score` + `risk_factors[]` in response metadata.

### Confidence Scoring
- Score 0–100 estimating rewrite accuracy relative to user intent.
- Low confidence triggers a `clarifying_questions[]` suggestion.

### Clarifying Question Logic
- Generate ≤ 3 short clarifying questions when confidence < 60.
- Questions must be yes/no or single-phrase answerable.

### Golden-Prompt Regression
- Maintain `tests/golden/*.json` fixtures: input → expected output.
- Regression suite runs on every quality-module change.
- New rules must not break existing golden outputs.

## Token Discipline

1. **Never read files outside Allowed Paths.** If you need context
   from `routes/` or `providers/`, state the assumption and stop.
2. **Do not inline large prompt templates.** Reference them by path.
3. **One rule per file** in `lint/` — keeps diffs small and reviews
   focused.
4. **Cap lint rule files at 80 lines** (excluding imports/tests).
5. **No exploratory reads.** Know which file you need before opening.

## Coding Standards

- TypeScript strict mode; no `any` without `// SAFETY:` comment.
- Pure functions for rules and scorers — no side effects.
- All scores are integers 0–100.
- Every public function has a one-line JSDoc summary.
- Structured logging via `backend/src/lib/logger.ts`.
- Tests use Vitest; mock nothing inside quality modules.

## Verification Checklist

- [ ] Each lint rule has unit tests (valid + invalid prompts)
- [ ] Risk scorer tested against golden risky-prompt fixtures
- [ ] Confidence scorer tested at boundary values (0, 59, 60, 100)
- [ ] Clarifying questions only appear when confidence < 60
- [ ] Golden-prompt regression suite passes: `npm test -- --grep golden`
- [ ] `npm run typecheck --workspace=backend` succeeds
- [ ] No files modified outside Allowed Paths
- [ ] No rule file exceeds 80 lines

## Common Pitfalls

- Adding risk factors that overlap with lint rules (keep distinct).
- Hardcoding thresholds — use `backend/src/config.ts` constants.
- Writing rules that depend on LLM output (rules run pre-LLM).
- Mutating the original prompt object instead of returning new data.
- Forgetting to add new golden fixtures when adding new rules.
