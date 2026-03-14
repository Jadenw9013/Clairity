import { startAdapterSystem } from "../adapters/registry.js";
import { injectEnhanceButton } from "./enhance-button.js";

/**
 * Simple debounce to limit execution frequency during rapid DOM changes.
 */
function debounce(fn: () => void, delay: number) {
  let timeout: ReturnType<typeof setTimeout>;
  return () => {
    clearTimeout(timeout);
    timeout = setTimeout(fn, delay);
  };
}

/**
 * Content script entry point.
 * Detects the correct site adapter and injects the enhance button
 * when the prompt element is available in the DOM.
 */
startAdapterSystem((adapter, _promptEl) => {
  const anchor = adapter.getButtonAnchor();
  if (!anchor) return; // No suitable anchor — degrade silently

  injectEnhanceButton(adapter, anchor);

  // Re-inject if anchor is removed (SPA navigation).
  // Debounced to 100ms to avoid expensive DOM lookups during streaming/typing.
  const observer = new MutationObserver(
    debounce(() => {
      if (!document.getElementById("clairity-enhance-root")) {
        const newAnchor = adapter.getButtonAnchor();
        if (newAnchor) {
          injectEnhanceButton(adapter, newAnchor);
        }
      }
    }, 100)
  );

  observer.observe(document.body, { childList: true, subtree: true });
});
