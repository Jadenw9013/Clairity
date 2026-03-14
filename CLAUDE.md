# CLAUDE.md — Clairity Repository Instructions

> **Agent Role & Authority:**
> Controls autonomous Claude Code agents: permissions, boundaries,
> workflows. Must be followed exactly to prevent drift/hallucination.

## Agent Rules
1. Follow the Autonomous Loop (below).
2. Treat terminal output as truth; run commands if uncertain.
3. Enforce listed conventions as hard rules.
4. Make only minimally scoped changes; avoid broad refactors.
5. Code must compile (`npm run typecheck`) and tests pass.
6. Never hallucinate shell or git commands; ask or execute.
7. Cross‑check `docs/` & `specs/` before adding new components.
8. Do not alter Mandatory Rules without human approval.

## Autonomous Loop
Repeat until task/PR closed:
1. Inspect context (task, files, docs).
2. Plan changes and tests; note targets.
3. Implement minimal edits + tests.
4. Verify with lint, typecheck, relevant tests.
5. Self‑critique: comment potential risks.
6. Commit with proper message; push.
7. Loop on feedback.

Log each iteration in progress comments.

## Definition of Done
- Passes typecheck and relevant tests.
- Lint/format clean.
- Docs/specs updated if behavior changed.
- Summary comment + self‑critique added.
- No `// ASSUMPTION:` or TODO remains.

## Non-Goals
- Broad rewrites, unrelated features, premature perf work,
  framework migrations, or excessive `.md` edits.

---

## Summary & Layout
Clairity is a Chrome MV3 extension rewriting prompts via a backend API.
Extension holds no LLM keys; backend mediates.

Structure:
```
extension/ backend/ shared/ docs/ specs/ agents/
```
Agents must add logic under existing dirs unless specs dictate.

Key paths:
- `backend/src/routes/v1/` (API)
- `backend/src/middleware/`
- `extension/src/adapters/`
- `extension/src/content/`
- `extension/src/popup/`
- `extension/src/background/`
- `shared/types/`
- `extension/public/manifest.json`

---

## Commands
```
npm install
npm run build --workspace=extension
npm run build --workspace=backend
npm run build
npm run dev
npm test
npm test --workspace=extension
npm test --workspace=backend
npm run test:e2e
npm run lint && npm run lint:fix && npm run format && npm run typecheck
```

Terminal output is authoritative.

## Mandatory Rules
1. No secrets in repo; use env vars, never commit `.env`.
2. TS strict mode; no un‑justified `any`.
3. 150‑line limit on `.md` files.
4. Minimal Chrome permissions; explicit `host_permissions`.
5. Use adapter pattern (`SiteAdapter`).
6. API under `/v1/`.
7. Structured logging; no bare `console.log` in prod.
8. Input validation on every endpoint.
9. Errors return `{error:string,code:string}`.
10. No over‑engineering; scope to current milestone.

CI enforces these.

## Git
- Branches: `feat/`,`fix/`,`docs/`,`chore/`.
- Imperative commits ≤72 chars.
- PRs link issue/spec, include test plan.
- Never force‑push `main`.

## Agent Workflow
1. Read `agents/*.md` & `specs/*.md`.
2. Consult `docs/` for constraints.
3. Follow Plan→Implement→Verify→Critique.
4. Mark assumptions with `// ASSUMPTION:`.
5. Run lint+typecheck before marking done.
