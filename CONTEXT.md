# CONTEXT.md — Clairity v0.4.0

## What It Is

Clairity is a Chrome MV3 extension that enhances prompts on AI chat sites
using the **Lyra** prompt optimization framework and **adaptive conversation
intelligence** (living ConversationBrief).

**Supported sites:** ChatGPT, Claude, Gemini, Google AI Search, Perplexity,
Microsoft Copilot (copilot.microsoft.com + m365.cloud.microsoft),
Grok, Poe, HuggingChat.

The extension holds no LLM keys. All inference runs on the Express backend.

---

## How It Works — End-to-End Flow

1. User types a prompt into any supported AI chat site
2. User clicks the **Enhance Request** button (injected by content script)
3. Content script reads conversation history from the DOM via site adapter
4. Service worker merges DOM history with `conversationStore` (fallback)
5. If a `ConversationBrief` exists for this conversation, it is retrieved
6. `POST /v1/rewrite` is called with `{ prompt, history, site, brief? }`
7. `rewriteEngine` wraps prompt in `<prompt_to_optimize>` XML tags and calls `llmClient`
8. Claude Haiku returns an optimized prompt only — no answers, no headers
9. Enhanced prompt is injected into the chat input (with vague-prompt hint if unchanged)
10. A transparency chip is shown (clickable if brief is active)
11. Fire-and-forget: extract or update brief if thresholds are met

---

## Conversation States

| State | Trigger | Context sent | Chip |
|-------|---------|--------------|------|
| **1** | `messageCount < 6` | Full raw history | `✦ N messages used` |
| **2** | `messageCount >= 6`, brief created | Brief + last exchange | `✦ conversation brief active` (clickable) |
| **3** | Every 4 messages after STATE 2 | Brief updated async | Same chip |

---

## Project Structure

```
Clairity/
├── package.json                  # Root workspace (npm workspaces)
├── shared/types/index.ts         # Message, ConversationBrief, Site, SiteAdapter, all API types
├── backend/src/
│   ├── server.ts                 # Express app, CORS, rate limiter
│   ├── lib/
│   │   ├── llmClient.ts          # Anthropic SDK wrapper; never throws
│   │   ├── llmPrompts.ts         # LYRA_SYSTEM_PROMPT (XML-tag-aware), buildSystemPrompt(), getRecentPairs()
│   │   ├── briefEngine.ts        # extractBrief(), updateBrief(); failure-safe
│   │   ├── rewriteEngine.ts      # callLyra(); wraps prompt in <prompt_to_optimize> tags
│   │   ├── token.ts / logger.ts  # JWT sessions, Pino logging
│   │   └── featureFlags.ts       # Env-driven flags
│   ├── middleware/               # auth, validate, rateLimit, errorHandler
│   └── routes/v1/               # health, session, rewrite, brief
├── backend/tests/               # 58 tests across 5 files (vitest)
├── extension/public/manifest.json
├── extension/src/
│   ├── config.ts                 # API_BASE URL
│   ├── adapters/                 # 8 site adapters + registry (60s MutationObserver) + utils
│   │   chatgpt · claude · copilot · gemini · grok · huggingchat · perplexity · poe
│   ├── background/service-worker.ts  # Token cache, handleRewrite, brief orchestration
│   ├── content/                  # index.ts (entry + keep-alive), enhance-button.ts (UI + vague hint), panel.css
│   ├── lib/conversationStore.ts  # chrome.storage.session; history + brief
│   ├── popup/ · options/         # Extension popup and options UI
│   └── styles/tokens.css         # Design tokens
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

## Setup & Env

```powershell
cd c:\Dev\Clairity
npm install
cp backend/.env.example backend/.env   # fill in ANTHROPIC_API_KEY
npm run dev                             # backend (3001) + extension watcher
```

| Variable | Required | Default | Notes |
|----------|----------|---------|-------|
| `PORT` | No | `3001` | |
| `NODE_ENV` | No | `development` | `production` = stricter CORS |
| `SESSION_SECRET` | Prod | — | ≥32 chars; signs JWT |
| `ANTHROPIC_API_KEY` | Yes | — | Claude API key |
| `ANTHROPIC_MODEL` | No | `claude-haiku-4-5-20251001` | |
| `CORS_ORIGIN` | Prod | `*` | Comma-separated origins |

---

## Test Coverage — 58 Tests

| File | Tests | Covers |
|------|-------|--------|
| `briefEngine.test.ts` | 13 | extractBrief, updateBrief, buildSystemPrompt |
| `conversationStore.test.ts` | 16 | History, brief storage, extract/update thresholds |
| `health.test.ts` | 7 | Health endpoint, CORS |
| `rewriteEngine.test.ts` | 13 | callLyra, XML tags, fallback, brief, API key, 20+ tiers |
| `session.test.ts` | 9 | Session create, token validation |

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
