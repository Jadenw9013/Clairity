// Mode Toggle Component (Vanilla TS)

export type Mode = "simple" | "advanced";

export function initModeToggle(
    container: HTMLDivElement,
    onChange: (mode: Mode) => void
): void {
    // Try to load from storage
    chrome.storage.local.get(["uxMode"], (result) => {
        const currentMode = (result.uxMode as Mode) || "simple";
        render(currentMode);
        onChange(currentMode);
    });

    function render(currentMode: Mode) {
        container.innerHTML = `
      <div class="mode-toggle" role="group" aria-label="UX Mode">
        <label>
          <input type="radio" name="uxMode" value="simple" ${currentMode === "simple" ? "checked" : ""
            }>
          Simple
        </label>
        <label>
          <input type="radio" name="uxMode" value="advanced" ${currentMode === "advanced" ? "checked" : ""
            }>
          Advanced
        </label>
      </div>
    `;

        const inputs = container.querySelectorAll("input");
        inputs.forEach((input) => {
            input.addEventListener("change", (e) => {
                const newMode = (e.target as HTMLInputElement).value as Mode;
                chrome.storage.local.set({ uxMode: newMode });
                onChange(newMode);
            });
        });
    }
}
