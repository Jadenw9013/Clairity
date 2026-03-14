# API Contract — v1 (Policies)

See also: [API Endpoints](api-contract.md) for endpoint schemas.

## Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| POST /v1/rewrite | 30 requests | 1 minute |
| POST /v1/auth/* | 10 requests | 1 minute |
| GET /v1/health | 120 requests | 1 minute |

Rate limit headers included on every response:

```
X-RateLimit-Limit: 30
X-RateLimit-Remaining: 28
X-RateLimit-Reset: 1700000060
```

When rate limited, the response is:

```json
{
  "error": "Rate limit exceeded. Try again in N seconds.",
  "code": "RATE_LIMITED",
  "request_id": "uuid"
}
```

With `Retry-After: N` header.

## Payload Limits

- Maximum request body: 10 KB.
- Maximum prompt length: 10,000 characters.
- Maximum response body: 50 KB.

## CORS Policy

- Allowed origin: `chrome-extension://<known-extension-id>`
- No wildcard (`*`) in production.
- Methods: `GET, POST, OPTIONS`
- Allowed headers: `Content-Type, Authorization, X-Request-ID`

## Timeout Policy

- Backend request timeout: 30 seconds.
- LLM provider call timeout: 25 seconds.
- If LLM times out, return 502 `PROVIDER_ERROR`.

## Idempotency

- `POST /v1/rewrite` is NOT idempotent (LLM may return different
  results for the same input).
- `GET /v1/health` is idempotent and cacheable.
- `POST /v1/auth/refresh` invalidates the old refresh token.
