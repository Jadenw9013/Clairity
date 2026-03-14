# Authentication System Specification

## Overview

The auth system prevents unauthorized use of the Clairity backend API.
The extension authenticates on install and receives a JWT for subsequent
requests. No user accounts are required for Milestone 1.

## Auth Flow

```
Extension Install
  → Generate device fingerprint (extension ID + random nonce)
  → POST /v1/auth/token { extension_id, device_fingerprint }
  → Receive { token (JWT), expires_at, refresh_token }
  → Store token in chrome.storage.local
  → Attach token to all /v1/ requests as Bearer header

Token Expired
  → POST /v1/auth/refresh { refresh_token }
  → Receive new { token, expires_at, refresh_token }
  → Update chrome.storage.local
```

## Token Design

### Access Token (JWT)

```json
{
  "header": {
    "alg": "HS256",
    "typ": "JWT"
  },
  "payload": {
    "sub": "device_fingerprint",
    "ext": "extension_id",
    "iat": 1700000000,
    "exp": 1700003600
  }
}
```

- **Lifetime:** 1 hour.
- **Signing:** HMAC-SHA256 with `AUTH_SECRET` env var.
- **Storage:** `chrome.storage.local` (encrypted at rest by Chrome).

### Refresh Token

- **Format:** opaque random string (32 bytes, hex encoded).
- **Lifetime:** 30 days.
- **Storage:** `chrome.storage.local` alongside access token.
- **Single use:** each refresh issues a new refresh token (rotation).

## Device Fingerprint

Generated on first install:

```typescript
const fingerprint = crypto.randomUUID();
// Stored permanently in chrome.storage.local
// Sent with auth requests for device binding
```

**Not a tracking mechanism** — purely for token binding.
No PII is collected or transmitted.

## Backend Token Verification

On every protected endpoint:

1. Extract `Authorization: Bearer <token>` header.
2. Verify JWT signature with `AUTH_SECRET`.
3. Check `exp` claim (reject if expired).
4. Extract `sub` (device fingerprint) for rate limiting scope.
5. Proceed to route handler.

If verification fails: return `401 UNAUTHORIZED`.

## Token Storage (Extension Side)

```typescript
interface StoredAuth {
  access_token: string;
  refresh_token: string;
  expires_at: number;  // Unix timestamp in ms
}

// Read
const auth = await chrome.storage.local.get('auth');

// Write
await chrome.storage.local.set({ auth: { ... } });

// Clear (on uninstall or logout)
await chrome.storage.local.remove('auth');
```

## Service Worker Auth Logic

The service worker manages all auth transparently:

```
Request arrives from content script
  → Check stored token expiry
  → If valid: attach Bearer header, send request
  → If expired: call /v1/auth/refresh
    → Success: store new tokens, retry original request
    → Failure: re-authenticate from scratch
      → Failure: surface error to user via popup
```

## Rate Limiting Integration

Rate limits are applied per device fingerprint (from JWT `sub` claim),
not per IP. This ensures:
- Fair usage per installation.
- Shared networks don't pool limits.
- VPN/proxy usage doesn't bypass limits.

Fallback: per-IP rate limiting if no valid token is present.

## Security Considerations

- **No user credentials.** Auth is device-based, not account-based.
- **Token rotation.** Refresh tokens are single-use to limit replay.
- **Minimal storage.** Only tokens stored; no PII.
- **HTTPS only.** Tokens transmitted only over TLS.
- **No token in URL.** Always use Authorization header.
- **Backend secret rotation.** `AUTH_SECRET` rotated every 90 days;
  existing tokens remain valid until expiry.

## Future: User Accounts

When user accounts are added:
- OAuth 2.0 flow (Google/GitHub sign-in).
- JWT `sub` becomes user ID instead of device fingerprint.
- Refresh tokens tied to user + device pair.
- This spec will be versioned as `auth-system-v2.md`.

## Milestone 1 Scope

For Milestone 1, auth is **stubbed**:
- Backend accepts any well-formed JWT (signature check skipped).
- Extension generates a static token locally.
- This allows E2E testing without real auth infrastructure.
- Auth hardening happens in Milestone 2.
