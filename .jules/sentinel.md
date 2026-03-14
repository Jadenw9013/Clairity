## 2025-05-15 - [XSS Prevention in Extension UI]
**Vulnerability:** Use of `innerHTML` in extension popup components for rendering dynamic data (lint tips, risk factors).
**Learning:** Even if data currently comes from a trusted local engine, using `innerHTML` creates a dangerous sink that could be exploited if the source is compromised or changed to an external one (e.g., backend response).
**Prevention:** Enforce the use of safe DOM APIs like `textContent` and `createElement` for all UI rendering. Avoid `innerHTML` entirely as per project security policy.
