# Development Workflow

## Branch Strategy

```
main              ← production-ready, protected
  └── dev         ← integration branch
       ├── feat/  ← new features
       ├── fix/   ← bug fixes
       ├── docs/  ← documentation only
       └── chore/ ← tooling, deps, config
```

**Rules:**
- All work branches off `dev`.
- PRs target `dev`; `dev` merges to `main` for releases.
- Never force-push to `main` or `dev`.
- Squash merge for feature branches; merge commit for releases.

## Commit Conventions

Format: `type(scope): description`

```
feat(extension): add ChatGPT adapter
fix(backend): handle empty prompt in /v1/rewrite
docs(specs): update API contract for error codes
chore(deps): bump express to 4.19
test(backend): add rate limiter unit tests
```

- Subject line: imperative mood, max 72 characters.
- Body: explain *why*, not *what* (the diff shows what).
- Reference issue/spec when applicable.

## PR Workflow

1. Create branch from `dev`.
2. Implement with tests.
3. Run `npm run lint && npm run typecheck && npm test`.
4. Open PR with template:
   - **What:** one-line summary
   - **Why:** link to spec or issue
   - **How:** brief implementation notes
   - **Test plan:** how to verify
   - **Security:** any permission or API changes
5. Reviewer approves; CI passes; squash merge.

## Development Setup

```bash
# Clone and install
git clone <repo-url> && cd Clairity
npm install

# Start backend in dev mode
cp backend/.env.example backend/.env
npm run dev --workspace=backend

# Build extension and load in Chrome
npm run build --workspace=extension
# Load extension/dist/ as unpacked in chrome://extensions
```

## Agent Workflow

When an AI agent works on this repo:

1. **Read context:** `CLAUDE.md` → relevant `agents/*.md` → `specs/*.md`.
2. **Plan:** Outline changes before writing code.
3. **Implement:** Follow existing patterns; minimal changes.
4. **Verify:** Run lint, typecheck, tests.
5. **Self-critique:** Check for security issues, over-engineering.
6. **Report:** Summarize files changed, commands to verify.

## Code Review Standards

- TypeScript strict: no implicit `any`, no `@ts-ignore` without `// SAFETY:`.
- Every public function has a JSDoc summary (one line minimum).
- Tests for new logic; update tests for changed behavior.
- No `console.log` in production paths; use structured logger.
- DOM manipulation only through adapter interface.

## Testing Strategy

| Layer | Tool | Scope |
|-------|------|-------|
| Unit (backend) | Vitest | Route handlers, engine, validators |
| Unit (extension) | Vitest + jsdom | Adapters, utilities, state |
| Integration | Vitest | Backend API with mock LLM |
| E2E | Playwright | Full extension-to-backend flow |

```bash
npm test                        # All unit + integration
npm run test:e2e                # End-to-end with browser
npm run test:coverage           # Coverage report
```

## Environment Management

- `backend/.env.example` — template with all vars, no values.
- `backend/.env` — local config (gitignored).
- CI uses GitHub Actions secrets for env vars.

## Release Process

See `agents/release-agent.md` for automated release instructions.

1. Merge `dev` → `main`.
2. Tag with semver: `v1.0.0`.
3. CI builds extension zip and backend Docker image.
4. Extension submitted to Chrome Web Store.
5. Backend deployed to hosting provider.

## Monitoring

- Backend: structured logs → log aggregator.
- Error tracking: Sentry or equivalent.
- Uptime: health check at `GET /v1/health`.
- Alerts: error rate > 5%, latency p99 > 2s, rate limit spike.
