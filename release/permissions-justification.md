# Permissions Justification

When submitting Clairity to the Chrome Web Store, the following justifications explain our requested permissions:

| Permission | Justification |
|------------|---------------|
| `activeTab` | Required to read the currently active prompt within the user's AI chat window (e.g., ChatGPT or Claude) **only when the user actively interacts** with the injected Clairity "Enhance" button. |
| `storage` | Required to save user preferences locally on their device, specifically to remember whether they prefer the "Simple" or "Advanced" UI mode. |

### Host Permissions
| Host | Justification |
|------|---------------|
| `https://chat.openai.com/*` <br> `https://chatgpt.com/*` <br> `https://claude.ai/*` | Required to inject the Clairity "Enhance" button directly into the DOM of these specific AI web interfaces. We strictly limit host permissions to these supported sites to ensure the extension cannot access tabs or data on unauthorized domains. |
