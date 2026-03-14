# UX & Accessibility Specification

## 1. Copy Style Guide
- **Tone:** Friendly, helpful, non-technical, and concise.
- **Terminology:** Use "question" instead of "prompt" by default in simple mode. 
- **Actionability:** Always phrase suggestions around what the user *can* do, not just what they did wrong.
- **Errors:** Never expose technical errors. Use plain English (e.g., "We couldn't reach the server right now. Want to try again?").

## 2. Centralized User-Facing Strings
All UI strings must use the following approved copy:
- **Simple Action:** "Fix my question"
- **Advanced Action:** "Enhance Request"
- **Risk Label High:** "High accuracy risk"
- **Risk Label Medium:** "Medium accuracy risk" 
- **Risk Label Low:** "Low accuracy risk"
- **Empty Input Error:** "Please type something first so we can help."
- **Too Long Error:** "Your text is a bit too long to process (max 50k characters). Could you shorten it?"
- **Backend Down Error:** "Our enhancement service is taking a break. Please try again in a moment."

## 3. Simple vs Advanced Mode Rules
**Simple Mode (Default):**
- Primary Action: "Fix my question"
- UI: Minimal interface showing only the textarea, action button, risk label, and a maximum of ONE top tip.
- Excluded: No preset selectors, no numerical scores, no detailed metadata panels.

**Advanced Mode (Opt-in via toggle):**
- Primary Action: "Enhance Request" 
- UI: Exposes preset mode selectors (intent, tone, format).
- Details: Shows numerical quality scores (bar charts), full list of diagnostics (up to 3 tips), and a guardrail suggestion for the risk label.

## 4. Accessibility Checklist
- [ ] WCAG 2.1 AA compliant colors across all states.
- [ ] `aria-label` or visible label for every interactive element.
- [ ] `aria-live="polite"` on the results/tips section for async updates.
- [ ] `role="alert"` for error messages.
- [ ] All interactive elements must have visible focus indicators.
- [ ] Enter / Ctrl+Enter support on the textarea to trigger actions.

## 5. Accuracy Risk Wording Rules
- **Prohibited Word:** NEVER use the word "hallucination".
- **Format:** Always preface with "Accuracy risk: "
- **Reasons:** Short, plain-language statements (e.g., "Contains medical terms" rather than "Sensitive domain triggered").
- **Guardrails (Advanced Only):** Provide a single actionable safety step, such as "If you're unsure, ask the AI to cite sources."
