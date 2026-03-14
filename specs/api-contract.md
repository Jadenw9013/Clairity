# API Contract — v1 (Endpoints)

See also: [API Policies](api-contract-policies.md) for rate limits and
payload constraints.

## Base URL

```
Production:  https://api.clairity.app/v1
Development: http://localhost:3001/v1
```

## Common Headers

```
Content-Type: application/json
Authorization: Bearer <token>    (required for protected endpoints)
X-Request-ID: <uuid>             (optional, echoed in response)
```

## Error Response Format (all endpoints)

```json
{
  "error": "Human-readable message",
  "code": "MACHINE_READABLE_CODE",
  "request_id": "uuid"
}
```

Standard error codes:
- `VALIDATION_ERROR` — 400
- `UNAUTHORIZED` — 401
- `RATE_LIMITED` — 429
- `INTERNAL_ERROR` — 500
- `PROVIDER_ERROR` — 502

---

## POST /v1/rewrite

Rewrites a user prompt into an optimized structured prompt.

### Request

```json
{
  "prompt": "string (1-10000 chars, required)",
  "context": {
    "site": "chatgpt | claude | gemini (required)",
    "conversation_type": "new | continuing (default: new)",
    "language": "string (default: en)"
  },
  "options": {
    "mode": "enhance | restructure | expand (default: enhance)",
    "preserve_intent": "boolean (default: true)",
    "max_length": "number (optional, chars)"
  }
}
```

### Response — 200

```json
{
  "enhanced_prompt": "string",
  "metadata": {
    "model_used": "string",
    "tokens_used": { "input": "number", "output": "number" },
    "rewrite_mode": "string",
    "processing_time_ms": "number"
  },
  "request_id": "uuid"
}
```

### Errors

| Status | Code | When |
|--------|------|------|
| 400 | VALIDATION_ERROR | Bad/missing fields |
| 401 | UNAUTHORIZED | Missing or invalid token |
| 429 | RATE_LIMITED | Too many requests |
| 502 | PROVIDER_ERROR | LLM provider failed |

---

## GET /v1/health

Public endpoint. No auth required.

### Response — 200

```json
{
  "status": "ok",
  "version": "string",
  "timestamp": "ISO 8601"
}
```

---

## POST /v1/auth/token

Issues an authentication token for the extension.

### Request

```json
{
  "extension_id": "string (required)",
  "device_fingerprint": "string (required)"
}
```

### Response — 200

```json
{
  "token": "string (JWT)",
  "expires_at": "ISO 8601",
  "refresh_token": "string"
}
```

---

## POST /v1/auth/refresh

Refreshes an expired access token.

### Request

```json
{
  "refresh_token": "string (required)"
}
```

### Response — 200

Same schema as `POST /v1/auth/token` response.
