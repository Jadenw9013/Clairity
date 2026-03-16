# CONTEXT.md — Clairity v0.3.0

## What It Is

Clairity is a Chrome MV3 extension that enhances prompts on AI chat sites
(ChatGPT, Claude, Gemini) using the **Lyra** prompt optimization framework
and **adaptive conversation intelligence** (living ConversationBrief).
The extension holds no LLM keys. All inference runs on the Express backend.

---

## How It Works — End-to-End Flow

1. User types a prompt into ChatGPT, Claude, or Gemini
2. User clicks the **Enhance Request** button (injected by content script)
3. Content script reads conversation history from the DOM via site adapter
4. Service worker merges DOM history with `conversationStore` (fallback)
5. If a `ConversationBrief` exists for this conversation, it is retrieved
6. `POST /v1/rewrite` is called with `{ prompt, history, site, brief? }`
7. `rewriteEngine` calls `llmClient` with Lyra system prompt + context
8. Claude Haiku returns an optimized prompt only — no answers, no headers
9. Enhanced prompt is injected into the chat input
10. A transparency chip is shown (clickable if brief is active)
11. Fire-and-forget: extract or update brief if thresholds are met

---

## Three Conversation States

| State | Trigger | Context sent | Chip |
|-------|---------|--------------|------|
| **STATE 1** | `messageCount < 6` | Full raw history | `✦ N messages used` |
| **STATE 2** | `messageCount >= 6`, brief created | Brief + last 2 msg pairs | `✦ conversation brief active` (clickable) |
| **STATE 3** | Every 4 messages after STATE 2 | Same as STATE 2; brief updated async | Same chip |

---

## ConversationBrief Structure

```ts
interface ConversationBrief {
  goal: string              // user's overarching goal
  establishedContext: string[]  // confirmed decisions and facts (max 5)
  userStyle: string         // communication style, verbosity, tech level
  activeTopic: string       // what is being discussed right now
  avoid: string[]           // things already explained in detail (max 5)
  messageCount: number      // total messages seen when brief was written
  lastUpdatedAt: number     // Unix ms timestamp of last update
}
```

---

## Project Structure

```
Clairity/
├── package.json                  # Root workspace (npm workspaces)
├── tsconfig.base.json            # Shared TS config (strict, ESNext)
├── CLAUDE.md                     # Agent rules and mandatory constraints
├── CONTEXT.md                    # This file
├── shared/
│   └── types/index.ts            # Message, ConversationBrief, Site, SiteAdapter, RewriteRequest/Response, SessionResponse, HealthResponse, BriefResponse, ExtensionMessage
├── backend/
│   ├── src/
│   │   ├── server.ts             # Express app, CORS, rate limiter wiring
│   │   ├── lib/
│   │   │   ├── llmClient.ts      # Anthropic SDK wrapper; never throws; maxTokens? param
│   │   │   ├── llmPrompts.ts     # LYRA_SYSTEM_PROMPT, EXTRACT_BRIEF_PROMPT, UPDATE_BRIEF_PROMPT, buildSystemPrompt()
│   │   │   ├── briefEngine.ts    # extractBrief(), updateBrief(); failure-safe
│   │   │   ├── rewriteEngine.ts  # callLyra(); passes brief to buildSystemPrompt
│   │   │   ├── token.ts          # JWT session token sign/verify
│   │   │   ├── featureFlags.ts   # Env-driven feature flag logging
│   │   │   └── logger.ts         # Pino logger instance
│   │   ├── middleware/
│   │   │   ├── auth.ts           # requireAuth (Bearer JWT)
│   │   │   ├── validate.ts       # Zod schema middleware
│   │   │   ├── rateLimit.ts      # express-rate-limit: apiLimiter, sessionLimiter
│   │   │   └── errorHandler.ts   # Global error handler
│   │   └── routes/v1/
│   │       ├── health.ts         # GET /v1/health
│   │       ├── session.ts        # POST /v1/session
│   │       ├── rewrite.ts        # POST /v1/rewrite (auth required)
│   │       └── brief.ts          # POST /v1/brief/extract, /v1/brief/update (auth required)
│   ├── tests/
│   │   ├── briefEngine.test.ts   # 12 tests: extractBrief, updateBrief, buildSystemPrompt
│   │   ├── conversationStore.test.ts # 16 tests: history, brief storage, shouldExtract/Update
│   │   ├── health.test.ts        # 7 tests: health endpoint
│   │   ├── rewriteEngine.test.ts # 7 tests: callLyra, fallback, brief passthrough
│   │   └── session.test.ts       # 5 tests: session create, token validation
│   └── vitest.config.ts          # shared alias for direct module tests
├── extension/
│   ├── public/manifest.json      # MV3 manifest
│   └── src/
│       ├── config.ts             # API_BASE URL
│       ├── adapters/
│       │   ├── chatgpt.ts        # ChatGPT SiteAdapter (DOM selectors, getConversationHistory)
│       │   ├── claude.ts         # Claude SiteAdapter
│       │   ├── gemini.ts         # Gemini SiteAdapter
│       │   └── registry.ts       # Adapter detection and registration
│       ├── background/
│       │   └── service-worker.ts # Token cache, handleRewrite, brief orchestration
│       ├── content/
│       │   ├── index.ts          # Content script entry; adapter detection loop
│       │   ├── enhance-button.ts # Button injection, showPreviewCard, brief panel UI
│       │   └── panel.css         # Card, chip, brief panel styles
│       ├── lib/
│       │   └── conversationStore.ts # chrome.storage.session; history + brief; shouldExtract/Update
│       ├── popup/                # Extension popup UI
│       ├── options/              # Extension options UI
│       └── styles/tokens.css     # Design tokens
└── docs/                         # Architecture diagrams and ADRs
```

---

## API Reference

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/v1/health` | None | Liveness check |
| `POST` | `/v1/session` | None | Create JWT session token |
| `POST` | `/v1/rewrite` | Bearer JWT | Optimize a prompt via Lyra |
| `POST` | `/v1/brief/extract` | Bearer JWT | Extract ConversationBrief from history |
| `POST` | `/v1/brief/update` | Bearer JWT | Update existing brief with new messages |

---

## Environment Variables (backend/.env)

| Variable | Required | Default | Notes |
|----------|----------|---------|-------|
| `PORT` | No | `3001` | |
| `NODE_ENV` | No | `development` | `production` enforces stricter CORS |
| `SESSION_SECRET` | Prod only | — | ≥ 32 chars; signs JWT tokens |
| `ANTHROPIC_API_KEY` | Yes | — | Claude API key |
| `ANTHROPIC_MODEL` | No | `claude-haiku-4-5-20251001` | |
| `LOG_LEVEL` | No | `info` | Pino level |
| `CORS_ORIGIN` | Prod only | `*` | Comma-separated origins |
| `EXTENSION_ORIGINS` | No | — | `chrome-extension://` IDs |

---

## Local Setup (Windows PowerShell)

```powershell
cd c:\Dev\Clairity
npm install
cp backend/.env.example backend/.env   # then fill in ANTHROPIC_API_KEY
npm run dev                             # starts backend (port 3001) + extension watcher
```

`npm run dev` uses `concurrently` — BACKEND label (blue), EXTENSION label (green).
Ctrl+C kills both. Extension loads from `extension/dist/` in Chrome unpacked mode.

---

## Test Coverage — 47 Tests, 5 Files

| File | Tests | What is covered |
|------|-------|-----------------|
| `briefEngine.test.ts` | 12 | extractBrief (valid, LLM failure, bad JSON, fenced), updateBrief (increment, failure, bad JSON), buildSystemPrompt (brief vs raw mode) |
| `conversationStore.test.ts` | 16 | History storage, brief round-trip, shouldExtractBrief thresholds, shouldUpdateBrief every-4 logic |
| `health.test.ts` | 7 | GET /v1/health response shape, version, CORS |
| `rewriteEngine.test.ts` | 7 | callLyra success, LLM fallback, history forwarding, brief passthrough |
| `session.test.ts` | 5 | POST /v1/session, token structure, expiry |

---

## Mandatory Constraints (from CLAUDE.md)

1. No secrets in repo — env vars only, never commit `.env`
2. TypeScript strict mode — no unjustified `any`
3. `.md` files ≤ 150 lines
4. Minimal Chrome permissions — explicit `host_permissions`
5. Adapter pattern (`SiteAdapter`) for all site interactions
6. All API routes under `/v1/`
7. Structured logging — no bare `console.log` in production
8. Input validation (Zod) on every endpoint
9. Errors return `{ error: string, code: string }`
10. No over-engineering — scope to current milestone
