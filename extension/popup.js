document.getElementById("toggleBtn").addEventListener("click", () => {
    // 1. Visual Feedback
    const btn = document.getElementById("toggleBtn");
    const status = document.getElementById("status");
    btn.innerText = "Running...";
    
    // 2. Send Message to the Page
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        // Check if we are allowed to run here
        if (tabs[0].url.startsWith("chrome://")) {
            status.innerText = "Cannot run on system pages!";
            status.style.color = "red";
            btn.innerText = "Error";
            return;
        }

        chrome.tabs.sendMessage(tabs[0].id, {action: "toggleMode"}, (response) => {
            // Check for connection errors (e.g. if the user didn't refresh the page)
            if (chrome.runtime.lastError) {
                status.innerText = "Refresh the page first!";
                status.style.color = "red";
            } else {
                status.innerText = "Mode Toggled!";
                status.style.color = "green";
            }
            // Reset button text
            setTimeout(() => btn.innerText = "Toggle Assistance", 1000);
        });
    });
});