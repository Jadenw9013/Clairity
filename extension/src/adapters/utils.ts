/**
 * Shared utilities for site adapter button positioning.
 * Provides Grammarly-aware injection for consistent
 * button placement across all supported chat sites.
 */

/** Grammarly extension selectors — covers desktop app and browser extension variants */
const GRAMMARLY_SELECTORS = [
  "grammarly-extension",
  "grammarly-desktop-integration",
  "[data-grammarly-shadow-root]",
  '[id*="grammarly"]',
].join(", ");

/**
 * Find the Grammarly extension element inside a container.
 * Returns the first matching Grammarly element, or null.
 */
export function findGrammarlyAnchor(container: Element): Element | null {
  return container.querySelector(GRAMMARLY_SELECTORS);
}

/**
 * Inject the Clairity button near the Grammarly icon for consistent
 * right-side positioning inside the input container.
 *
 * Strategy:
 * 1. If Grammarly is found in the container → insertBefore Grammarly
 *    (Clairity appears immediately to the LEFT of Grammarly)
 * 2. If no Grammarly → absolute-position on the right side of the container
 *
 * @param button  The Clairity button host element to inject
 * @param container The input container element to search within
 * @param fallbackRight CSS `right` value for absolute fallback (default: "48px")
 */
export function injectNearGrammarly(
  button: HTMLElement,
  container: HTMLElement,
  fallbackRight: string = "48px"
): void {
  const grammarly = findGrammarlyAnchor(container);
  if (grammarly && grammarly.parentElement) {
    grammarly.parentElement.insertBefore(button, grammarly);
  } else {
    // Fallback: absolute position on the right side
    const parentStyle = getComputedStyle(container);
    if (parentStyle.position === "static") {
      container.style.position = "relative";
    }
    button.style.position = "absolute";
    button.style.right = fallbackRight;
    button.style.top = "50%";
    button.style.transform = "translateY(-50%)";
    button.style.zIndex = "10";
    container.appendChild(button);
  }
}
