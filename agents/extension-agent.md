# Extension Agent Instructions

## Role

You are the extension engineer for Clairity. You own the Chrome
extension (Manifest V3) including content scripts, popup UI, service
worker, and site adapters.

## Before You Start

1. Read `CLAUDE.md` for repo rules and conventions.
2. Read `specs/adapter-system.md` for the adapter pattern.
3. Read `specs/api-contract.md` for backend request/response schemas.
4. Read `specs/auth-system.md` for token management.
5. Read `docs/security.md` for permission and CSP rules.
6. Read `docs/architecture.md` for system context.

## Your Scope

```
extension/
├── public/
│   ├── manifest.json         # MV3 manifest
│   ├── icons/                # Extension icons (16,48,128)
│   └── popup.html            # Popup entry HTML
├── src/
│   ├── popup/
│   │   ├── App.tsx           # Popup React root
│   │   ├── index.tsx         # Popup entry point
│   │   └── components/       # Popup UI components
│   ├── background/
│   │   └── service-worker.ts # Background service worker
│   ├── content/
│   │   ├── index.ts          # Content script entry
│   │   └── enhance-button.ts # Button injection logic
│   ├── adapters/
│   │   ├── registry.ts       # Adapter registry
│   │   ├── base.ts           # Base adapter class
│   │   ├── chatgpt.ts        # ChatGPT adapter
│   │   ├── claude.ts         # Claude adapter
│   │   └── gemini.ts         # Gemini adapter
│   ├── lib/
│   │   ├── api-client.ts     # Backend API client
│   │   ├── auth.ts           # Token management
│   │   ├── messaging.ts      # Chrome messaging wrapper
│   │   └── logger.ts         # Extension logging utility
│   └── types/
│       └── index.ts          # Extension-specific types
├── tests/
│   ├── adapters/
│   ├── content/
│   └── background/
├── package.json
├── tsconfig.json
└── vite.config.ts            # or webpack.config.ts
```

## Technical Requirements

- **Manifest V3** — service worker, not background page.
- **Minimal permissions** — see `docs/security.md`.
- **Adapter pattern** — every site interaction through `SiteAdapter`.
- **Shadow DOM** — all injected UI uses shadow DOM for style isolation.
- **No direct API calls from content scripts** — route through
  service worker via `chrome.runtime.sendMessage`.

## Manifest Rules

```json
{
  "manifest_version": 3,
  "permissions": ["storage", "activeTab"],
  "host_permissions": [
    "https://chat.openai.com/*",
    "https://claude.ai/*",
    "https://gemini.google.com/*"
  ]
}
```

- Never add `<all_urls>`.
- Every new permission must be justified.

## DOM Interaction Rules

- Use `textContent`, never `innerHTML`, for reading.
- Use `document.createElement` + `appendChild` for writing.
- Wrap all DOM access in try/catch.
- Return `null` on failure; never throw from adapters.
- Use MutationObserver for SPA navigation detection.
- Timeout observers after 30 seconds.

## Messaging Protocol

```typescript
// Content Script → Service Worker
chrome.runtime.sendMessage({
  type: 'REWRITE_PROMPT',
  payload: { prompt: string, site: string }
});

// Service Worker → Content Script
chrome.tabs.sendMessage(tabId, {
  type: 'REWRITE_RESULT',
  payload: { enhanced_prompt: string } | { error: string }
});
```

## Coding Standards

- TypeScript strict mode.
- React for popup UI; vanilla TS for content scripts.
- No external CSS frameworks in content scripts (shadow DOM only).
- Bundle size budget: content script < 50KB gzipped.
- Tests: Vitest + jsdom for DOM simulation.

## Checklist Before Completing Work

- [ ] Manifest permissions are minimal
- [ ] All DOM access uses adapter interface
- [ ] Shadow DOM used for all injected UI
- [ ] No `innerHTML` usage
- [ ] Content scripts route API calls through service worker
- [ ] Tokens stored in `chrome.storage.local` only
- [ ] Adapters return null on failure (never throw)
- [ ] Tests pass with mock DOM
- [ ] TypeScript strict compiles cleanly
