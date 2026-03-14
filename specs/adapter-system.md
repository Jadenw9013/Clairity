# Adapter System Specification

## Purpose

Site adapters encapsulate all DOM interaction logic for each supported
AI chat site. This isolates fragile DOM selectors from core logic and
enables independent updates when sites change their markup.

## Supported Sites

| Site | URL Pattern | Priority |
|------|------------|----------|
| ChatGPT | `https://chat.openai.com/*` | P0 |
| Claude | `https://claude.ai/*` | P0 |
| Gemini | `https://gemini.google.com/*` | P1 |

## SiteAdapter Interface

```typescript
interface SiteAdapter {
  /** Unique identifier for this adapter */
  readonly id: string;

  /** Display name (e.g., "ChatGPT") */
  readonly name: string;

  /** URL pattern this adapter handles */
  readonly urlPattern: RegExp;

  /** Check if this adapter should activate on current page */
  detect(): boolean;

  /** Find the prompt input element */
  getPromptElement(): HTMLTextAreaElement | null;

  /** Extract current prompt text */
  getPromptText(): string;

  /** Insert text into the prompt input */
  setPromptText(text: string): void;

  /** Find the insertion point for the Enhance button */
  getButtonAnchor(): HTMLElement | null;

  /** Clean up when adapter is deactivated */
  destroy(): void;
}
```

## Adapter Registry

```typescript
interface AdapterRegistry {
  /** Register a new adapter */
  register(adapter: SiteAdapter): void;

  /** Find matching adapter for current URL */
  detect(): SiteAdapter | null;

  /** Get adapter by ID */
  get(id: string): SiteAdapter | undefined;
}
```

The registry is initialized in the content script entry point.
It iterates registered adapters, calling `detect()` on each.
First match wins.

## DOM Selector Strategy

Adapters must use resilient selectors. Priority order:

1. **`data-testid` attributes** — most stable, used by testing frameworks.
2. **ARIA roles/labels** — accessibility attributes, moderately stable.
3. **Semantic HTML structure** — e.g., `form > textarea`.
4. **Class names** — least stable; prefer partial matches.

**Rules:**
- Never rely on a single selector. Use a fallback chain.
- Wrap selector access in try/catch.
- Return `null` on failure; never throw from adapter methods.
- Log selector failures for diagnostics (not to console in prod).

### Selector Fallback Example

```typescript
getPromptElement(): HTMLTextAreaElement | null {
  const selectors = [
    '[data-testid="prompt-textarea"]',
    'textarea[placeholder*="Send a message"]',
    '#prompt-textarea',
    'form textarea',
  ];
  for (const sel of selectors) {
    const el = document.querySelector<HTMLTextAreaElement>(sel);
    if (el) return el;
  }
  return null;
}
```

## Enhance Button Injection

Each adapter defines where the Enhance button should appear:

1. Adapter returns anchor element via `getButtonAnchor()`.
2. Content script creates button element (not the adapter).
3. Button is positioned relative to anchor.
4. Button uses shadow DOM for style isolation.

**Style isolation:** The Enhance button and any Clairity UI injected
into the page MUST use Shadow DOM to prevent CSS conflicts.

## Adapter Lifecycle

```
Page Load → Content Script Runs
  → Registry.detect() → Adapter found?
    → Yes: adapter.getPromptElement()
      → Found: inject Enhance button, attach listeners
      → Not found: schedule retry with MutationObserver
    → No: content script exits silently
```

## MutationObserver Strategy

For SPAs where the textarea may not exist on initial load:

1. Observe `document.body` for child list changes.
2. On mutation, re-check `adapter.getPromptElement()`.
3. Inject button when element appears.
4. Disconnect observer after successful injection.
5. Timeout after 30 seconds; log warning and stop.

## Error Handling

- Adapters must NEVER throw exceptions.
- All public methods return `null` on failure.
- Log errors via the extension's logging utility.
- If adapter fails, the Enhance button simply doesn't appear.
- Users see no error; extension degrades gracefully.

## Testing Adapters

Each adapter has unit tests with mock DOM:
- Test `detect()` returns true for matching URLs.
- Test `getPromptElement()` with various DOM states.
- Test `setPromptText()` correctly updates textarea value.
- Test graceful failure when DOM elements are missing.
