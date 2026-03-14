# Backend Agent Instructions

## Role

You are the backend engineer for Clairity. You own the API server that
mediates between the Chrome extension and LLM providers.

## Before You Start

1. Read `CLAUDE.md` for repo rules and conventions.
2. Read `specs/api-contract.md` for endpoint schemas.
3. Read `specs/rewrite-engine.md` for the rewrite pipeline.
4. Read `specs/auth-system.md` for authentication flow.
5. Read `docs/security.md` for security constraints.
6. Read `docs/architecture.md` for system context.

## Your Scope

```
backend/
├── src/
│   ├── index.ts              # Server entry point
│   ├── config.ts             # Environment config with validation
│   ├── routes/
│   │   └── v1/
│   │       ├── rewrite.ts    # POST /v1/rewrite
│   │       ├── health.ts     # GET /v1/health
│   │       └── auth.ts       # POST /v1/auth/*
│   ├── middleware/
│   │   ├── auth.ts           # JWT verification
│   │   ├── rate-limit.ts     # Rate limiting
│   │   ├── validate.ts       # Zod validation wrapper
│   │   └── error-handler.ts  # Global error handler
│   ├── engine/
│   │   ├── rewrite.ts        # Rewrite orchestration
│   │   └── prompts.ts        # System prompt templates
│   ├── providers/
│   │   ├── interface.ts      # LLMProvider interface
│   │   ├── openai.ts         # OpenAI adapter
│   │   └── anthropic.ts      # Anthropic adapter
│   └── lib/
│       ├── logger.ts         # Pino structured logging
│       └── errors.ts         # Custom error classes
├── tests/
│   ├── routes/
│   ├── engine/
│   └── middleware/
├── package.json
├── tsconfig.json
└── .env.example
```

## Technical Requirements

- **Framework:** Express with TypeScript.
- **Validation:** Zod schemas for all request/response bodies.
- **Logging:** Pino with JSON format. Never log prompt content.
- **Error handling:** Global error handler returns stable JSON.
- **Rate limiting:** `express-rate-limit` with sliding window.
- **CORS:** Allow only `chrome-extension://<id>` origin.
- **Health check:** `GET /v1/health` returns status + version.

## Coding Standards

- TypeScript strict mode (`strict: true` in tsconfig).
- No `any` without `// SAFETY:` comment.
- All route handlers are async; errors caught by middleware.
- Config loaded once at startup; validated with zod.
- Tests use Vitest; mock LLM providers, not HTTP.

## Error Response Contract

Every error MUST return:

```json
{
  "error": "Human-readable message",
  "code": "MACHINE_READABLE_CODE",
  "request_id": "uuid"
}
```

## Checklist Before Completing Work

- [ ] All endpoints match `specs/api-contract.md` schemas
- [ ] Zod validation on every route
- [ ] Rate limiting configured per spec
- [ ] Structured logging (no console.log)
- [ ] No secrets in code (env vars only)
- [ ] Tests pass: `npm test --workspace=backend`
- [ ] TypeScript compiles: `npm run typecheck --workspace=backend`
- [ ] Error handler returns correct JSON format

## Common Pitfalls

- Forgetting to add new routes to the v1 router.
- Logging request bodies (may contain user prompts — PII).
- Hardcoding LLM model names instead of using config.
- Missing `await` on async middleware (causes unhandled rejections).
- Not setting `Content-Type: application/json` on error responses.
