# Pre-Release Checklist (CWS)

## Security & Privacy
- [ ] Ensure `manifest.json` does NOT request `<all_urls>`.
- [ ] Confirm no analytics tools log explicit prompt text or PII.
- [ ] Verify `privacy-policy.md` corresponds cleanly with identical assertions.

## Extension Packaging
- [ ] Build production manifest correctly strips `http://localhost:3001/*`.
- [ ] `clairity.zip` successfully builds with `npm run package --workspace=extension`.
- [ ] Icons (16, 32, 48, 128) are present and referenced correctly in `manifest.json`.
- [ ] No extraneous source `.ts` maps or internal test files exist in the final extension bundle.

## Store Settings
- [ ] Copy the `store-listing.md` content into the localized description fields.
- [ ] Upload all screenshots from `screenshots-checklist.md`.
- [ ] Enter the Permissions Justifications exactly as written in `permissions-justification.md`.
