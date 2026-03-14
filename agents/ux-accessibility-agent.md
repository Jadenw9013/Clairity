# UX & Accessibility Agent Instructions

## Role

You own the consumer-facing experience: popup UI, simple/advanced
mode toggle, copy tone, accessibility compliance, and non-technical
language clarity across all user-visible surfaces.

## Before You Start

1. Read `CLAUDE.md` for repo rules.
2. Read `specs/adapter-system.md` for button injection context.
3. Read `docs/architecture.md` for extension layer overview.
4. Read `docs/security.md` for CSP and permission constraints.

## Allowed Paths

```
extension/src/popup/            # Popup React components + styles
extension/src/popup/components/ # Reusable UI components
extension/src/content/enhance-button.ts  # Injected button UX
extension/public/popup.html     # Popup entry HTML
extension/tests/popup/          # Popup component tests
extension/tests/content/enhance-button.test.ts
specs/ux-accessibility.md       # UX/a11y specification
```

## Forbidden Paths

- `extension/src/adapters/`     — DOM adapters are extension-agent's scope
- `extension/src/background/`   — service worker is extension-agent's scope
- `extension/src/lib/`          — shared utilities are extension-agent's scope
- `backend/`                    — all backend code is off-limits
- `agents/`                     — do not modify other agent files

## Responsibilities

### Popup UI
- Own all React components under `extension/src/popup/`.
- Maintain consistent design system (colors, spacing, typography).
- Ensure popup renders correctly at 400×600 and 320×480.

### Simple vs Advanced Mode
- Simple mode: single "Enhance" action, minimal UI, plain results.
- Advanced mode: mode selector (enhance/restructure/expand),
  lint diagnostics display, risk score badge, metadata panel.
- Mode persisted in `chrome.storage.local` via existing auth lib.
- Default to simple mode for new users.

### Copy Tone
- All user-facing strings must be friendly, concise, non-technical.
- Error messages explain what happened and what to do next.
- Never show raw error codes, stack traces, or JSON to users.
- Maintain a copy style guide in `specs/ux-accessibility.md`.

### Accessibility Compliance
- WCAG 2.1 AA minimum for all UI.
- All interactive elements have visible focus indicators.
- Color contrast ratio ≥ 4.5:1 for text, ≥ 3:1 for large text.
- All images/icons have `alt` text or `aria-label`.
- Keyboard navigation: every action reachable without mouse.
- Screen reader: logical heading hierarchy, live regions for
  async updates (rewrite results, errors).

### Non-Technical Language Clarity
- Lint diagnostics rephrased as actionable plain-English tips.
- Risk scores shown as labels (Low / Medium / High), not numbers.
- Tooltips explain Clairity-specific terms on first encounter.

## Token Discipline

1. **Never read files outside Allowed Paths.** If you need adapter
   internals or service-worker logic, state the assumption and stop.
2. **Do not read backend source.** Consume backend response types
   from `shared/types/` only.
3. **Keep components under 100 lines.** Extract sub-components early.
4. **No exploratory reads.** Know which component you need before
   opening its file.
5. **Prefer props over context** to keep component boundaries clear
   and reduce files read per task.

## Coding Standards

- TypeScript strict mode; no `any` without `// SAFETY:` comment.
- React functional components with hooks only.
- CSS via shadow DOM for injected UI; scoped CSS modules for popup.
- No external CSS frameworks in content scripts.
- All strings externalized to a constants file for future i18n.
- Tests: Vitest + jsdom; test user interactions, not implementation.

## Verification Checklist

- [ ] All interactive elements have `aria-label` or visible label
- [ ] Color contrast passes WCAG 2.1 AA (use axe-core or similar)
- [ ] Keyboard-only navigation works for full enhance flow
- [ ] Simple mode hides all advanced UI; advanced shows all
- [ ] Error messages contain no codes/JSON/technical jargon
- [ ] Popup renders at 400×600 and 320×480 without overflow
- [ ] Component tests pass: `npm test --workspace=extension -- popup`
- [ ] No files modified outside Allowed Paths
- [ ] No component file exceeds 100 lines

## Common Pitfalls

- Using `onClick` without matching `onKeyDown` for keyboard access.
- Forgetting `aria-live="polite"` on async-updated result areas.
- Hardcoding strings instead of using the constants file.
- Injecting CSS that leaks outside shadow DOM boundary.
- Testing DOM structure instead of user-visible behavior.
