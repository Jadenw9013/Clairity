# CONTEXT.md — Clairity

## 1. WHAT IT IS

Clairity is a Chrome MV3 extension that rewrites user prompts into optimized structured prompts for better LLM outputs. It targets developers and power users who work daily with ChatGPT, Claude, and Gemini.

## 2. HOW IT WORKS

```
Browser                    Backend (localhost:3001)         MCS Daemon (localhost:4040)
──────                     ───────────────────────         ───────────────────────────
1. User types prompt in ChatGPT / Claude / Gemini
2. Clicks "Enhance" button injected by content script
3. Content script → site adapter extracts textarea text
4. Service worker receives REWRITE_PROMPT message
5. Service worker → POST /v1/rewrite (Bearer session token)
                    6. Rate limit check (per-IP / per-token)
                    7. Zod schema validation
                    8. Auth middleware verifies session JWT
                    9. [If MCS_ENABLED] fetchMcsContext → GET /pack?target=&task=
                                                          10. MCS returns context nodes
                    11. rewriteEngine: intent detection → lint rules → risk scoring
                    12. [If IMPROVED_MVP_ENABLED + REWRITE_LLM_ENABLED] LLM call
                    13. Returns RewriteResponse JSON
14. Service worker relays response to content script
15. Site adapter sets enhanced prompt text in textarea
```

## 3. PROJECT STRUCTURE

```
Clairity/
├── CLAUDE.md                   Agent rules, mandatory constraints, commands
├── CONTEXT.md                  This file — single source of truth
├── INTEGRATION.md              MCS ↔ Clairity integration contract
├── README.md                   Quick start and overview
├── .env.example                All backend env vars with defaults
├── package.json                Workspace root (npm workspaces)
├── tsconfig.base.json          Shared TS compiler settings
│
├── backend/
│   └── src/
│       ├── server.ts           Express app setup, CORS, middleware wiring, port binding
│       ├── routes/v1/
│       │   ├── health.ts       GET /v1/health — public liveness check
│       │   ├── session.ts      POST /v1/session — issues anonymous session JWT
│       │   ├── rewrite.ts      POST /v1/rewrite — deterministic pipeline + MCS enrichment
│       │   └── improve.ts      POST /v1/improve — improved pipeline + optional LLM call (feature-flagged)
│       ├── middleware/
│       │   ├── auth.ts         requireAuth — verifies Bearer JWT on protected routes
│       │   ├── rateLimit.ts    apiLimiter + sessionLimiter (per-IP sliding window)
│       │   ├── validate.ts     Zod request body validation middleware
│       │   └── errorHandler.ts Global Express error handler; returns {error, code}
│       ├── engine/
│       │   ├── index.ts        Public engine API: intent(), lint(), risk()
│       │   ├── intent/
│       │   │   ├── detector.ts Intent classification (coding/writing/research/career/general)
│       │   │   └── questions.ts Clarifying question generator for low-confidence intents
│       │   ├── lint/
│       │   │   ├── runner.ts   Runs all lint rules against a prompt; returns warnings
│       │   │   └── rules/      Individual lint rule implementations
│       │   └── risk/
│       │       ├── scorer.ts   Aggregates risk signals into a numeric score
│       │       └── signals.ts  Individual risk signal detectors
│       └── lib/
│           ├── rewriteEngine.ts  runRewritePipeline / runImprovedPipeline — orchestrates engine
│           ├── llmRewrite.ts   Optional LLM rewrite call (gated by REWRITE_LLM_ENABLED)
│           ├── mcsClient.ts    fetchMcsContext — calls MCS daemon, normalizes ContextPack
│           ├── featureFlags.ts All feature flag reads from env; logged at startup
│           ├── token.ts        JWT create/verify using SESSION_SECRET
│           └── logger.ts       Pino logger instance (structured JSON)
│
├── extension/
│   └── src/
│       ├── config.ts           Extension-side config (backend URL, timeouts)
│       ├── adapters/
│       │   ├── registry.ts     AdapterRegistry — detect() finds matching adapter by URL
│       │   ├── chatgpt.ts      ChatGPT adapter (chat.openai.com)
│       │   └── claude.ts       Claude adapter (claude.ai)
│       ├── background/
│       │   └── service-worker.ts  Auth init, message router, API calls, token refresh
│       ├── content/
│       │   ├── index.ts        Content script entry — initializes adapter registry, injects button
│       │   └── enhance-button.ts  Shadow DOM button component and click handler
│       ├── popup/
│       │   ├── popup.ts        Popup UI logic — settings, rewrite trigger, status
│       │   ├── popup-logic.ts  Extracted popup state helpers
│       │   └── index.html      Popup HTML shell
│       └── options/
│           ├── options.ts      Options page logic
│           └── index.html      Options page HTML
│
├── shared/types/
│   ├── index.ts                All shared TS types: RewriteRequest, RewriteResponse,
│   │                           SiteAdapter, SessionResponse, HealthResponse, ExtensionMessage
│   └── quality.ts              Quality score and lint result types
│
├── docs/
│   ├── architecture.md         System design, data flow, tech stack
│   ├── security.md             Threat model, extension permissions, backend security
│   └── workflow.md             Branch strategy, PR conventions, testing strategy
│
├── specs/
│   ├── api-contract.md         Endpoint schemas and error codes
│   ├── adapter-system.md       SiteAdapter interface and DOM selector strategy
│   ├── rewrite-engine.md       Rewrite pipeline steps and mode definitions
│   └── auth-system.md          Token design, device fingerprint, refresh flow
│
├── agents/
│   ├── backend-agent.md        Instructions for backend AI agent
│   ├── extension-agent.md      Instructions for extension AI agent
│   ├── security-agent.md       Instructions for security AI agent
│   ├── testing-agent.md        Instructions for testing AI agent
│   ├── release-agent.md        Instructions for release AI agent
│   ├── prompt-quality-agent.md Instructions for quality engine agent
│   └── ux-accessibility-agent.md  Instructions for UX/a11y agent
│
├── scripts/
│   └── smoke-dev.mjs           Dev smoke test script
│
└── tests/
    ├── golden/quality/         Golden file fixtures for quality engine tests
    ├── health.test.ts          Health endpoint tests
    ├── session.test.ts         Session endpoint tests
    ├── rewriteEngine.test.ts   Rewrite engine unit tests
    ├── mcsClient.test.ts       MCS client unit tests
    ├── mcsIntegration.test.ts  MCS integration tests
    └── engine/
        ├── intent/detector.test.ts
        ├── lint/rules.test.ts
        ├── risk/scorer.test.ts
        └── runner.test.ts
```

## 4. ARCHITECTURE

### Extension (Chrome MV3)
TypeScript, built with Vite. Manifest permissions: `storage`, `activeTab`. Host permissions: `chat.openai.com`, `claude.ai`, `gemini.google.com`. Content scripts run on matching URLs, register site adapters, inject the Enhance button via Shadow DOM. The service worker is the sole network gateway — content scripts never make direct HTTP calls. Auth tokens stored in `chrome.storage.local`.

Key files: `service-worker.ts` (auth + API), `adapters/registry.ts` + `chatgpt.ts` + `claude.ts` (DOM), `content/index.ts` + `enhance-button.ts` (injection).

Communication: content scripts → `chrome.runtime.sendMessage` with typed `ExtensionMessage` → service worker → `POST /v1/rewrite` with `Authorization: Bearer <token>`.

### Backend (Express, port 3001)
TypeScript, Node.js ≥ 20. Middleware stack in order: CORS → JSON body limit (10 KB) → pino-http → route handlers → error handler. Public routes: `/v1/health`, `/v1/session`. Protected routes (requireAuth + apiLimiter): `/v1/rewrite`, `/v1/improve`.

### Shared (`shared/types/`)
Used by both extension and backend via npm workspace. Exports all shared TypeScript types: request/response shapes, `SiteAdapter` interface, `ExtensionMessage` union, quality types.

### Adapter Pattern
`AdapterRegistry.detect()` iterates registered adapters calling `adapter.detect()`. First match wins. Adapters use a selector fallback chain (`data-testid` → ARIA → semantic HTML → class names). On SPA sites, a `MutationObserver` retries until the textarea appears (timeout: 30 s). Adapters never throw; they return `null` on any failure — the button simply doesn't appear.

### Auth
`POST /v1/session` issues an anonymous HMAC-SHA256 JWT (signed with `SESSION_SECRET`) containing `session_id` as subject. Token lifetime is set in `token.ts`. The service worker stores the token, attaches it as `Authorization: Bearer`, and handles expiry/refresh transparently. Rate limiting scopes per device fingerprint extracted from JWT `sub`.

## 5. REWRITE PIPELINE

`POST /v1/rewrite` → `runRewritePipeline()` in `lib/rewriteEngine.ts`:

1. **Sanitize** — Zod validates prompt (1–10 000 chars), strips invalid input
2. **MCS enrichment** (optional) — if `MCS_ENABLED=true` and `contextMode ≠ off`, calls `fetchMcsContext()` → GET `localhost:4040/pack`; appends returned context nodes to `preset.additional_context`; any failure falls back silently
3. **Intent detection** — `engine/intent/detector.ts` classifies prompt as `coding | writing | research | career | general` with confidence score
4. **Mode selection** — uses `options.mode` or auto-selects: short (<100 chars) → `expand`, unstructured → `enhance`, long/multi-topic → `restructure`
5. **Lint rules** — `engine/lint/runner.ts` applies rule set; returns warnings list
6. **Risk scoring** — `engine/risk/scorer.ts` aggregates signals into numeric risk score
7. **Rewrite** — deterministic template-based rewrite using intent + mode + preset
8. **LLM call** (optional) — only on `/v1/improve` when `IMPROVED_MVP_ENABLED=true` and `REWRITE_LLM_ENABLED=true`; `llmRewrite.ts` calls OpenAI or Anthropic; falls back to deterministic if disabled or fails
9. **Response** — returns `RewriteResponse` with `enhanced_prompt`, `score`, `changes`, `warnings`, `clarifying_question`, `metadata`

## 6. API REFERENCE

All routes under `/v1/`. Protected routes require `Authorization: Bearer <token>`.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/v1/health` | No | Liveness check |
| `POST` | `/v1/session` | No | Issue session JWT |
| `POST` | `/v1/rewrite` | Yes | Deterministic prompt rewrite |
| `POST` | `/v1/improve` | Yes | Improved rewrite + optional LLM (feature-flagged) |

**GET /v1/health** → `{ status: "ok", version: string, timestamp: string }`

**POST /v1/session** → `{ token: string, session_id: string, expires_at: string }`

**POST /v1/rewrite / /v1/improve** request:
```json
{
  "prompt": "string (1–10000)",
  "context": { "site": "chatgpt|claude|gemini", "conversation_type": "new|continuing", "language": "en" },
  "options": { "mode": "enhance|restructure|expand", "preserve_intent": true, "max_length": null },
  "preset": { "intent": "coding|writing|research|career|general", "tone": "concise|detailed|professional", "output_format": "paragraph|bullets|step-by-step|json|code", "additional_context": "string" },
  "mcs": { "contextMode": "off|auto|pinned", "workspaceId": "string", "projectId": "string", "conversationId": "string" }
}
```

Response: `{ enhanced_prompt, score: { clarity, specificity, constraints, overall, confidence }, changes[], warnings[], clarifying_question?, metadata: { model_used, tokens_used, rewrite_mode, processing_time_ms, detected_intent, mcs_context } }`

**Error format (all endpoints):** `{ error: string, code: string, request_id?: string }`
Codes: `VALIDATION_ERROR` 400, `UNAUTHORIZED` 401, `RATE_LIMITED` 429, `INTERNAL_ERROR` 500, `PROVIDER_ERROR` 502, `FEATURE_DISABLED` 404.

## 7. ENVIRONMENT VARIABLES

| Variable | Default | Required | Purpose |
|----------|---------|----------|---------|
| `SESSION_SECRET` | — | **Yes (prod)** | HMAC secret for JWT signing (≥16 chars) |
| `PORT` | `3001` | No | Backend listen port |
| `LOG_LEVEL` | `info` | No | Pino log level |
| `NODE_ENV` | `development` | No | `development` or `production` |
| `CORS_ORIGIN` | `http://localhost:3001` | **Yes (prod)** | Comma-separated allowed web origins; `*` rejected in prod |
| `EXTENSION_ORIGINS` | — | **Yes (prod)** | Comma-separated `chrome-extension://` origins |
| `IMPROVED_MVP_ENABLED` | `false` | No | Enables `POST /v1/improve` endpoint |
| `REWRITE_LLM_ENABLED` | `false` | No | Enables LLM call in `/v1/improve` |
| `LLM_API_KEY` | — | No | API key for OpenAI/Anthropic (backend only) |
| `MCS_ENABLED` | `false` | No | Kill switch for MCS daemon calls |
| `MCS_BASE_URL` | `http://localhost:4040` | No | MCS daemon base URL |
| `MCS_CONTEXT_MODE` | `off` | No | `off` / `auto` / `pinned` |
| `MCS_TIMEOUT_MS` | `2000` | No | MCS HTTP timeout in ms |
| `MCS_MAX_ITEMS` | `10` | No | Max context nodes from MCS pack |
| `MCS_MAX_CONTEXT_TOKENS` | `4000` | No | Max chars of MCS context injected |
| `MCS_PINNED_CATEGORIES` | — | No | Comma-separated categories (pinned mode) |

## 8. PORTS REFERENCE

| Service | Port | Purpose |
|---------|------|---------|
| Clairity Backend | 3001 | Express API, session-based auth |
| MCS Daemon (`ctx-daemon`) | 4040 | Context packing (`GET /pack`) |
| MCS Cloud (`ctx-cloud`) | 4041 | Do NOT use for context |

## 9. LOCAL SETUP

```powershell
# Prerequisites: Node.js >= 20, npm >= 10, Chrome

# 1. Clone and install
git clone <repo-url>; cd Clairity
npm install

# 2. Configure backend
Copy-Item backend\.env.example backend\.env
# Edit backend\.env — set SESSION_SECRET, optionally LLM_API_KEY

# 3. Run backend (dev mode)
npm run dev --workspace=backend
# → http://localhost:3001

# 4. Build extension
npm run build --workspace=extension
# Load extension/dist/ as unpacked extension in chrome://extensions

# 5. Run all tests
npm test

# 6. Run typecheck + lint
npm run typecheck
npm run lint

# 7. (Optional) Enable MCS integration — start MCS daemon first
# cd C:\Dev\ContextCore\master-context; npm run dev:daemon
# Then in backend/.env: MCS_ENABLED=true, MCS_CONTEXT_MODE=auto
```

## 10. TEST COVERAGE

9 backend test files using **Vitest**:

| File | Scope |
|------|-------|
| `tests/health.test.ts` | GET /v1/health |
| `tests/session.test.ts` | POST /v1/session |
| `tests/rewriteEngine.test.ts` | Full rewrite pipeline |
| `tests/mcsClient.test.ts` | MCS client (unit, mocked HTTP) |
| `tests/mcsIntegration.test.ts` | MCS integration flow |
| `tests/engine/intent/detector.test.ts` | Intent classification |
| `tests/engine/lint/rules.test.ts` | Individual lint rules |
| `tests/engine/risk/scorer.test.ts` | Risk scoring |
| `tests/engine/runner.test.ts` | Engine orchestration |

Golden fixtures in `tests/golden/quality/`. Known gaps: no Playwright e2e tests wired (framework referenced in docs but no test files present), no extension adapter unit tests found.

```powershell
npm test                          # All unit + integration
npm run test:e2e                  # E2E (Playwright — not yet implemented)
npm run test:coverage             # Coverage report
npm test --workspace=backend      # Backend only
npm test --workspace=extension    # Extension only
```

## 11. SECURITY MODEL

- **No API keys in extension** — `LLM_API_KEY` lives only in backend env vars; never shipped to extension or logged.
- **Session-based auth** — extension calls `POST /v1/session` to get a short-lived JWT signed with `SESSION_SECRET`; token stored in `chrome.storage.local`.
- **CORS** — dev: any `chrome-extension://` origin allowed; prod: only origins listed in `EXTENSION_ORIGINS` and `CORS_ORIGIN`.
- **Input validation** — every endpoint uses Zod schemas; payloads capped at 10 KB; unexpected fields stripped.
- **Rate limiting** — `apiLimiter` (per-IP sliding window) on protected routes; `sessionLimiter` on `/v1/session`.
- **No prompt content logged** — metadata only (endpoint, status, latency).
- **DOM safety** — adapters use `textContent` not `innerHTML`; Enhance button isolated in Shadow DOM.
- **Minimal permissions** — `storage` + `activeTab` only; explicit host permissions for three sites; no `<all_urls>`.
- **Secret rotation** — `SESSION_SECRET` and `LLM_API_KEY` rotated every 90 days.

## 12. CONSTRAINTS

Rules from `CLAUDE.md` and `README.md` that must never be broken:

1. No secrets in repo — never commit `.env`; use env vars only.
2. TypeScript strict mode everywhere — no unjustified `any`, no `@ts-ignore` without `// SAFETY:`.
3. `.md` files ≤ 150 lines (this file is the sole documented exception).
4. Minimal Chrome permissions — no `<all_urls>`; each new host permission requires PR justification.
5. Use adapter pattern (`SiteAdapter`) for all site DOM interaction — no direct DOM access outside adapters.
6. All API routes under `/v1/`.
7. Structured logging (pino) — no bare `console.log` in production paths.
8. Input validation (Zod) on every endpoint.
9. Errors return `{ error: string, code: string }`.
10. No over-engineering — scope changes to current milestone; no broad refactors.
11. Code must pass `npm run typecheck` and relevant tests before marking done.
12. Never force-push `main`.
