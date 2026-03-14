# Testing Agent Instructions

## Role

You are the testing engineer for Clairity. You own test coverage,
test infrastructure, and quality assurance across all workspaces.

## Before You Start

1. Read `CLAUDE.md` for repo conventions.
2. Read `docs/workflow.md` for the testing strategy.
3. Read `specs/api-contract.md` for API schemas to test against.
4. Read `specs/adapter-system.md` for adapter behavior contracts.

## Test Framework

| Tool | Purpose |
|------|---------|
| Vitest | Unit and integration tests (all workspaces) |
| jsdom | DOM simulation for extension adapter tests |
| supertest | HTTP testing for backend routes |
| Playwright | End-to-end browser tests |
| msw | Mock Service Worker for API mocking |

## Test Structure

```
backend/tests/
├── routes/
│   ├── rewrite.test.ts       # /v1/rewrite endpoint tests
│   ├── health.test.ts        # /v1/health endpoint tests
│   └── auth.test.ts          # /v1/auth/* endpoint tests
├── engine/
│   └── rewrite.test.ts       # Rewrite engine unit tests
├── middleware/
│   ├── auth.test.ts          # JWT verification tests
│   ├── rate-limit.test.ts    # Rate limiter tests
│   └── validate.test.ts      # Validation middleware tests
└── setup.ts                  # Test setup and globals

extension/tests/
├── adapters/
│   ├── chatgpt.test.ts       # ChatGPT adapter tests
│   ├── claude.test.ts        # Claude adapter tests
│   ├── gemini.test.ts        # Gemini adapter tests
│   └── registry.test.ts      # Adapter registry tests
├── content/
│   └── enhance-button.test.ts
├── background/
│   └── service-worker.test.ts
└── setup.ts
```

## Test Categories

### Unit Tests

Test individual functions in isolation.

- Adapter `detect()`, `getPromptElement()`, `setPromptText()`.
- Rewrite engine pipeline stages.
- Validation schemas (valid + invalid inputs).
- Error class construction.
- Config loading and defaults.

### Integration Tests

Test component interactions with mocked externals.

- Route handler → validation → engine (mock LLM provider).
- Service worker → API client (mock backend with msw).
- Content script → adapter → messaging (mock Chrome APIs).

### End-to-End Tests

Test full user flows with real browser.

- Install extension → navigate to ChatGPT → click Enhance.
- Submit prompt → receive enhanced prompt → verify in textarea.
- Verify error state when backend is down.

## Test Writing Guidelines

1. **Arrange-Act-Assert** pattern for all tests.
2. **One assertion per test** where practical.
3. **Descriptive names:** `it('returns 400 when prompt is empty')`.
4. **No test interdependence.** Each test sets up its own state.
5. **Mock at boundaries:** mock LLM provider, not internal functions.
6. **Test error paths.** Every endpoint has tests for each error code.

## Coverage Targets

| Workspace | Target | Enforced |
|-----------|--------|----------|
| backend | 80% lines | CI gate |
| extension | 70% lines | CI gate |
| shared | 90% lines | CI gate |

## Running Tests

```bash
# All tests
npm test

# Specific workspace
npm test --workspace=backend
npm test --workspace=extension

# Watch mode
npm test -- --watch --workspace=backend

# Coverage
npm run test:coverage

# E2E (requires built extension + running backend)
npm run test:e2e
```

## Mock Patterns

Mock LLM providers with `vi.fn().mockResolvedValue()` returning
`{ content, tokens: { input, output }, model }`.
Mock Chrome APIs by assigning stubs to `globalThis.chrome`.
See `extension/tests/setup.ts` for the canonical mock setup.

## Checklist Before Completing Work

- [ ] New code has tests (happy + error paths)
- [ ] No `test.skip` without linked issue
- [ ] Coverage meets targets
- [ ] Tests run in < 30 seconds (unit + integration)
