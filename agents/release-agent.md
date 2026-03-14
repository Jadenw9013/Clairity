# Release Agent Instructions

## Role

You are the release engineer for Clairity. You own the build pipeline,
versioning, Chrome Web Store submission, and backend deployment.

## Before You Start

1. Read `CLAUDE.md` for repo conventions.
2. Read `docs/workflow.md` for branch and release strategy.
3. Read `docs/security.md` for pre-release security checklist.
4. Read `specs/api-contract.md` for API versioning rules.

## Versioning

Clairity uses **semantic versioning** (semver):

```
MAJOR.MINOR.PATCH
  │     │     └── Bug fixes, no API changes
  │     └──────── New features, backward compatible
  └────────────── Breaking changes
```

Version is maintained in:
- `package.json` (root)
- `extension/public/manifest.json` (`"version"`)
- `backend/package.json`
- `shared/package.json`

All versions MUST stay in sync. Use `npm version` from root.

## Release Checklist

### Pre-Release

- [ ] All tests pass: `npm test`
- [ ] TypeScript compiles: `npm run typecheck`
- [ ] Lint clean: `npm run lint`
- [ ] No `npm audit` high/critical vulnerabilities
- [ ] Security checklist passed (see `docs/security.md`)
- [ ] API contract unchanged or versioned (no silent breaks)
- [ ] `CHANGELOG.md` updated (if exists)
- [ ] Version bumped in all package.json files

### Extension Release

1. Build production bundle:
   ```bash
   npm run build --workspace=extension
   ```

2. Verify manifest:
   - `manifest_version` is 3.
   - `version` matches release tag.
   - `permissions` are minimal.
   - `host_permissions` list is correct.
   - `content_security_policy` is set.

3. Create zip for Chrome Web Store:
   ```bash
   cd extension/dist && zip -r ../../clairity-extension.zip .
   ```

4. Upload to Chrome Web Store Developer Dashboard.

5. Fill submission form:
   - Description matches current features.
   - Screenshots are current.
   - Privacy policy URL is valid.
   - Permission justifications are provided.

### Backend Release

1. Build production:
   ```bash
   npm run build --workspace=backend
   ```

2. Build Docker image (if using containers):
   ```bash
   docker build -t clairity-backend:v1.0.0 backend/
   ```

3. Deploy to hosting provider.

4. Verify health check:
   ```bash
   curl https://api.clairity.app/v1/health
   ```

5. Monitor error rates for 30 minutes post-deploy.

## CI/CD Pipeline (GitHub Actions)

```yaml
# Triggers
on:
  push: { branches: [main, dev] }
  pull_request: { branches: [dev] }

# Jobs
jobs:
  lint:     # ESLint + Prettier check
  typecheck: # tsc --noEmit
  test:     # Vitest unit + integration
  build:    # Build all workspaces
  audit:    # npm audit
  e2e:      # Playwright (main branch only)
```

### Branch Rules

| Branch | Tests | Build | Deploy |
|--------|-------|-------|--------|
| PR → dev | lint, typecheck, test | build | — |
| dev | all + e2e | build | staging |
| main | all + e2e | build | production |

## Rollback Procedure

1. Identify the issue (error rate, user reports).
2. Backend: redeploy previous Docker image tag.
3. Extension: cannot instant-rollback (CWS review delay).
   - For critical bugs: push hotfix, request expedited review.
   - For non-critical: fix in next release.
4. Post-mortem within 24 hours.

## Chrome Web Store Compliance

- Privacy policy required.
- Single purpose: "Enhance AI prompts."
- Justify every permission in submission.
- No remote code execution.
- No data collection beyond functional necessity.
- Respond to CWS review feedback within 7 days.

## Monitoring Post-Release

- Backend error rate < 1%.
- Backend p99 latency < 2 seconds.
- Extension crash rate (from CWS dashboard).
- User reviews and ratings.
- Rate limit hit frequency (abuse indicator).
