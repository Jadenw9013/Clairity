# Clairity

> Enhance your prompts on ChatGPT, Claude, Gemini, Google AI Search,
> Perplexity, Microsoft Copilot, M365 Copilot, Grok, Poe, and HuggingChat
> using conversation context and the Lyra optimization framework.

## Install & Use (5 minutes)

**Prerequisites:** Node.js >= 20, npm >= 10, Chrome

**1. Clone and build**
```bash
git clone https://github.com/Jadenw9013/Clairity.git
cd Clairity
npm install
npm run build --workspace=shared
npm run build --workspace=extension
```

**2. Load in Chrome**
1. Go to `chrome://extensions`
2. Enable Developer Mode (top right toggle)
3. Click **Load unpacked** → select `extension/dist/`

**3. Add your API key**
1. Open the Clairity popup in Chrome
2. Enter your Anthropic API key (starts with `sk-ant-`)
3. Click **Save** — the enhance button unlocks

Get a free key at [console.anthropic.com](https://console.anthropic.com).
Costs fractions of a cent per use.

**To update after a `git pull`:**
```bash
npm run build --workspace=shared
npm run build --workspace=extension
```
Then hit the **refresh icon** on the extension in `chrome://extensions`.

No `.env` setup required. The backend requires no server-side API keys — your key is sent per-request via the `x-api-key` header. Just build, load, and add your key.

---

## Architecture

```
┌─────────────┐     HTTPS      ┌─────────────┐      ┌──────────────┐
│  Extension   │ ──────────────→│  Backend API │─────→│  Anthropic   │
│  (MV3)       │←──────────────│  (/v1)       │←─────│  Claude API  │
└─────────────┘    JSON         └─────────────┘      └──────────────┘
```

Users provide their own Anthropic API key via the extension popup.
Keys are stored in `chrome.storage.local` and sent per-request via the `x-api-key` header.
The backend holds **no API keys** — it is stateless and key-agnostic.

## Development

### Run Backend (dev)

```bash
npm run dev --workspace=backend
```

### Build Extension

```bash
npm run build --workspace=extension
```

Then load `extension/dist/` as an unpacked extension in `chrome://extensions`.

### Run Tests

```bash
npm test
```

## Project Structure

```
extension/   Chrome extension (Manifest V3, TypeScript, 8 site adapters)
backend/     API server (Express, TypeScript, Lyra engine)
shared/      Shared types and utilities
```

## Supported Sites

| Site | Adapter | Editor type |
|------|---------|-------------|
| ChatGPT | `chatgpt.ts` | Textarea |
| Claude | `claude.ts` | ProseMirror |
| Gemini | `gemini.ts` | rich-textarea |
| Google AI Search | `gemini.ts` | rich-textarea |
| Perplexity | `perplexity.ts` | Slate.js |
| Copilot | `copilot.ts` | Lexical |
| M365 Copilot | `copilot.ts` | Lexical |
| Grok | `grok.ts` | contenteditable |
| Poe | `poe.ts` | contenteditable |
| HuggingChat | `huggingchat.ts` | textarea |

## Environment Variables (Backend)

| Variable | Required | Default | Notes |
|----------|----------|---------|-------|
| `PORT` | No | `3001` | |
| `NODE_ENV` | No | `development` | `production` = stricter CORS |
| `SESSION_SECRET` | Prod | — | ≥16 chars; signs JWT session tokens |
| `CORS_ORIGIN` | Prod | `*` | Comma-separated origins; cannot be `*` in production |
| `ANTHROPIC_MODEL` | No | `claude-haiku-4-5-20251001` | Model used for rewriting |

> **Note:** `ANTHROPIC_API_KEY` is **not** a server env var. Clients provide their own key via the `x-api-key` header on every request.

## Changelog

### v1.2 — Per-Request API Key Migration

- Removed server-side `ANTHROPIC_API_KEY` dependency — backend no longer holds any LLM keys
- `x-api-key` header is now **required** on all `/v1/rewrite` and `/v1/brief/*` endpoints
- Missing key returns `400 MISSING_API_KEY` with clear error message
- Removed singleton Anthropic client — fresh instance created per request for isolation
- Server starts cleanly without any Anthropic credentials in the environment

### v1.1 — Multi-Platform UI & Engine Hardening

**Rewrite Engine**
- Hardened system prompts with explicit negative rules to prevent the LLM from answering prompts instead of optimizing them
- Capped conversation history to 20 messages / 500 chars per message to prevent token overflow and 3s timeouts
- Increased timeout to 8s and retries to 2 for improved reliability

**Gemini & Google AI Mode**
- Refactored `gemini.ts` with hostname-based injection strategies for `gemini.google.com` vs Google AI Mode (`udm=50`)
- Fixed button overlap on Google AI Mode by targeting the `+` button with `afterend` injection

**Microsoft Copilot & M365 Copilot**
- Refactored `copilot.ts` with environment-specific strategies for `copilot.microsoft.com` vs `m365.cloud.microsoft`
- Copilot: uses Smart dropdown as landmark → targets voice button wrapper for right-side inline placement
- M365: structural anchor detection finds right-most toolbar button for `beforebegin` injection
- Added `beforebegin` as a new injection mode in the enhance button system

**Extension Icons**
- Replaced placeholder icons with branded indigo gradient + ✦ sparkle at 16/32/48/128px

**Code Quality**
- Removed dead code and debug `console.log` statements
- Cleaned up malformed `.env.example`

### v1.0 — Initial Release

- Lyra prompt optimization framework with conversation briefing
- 8 site adapters covering 10 AI platforms
- Chrome extension with popup API key management
- Backend API with rate limiting, validation, and structured logging

## Constraints

- TypeScript strict mode everywhere
- Minimal Chrome permissions (no `<all_urls>`)
- Versioned API routes (`/v1/`)
- Structured logging, input validation, rate limiting
- Adapter pattern for all site integrations

## License

Proprietary. All rights reserved.
