# M6 Self-Critique & Mitigation Report

## Potential Deployment / Submission Failures

**1. Risk**: Extension store reviewer rejects the extension due to overly broad host permissions out-of-the-box (`http://localhost`).
**Mitigation**: Wrote `packages/build-manifest.js` to automatically filter out `localhost` from host permissions on `npm run package`, ensuring production only asks for the required AI domain access.

**2. Risk**: Backend deployments instantly fail runtime health checks due to silent startup crashes from missing auth secrets.
**Mitigation**: Added an explicit pre-start verification routine in the `server.ts` entry file that explicitly evaluates `if (!process.env["SESSION_SECRET"])` and emits a structured `logger.fatal()` prior to cleanly exiting. This enables platforms like Render to catch the config failure immediately and surface the actionable error message in the deployment logs.

**3. Risk**: Broad CORS policy exposes user session cookies when using standard `cors({ origin: "*" })` under production Node.js.
**Mitigation**: Implemented a hard gateway check in `server.ts` prohibiting the backend from booting with a wildcard CORS origin under `NODE_ENV=production`. `docs/deploy-backend.md` explicitly documents setting `CORS_ORIGIN` to the targeted `chrome-extension://[ID]` domain once the store issues it.

**4. Risk**: The Extension zip is rejected visually for missing default icon structures or incorrect resolutions for the storefront.
**Mitigation**: Generated lightweight, mathematically exact placeholder base64 icons at 16x16, 32x32, 48x48, and 128x128. Bound them perfectly to `manifest.json`.

**5. Risk**: CI/CD fails silently during team collaboration due to broken local monorepo symlinks not triggering remote checks.
**Mitigation**: Delivered a stable `.github/workflows/ci.yml` matrix that does an isolated `npm install -> typecheck -> test -> build` cascade on every PR. This safely flags environment issues exactly like the ones navigated during `vite` isolation inside NPM workspaces.
