# Security Model

## Core Security Principle

The extension NEVER holds LLM provider API keys. All LLM calls are
proxied through the Clairity backend. This is a non-negotiable
architectural constraint.

## Threat Model

### Threat 1: API Key Exposure

| Aspect | Detail |
|--------|--------|
| Risk | User's LLM API key leaked via extension source or network |
| Mitigation | Keys exist only in backend env vars; never in client code |
| Verification | Grep repo for key patterns in CI; CSP headers on extension |

### Threat 2: Prompt Injection via Extension

| Aspect | Detail |
|--------|--------|
| Risk | Malicious content in page DOM injected into rewrite request |
| Mitigation | Backend sanitizes all input; strict zod validation |
| Verification | Fuzz testing on `/v1/rewrite` endpoint |

### Threat 3: XSS in Content Scripts

| Aspect | Detail |
|--------|--------|
| Risk | DOM manipulation introduces XSS vector |
| Mitigation | Use `textContent` not `innerHTML`; CSP in manifest |
| Verification | Security audit of all DOM writes in adapters |

### Threat 4: Man-in-the-Middle

| Aspect | Detail |
|--------|--------|
| Risk | Interception of prompt data between extension and backend |
| Mitigation | HTTPS only; certificate pinning in production |
| Verification | Reject non-HTTPS backend URLs in extension config |

### Threat 5: Rate Limit Bypass / Abuse

| Aspect | Detail |
|--------|--------|
| Risk | Attackers flood backend to exhaust LLM API credits |
| Mitigation | Per-IP + per-token rate limiting; request size limits |
| Verification | Load testing; monitoring alerts on anomalous traffic |

## Extension Permissions

```json
{
  "permissions": ["storage", "activeTab"],
  "host_permissions": [
    "https://chat.openai.com/*",
    "https://claude.ai/*",
    "https://gemini.google.com/*"
  ]
}
```

**Rules:**
- No `<all_urls>` — ever.
- No `tabs` permission unless absolutely required.
- `activeTab` preferred over persistent host access where possible.
- Each new host_permission must be justified in PR description.

## Backend Security

### Input Validation
- Every endpoint validates request body with zod schemas.
- Reject payloads exceeding 10KB.
- Strip unexpected fields before processing.

### Authentication
- Extension authenticates via signed tokens (see `specs/auth-system.md`).
- Tokens are short-lived; refresh flow handled by service worker.
- No credentials stored in `chrome.storage` beyond auth tokens.

### CORS Policy
- Backend allows only the specific extension origin:
  `chrome-extension://<known-extension-id>`
- No wildcard origins in production.

### Logging
- Never log prompt content in production (PII risk).
- Log request metadata: timestamp, endpoint, status, latency.
- Structured JSON format for machine parsing.

## Content Security Policy (Extension)

```json
{
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'none'"
  }
}
```

## Secret Management

| Secret | Location | Rotation |
|--------|----------|----------|
| LLM_API_KEY | Backend `.env` | 90 days |
| AUTH_SECRET | Backend `.env` | 90 days |
| Extension ID | Chrome Web Store | Fixed per publish |

## Security Checklist (per PR)

- [ ] No API keys or secrets in code
- [ ] No `innerHTML` usage in content scripts
- [ ] All new endpoints have zod validation
- [ ] No new permissions added without justification
- [ ] CORS config unchanged or reviewed
- [ ] Rate limit rules cover new endpoints
