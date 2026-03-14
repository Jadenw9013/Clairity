import { startAdapterSystem } from "../adapters/registry.js";
import { injectEnhanceButton } from "./enhance-button.js";

/**
 * Content script entry point.
 * Detects the correct site adapter and injects the enhance button
 * when the prompt element is available in the DOM.
 */
startAdapterSystem((adapter, _promptEl) => {
  const anchor = adapter.getButtonAnchor();
  if (!anchor) return; // No suitable anchor — degrade silently

  injectEnhanceButton(adapter, anchor);

  // Re-inject if anchor is removed (SPA navigation)
  const observer = new MutationObserver(() => {
    if (!document.getElementById("clairity-enhance-root")) {
      const newAnchor = adapter.getButtonAnchor();
      if (newAnchor) {
        injectEnhanceButton(adapter, newAnchor);
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
});
