const autoShowPanelToggle = document.getElementById("auto-show-panel") as HTMLInputElement;
const resetBtn = document.getElementById("reset-defaults") as HTMLButtonElement;
const toast = document.getElementById("toast") as HTMLDivElement;

// Load initial settings
chrome.storage.local.get(["autoShowPanel"], (res) => {
    if (res.autoShowPanel !== undefined) {
        autoShowPanelToggle.checked = res.autoShowPanel;
    }
});

function saveSettings() {
    chrome.storage.local.set({
        autoShowPanel: autoShowPanelToggle.checked,
    }, () => {
        showToast();
    });
}

function showToast() {
    toast.classList.remove("hidden");
    setTimeout(() => {
        toast.classList.add("hidden");
    }, 2000);
}

autoShowPanelToggle.addEventListener("change", saveSettings);

resetBtn.addEventListener("click", () => {
    autoShowPanelToggle.checked = true;
    saveSettings();
});
