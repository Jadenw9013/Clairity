# Architecture

## System Overview

Clairity consists of three layers communicating over HTTPS with JSON payloads.

```
┌──────────────────────────────────────────────────────────┐
│                      User's Browser                       │
│  ┌─────────────┐   ┌───────────┐   ┌──────────────────┐ │
│  │ Popup UI    │   │ Content   │   │ Service Worker   │ │
│  │ (React)     │◄─►│ Scripts   │◄─►│ (Background)     │ │
│  └─────────────┘   └───────────┘   └──────────────────┘ │
│                           │                    │          │
└───────────────────────────┼────────────────────┼──────────┘
                            │                    │
                    DOM injection         HTTPS POST
                    (adapters)           ┌───────┘
                                         ▼
                            ┌─────────────────────┐
                            │   Backend API (/v1)  │
                            │   ┌───────────────┐  │
                            │   │ Rate Limiter   │  │
                            │   │ Validator      │  │
                            │   │ Rewrite Engine │  │
                            │   └───────────────┘  │
                            └──────────┬──────────┘
                                       │
                                       ▼
                            ┌─────────────────────┐
                            │   LLM Provider       │
                            │   (OpenAI/Anthropic)  │
                            └─────────────────────┘
```

## Extension Layer

| Component | Purpose |
|-----------|---------|
| **Popup UI** | Settings, manual rewrite trigger, status display |
| **Content Scripts** | Injected into supported AI chat sites |
| **Site Adapters** | Per-site DOM interaction (ChatGPT, Claude, Gemini) |
| **Service Worker** | Background messaging, API calls, state management |

### Content Script Lifecycle

1. Content script loads on matching URL patterns.
2. Detects site via adapter registry.
3. Adapter locates prompt textarea using resilient selectors.
4. Injects "Enhance" button adjacent to textarea.
5. On click: captures prompt → sends to service worker → backend call.
6. Receives enhanced prompt → adapter inserts it back into textarea.

## Backend Layer

| Component | Purpose |
|-----------|---------|
| **Router** | Versioned routes under `/v1/` |
| **Validation** | Zod schemas on every endpoint |
| **Rate Limiter** | Per-IP and per-token sliding window |
| **Rewrite Engine** | Constructs system prompt + user prompt for LLM |
| **LLM Client** | Adapter for OpenAI / Anthropic APIs |
| **Logger** | Structured JSON logging (pino) |

### Request Flow

```
POST /v1/rewrite
  → Rate limit check
  → Input validation (zod)
  → Auth verification
  → Rewrite engine builds LLM payload
  → LLM provider call
  → Response validation
  → Return structured JSON
```

## Shared Types

The `shared/` directory contains TypeScript interfaces used by both
extension and backend:
- `RewriteRequest` / `RewriteResponse`
- `SiteAdapter` interface
- `ErrorResponse` schema
- Common enums (provider types, rewrite modes)

## Data Flow Summary

1. User types prompt in ChatGPT/Claude/Gemini.
2. Clicks "Enhance" button (injected by content script).
3. Content script extracts prompt text via site adapter.
4. Service worker sends `POST /v1/rewrite { prompt, context }`.
5. Backend validates, rate-limits, authenticates.
6. Backend calls LLM with rewrite system prompt + user prompt.
7. Backend returns `{ enhanced_prompt, metadata }`.
8. Service worker relays to content script.
9. Site adapter inserts enhanced prompt into textarea.

## Key Design Decisions

- **No direct LLM calls from extension** — security boundary.
- **Adapters are stateless** — no adapter holds user data.
- **Service worker is the single API gateway** — content scripts
  never make network calls directly.
- **Backend is stateless** — no session storage; auth via tokens.

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Extension UI | React + TypeScript |
| Content Scripts | Vanilla TS (minimal bundle size) |
| Build (ext) | Vite or webpack |
| Backend | Node.js + Express + TypeScript |
| Validation | Zod |
| Logging | Pino |
| Testing | Vitest (unit), Playwright (e2e) |
