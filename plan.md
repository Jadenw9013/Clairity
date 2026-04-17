1. **Understand the problem**:
   - `injectEnhanceButton` is a large function in `extension/src/content/enhance-button.ts`.
   - It performs several tasks: creating the host element, attaching a shadow DOM, creating the button, defining loading state management, binding the click event (which fetches prompt data, filters history, sends a message to the background script, and handles the response), and finally, injecting the button into the DOM based on specific strategies.
   - Refactoring this function into smaller helpers improves readability and maintainability.

2. **Refactoring Plan**:
   - Extract DOM injection logic to `insertButtonIntoDOM(host: HTMLElement, anchor: HTMLElement)`
   - Extract click handler logic to `handleEnhanceClick(adapter: SiteAdapter, btn: HTMLButtonElement, setLoading: (loading: boolean) => void)`
   - Extract the `createButton` logic into `createEnhanceButtonElements()` returning the host, shadow, and button.
   - `injectEnhanceButton` will then just orchestrate these pieces.

3. **Helper Functions**:
   - `function insertButtonIntoDOM(host: HTMLElement, anchor: HTMLElement)`
   - `async function handleEnhanceClick(adapter: SiteAdapter, setLoading: (loading: boolean) => void)`
   - `function createHostAndButton(): { host: HTMLElement; shadow: ShadowRoot; btn: HTMLButtonElement, setLoading: (loading: boolean) => void }` (or handle `setLoading` in there, or maybe `injectEnhanceButton` builds the button and just uses `handleEnhanceClick` and `insertButtonIntoDOM`).

   Let's keep it simpler and match the prompt:
   - Extract `createEnhanceButtonUI()`
   - Extract `handleEnhanceClick(adapter: SiteAdapter, setLoading: (loading: boolean) => void)`
   - Extract `injectHostElement(host: HTMLElement, anchor: HTMLElement)`

   Looking closely at `injectEnhanceButton`, here's how we can restructure:

   ```typescript
   function createHostElement(): { host: HTMLElement, shadow: ShadowRoot } { ... }
   function createTriggerButton(): { btn: HTMLButtonElement, setLoading: (loading: boolean) => void } { ... }
   async function handleEnhanceClick(adapter: SiteAdapter, setLoading: (loading: boolean) => void): Promise<void> { ... }
   function insertHostElement(host: HTMLElement, anchor: HTMLElement): void { ... }
   ```

   Actually, let's look at the current function:
   ```typescript
   export function injectEnhanceButton(
     adapter: SiteAdapter,
     anchor: HTMLElement
   ): void {
     if (document.getElementById(BUTTON_ID)) return;

     const { host, shadow } = createHostElement();
     const { btn, setLoading } = createTriggerButton(shadow);

     btn.addEventListener("click", () => handleEnhanceClick(adapter, setLoading));

     insertHostElement(host, anchor);
   }
   ```

4. **Verify tests and pre-commit**:
   - Run vitest tests in `extension`.
   - Run typecheck in `extension`.
   - Ensure the extension builds correctly.
   - Use `pre_commit_instructions`.

5. **Commit and Submit**:
   - Title: "🧹 Refactor injectEnhanceButton into smaller helper functions"
   - Message and Description detailing the refactoring.
