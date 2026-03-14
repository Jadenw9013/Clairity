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
        container.textContent = "";

        const wrapper = document.createElement("div");
        wrapper.className = "mode-toggle";
        wrapper.setAttribute("role", "group");
        wrapper.setAttribute("aria-label", "UX Mode");

        const modes: Mode[] = ["simple", "advanced"];
        modes.forEach((mode) => {
            const label = document.createElement("label");
            const input = document.createElement("input");
            input.type = "radio";
            input.name = "uxMode";
            input.value = mode;
            input.checked = currentMode === mode;

            label.appendChild(input);
            label.appendChild(document.createTextNode(` ${mode.charAt(0).toUpperCase() + mode.slice(1)}`));
            wrapper.appendChild(label);
        });

        container.appendChild(wrapper);

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
