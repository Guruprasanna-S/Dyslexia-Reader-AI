// ==========================================
// 1. CONFIGURATION
// ==========================================
// Check your Hugging Face URL. Do NOT add /simplify here.
const BASE_URL = "https://adharshvs-dyslexia-api.hf.space"; 
let currentLang = "en"; // Default language is English

// ==========================================
// 2. VISUAL AIDS (Reading Ruler & Font)
// ==========================================
let rulerActive = false;

// Create the Ruler Element
const ruler = document.createElement('div');
ruler.id = 'reading-ruler';
// Style: Grey bar, transparent, follows mouse, clicks pass through it
ruler.style.cssText = `
    position: fixed; 
    left: 0; 
    width: 100%; 
    height: 40px; 
    background: rgba(0,0,0,0.1); 
    pointer-events: none; 
    z-index: 2147483647; 
    display: none; 
    border-top: 2px solid orange; 
    border-bottom: 2px solid orange;
`;
document.body.appendChild(ruler);

// Move Ruler with Mouse
document.addEventListener('mousemove', (e) => {
    if (rulerActive) {
        ruler.style.top = (e.clientY - 20) + 'px';
    }
});

// Toggle Dyslexia Mode (Message from Popup)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "toggleMode") {
        document.body.classList.toggle("dyslexia-mode");
        rulerActive = !rulerActive;
        ruler.style.display = rulerActive ? 'block' : 'none';
        
        const status = rulerActive ? "active" : "off";
        speak(`Dyslexia support ${status}`);
        sendResponse({status: "done"});
    }
});

// ==========================================
// 3. SMART SELECTION LOGIC
// ==========================================
document.addEventListener('mouseup', (e) => {
    // 1. Prevent menu from closing if clicking INSIDE the menu
    if (e.target.closest('#ai-action-menu')) return;

    let selectedText = window.getSelection().toString().trim();
    
    // 2. If click is empty, close menu
    if (selectedText.length === 0) {
        const menu = document.getElementById('ai-action-menu');
        if (menu) menu.remove();
        return;
    }

    // 3. Clean text to count words correctly
    let cleanText = selectedText.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"");
    let wordCount = cleanText.split(/\s+/).length;

    // 4. DECISION TREE
    if (wordCount === 1 && cleanText.length > 2) {
        // CASE A: Single Word -> Dictionary
        handleDefinition(cleanText);
    } 
    else if (wordCount > 3) {
        // CASE B: Sentence -> Show Action Menu
        showActionMenu(e.pageX, e.pageY + 15, selectedText);
    }
});

// ==========================================
// 4. UI: ACTION MENU (With Mic & Language)
// ==========================================
function showActionMenu(x, y, text) {
    // Remove old menu if exists
    const old = document.getElementById('ai-action-menu');
    if (old) old.remove();

    const div = document.createElement('div');
    div.id = 'ai-action-menu';
    div.style.cssText = `
        position: absolute; left: ${x}px; top: ${y}px;
        background: #222; color: white; padding: 10px; border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3); z-index: 2147483646;
        display: flex; flex-direction: column; gap: 8px; font-family: sans-serif; min-width: 180px;
    `;
    
    // -- ROW 1: Action Buttons --
    const rowBtns = document.createElement('div');
    rowBtns.style.cssText = "display:flex; gap:5px;";

    const btnSimplify = createBtn("✨ Simplify", "#4CAF50");
    btnSimplify.onmousedown = (e) => { e.preventDefault(); handleSimplification(text); };

    const btnExplain = createBtn("🗣️ Explain", "#2196F3");
    btnExplain.onmousedown = (e) => { e.preventDefault(); handleExplanation(text); };

    rowBtns.appendChild(btnSimplify);
    rowBtns.appendChild(btnExplain);

    // -- ROW 2: Language & Mic Tools --
    const rowTools = document.createElement('div');
    rowTools.style.cssText = "display:flex; gap:5px; align-items:center; justify-content:space-between;";

    // Language Dropdown
    const select = document.createElement('select');
    select.innerHTML = `
        <option value="en">🇬🇧 English</option>
        <option value="ta">🇮🇳 Tamil</option>
        <option value="hi">🇮🇳 Hindi</option>
        <option value="fr">🇫🇷 French</option>
        <option value="es">🇪🇸 Spanish</option>
        <option value="de">🇩🇪 German</option>
    `;
    select.value = currentLang;
    select.style.cssText = "background:#333; color:white; border:1px solid #555; padding:5px; border-radius:4px; font-size:12px; flex-grow:1;";
    select.onchange = () => { currentLang = select.value; };

    // Mic Button
    const micBtn = document.createElement('button');
    micBtn.innerHTML = "🎤";
    micBtn.style.cssText = "background:#ff4500; color:white; border:none; padding:6px 10px; border-radius:50%; cursor:pointer;";
    micBtn.title = "Speak Command";
    micBtn.onmousedown = (e) => { e.preventDefault(); startListening(text); };

    rowTools.appendChild(select);
    rowTools.appendChild(micBtn);

    div.appendChild(rowBtns);
    div.appendChild(rowTools);
    document.body.appendChild(div);
}

function createBtn(label, color) {
    const btn = document.createElement('button');
    btn.innerText = label;
    btn.style.cssText = `background: ${color}; color: white; border: none; padding: 6px 10px; cursor: pointer; border-radius: 4px; font-weight: bold; font-size: 12px; flex: 1;`;
    return btn;
}

// ==========================================
// 5. FEATURE: VOICE RECOGNITION (Mic)
// ==========================================
function startListening(text) {
    // Check browser compatibility
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        showPopup("Error", "Browser does not support Voice.");
        return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US'; // Commands are in English
    
    showPopup("🎤 Listening...", "Say 'Simplify' or 'Explain'...");

    recognition.onresult = (event) => {
        const command = event.results[0][0].transcript.toLowerCase();
        console.log("Heard:", command);
        
        if (command.includes("simplify") || command.includes("simple")) {
            handleSimplification(text);
        } else if (command.includes("explain") || command.includes("meaning") || command.includes("what is")) {
            handleExplanation(text);
        } else {
            showPopup("😕 Not understood", "Try saying 'Simplify' or 'Explain'.");
        }
    };
    recognition.start();
}

// ==========================================
// 6. FEATURE: SIMPLIFICATION (Dashboard)
// ==========================================
async function handleSimplification(text) {
    showPopup("Thinking...", "AI is simplifying...");
    
    try {
        const response = await fetch(`${BASE_URL}/simplify`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: text, target_lang: currentLang })
        });
        const data = await response.json();
        
        if(data.simplified) {
            // Build Analytics Dashboard HTML
            const reduction = data.metrics ? data.metrics.reduction : 0;
            const improvement = reduction > 0 ? `${reduction}% Easier` : "Optimized";
            
            const dashboardHTML = `
                <div class="metric-container">
                    <div class="metric-box">
                        <div class="metric-label">Original</div>
                        <div class="metric-value" style="color:#ff6b6b">Grade ${data.metrics.original_grade}</div>
                        <div class="grade-bar"><div class="grade-fill" style="width: 100%; background:#ff6b6b"></div></div>
                    </div>
                    <div class="metric-box">
                        <div class="metric-label">AI Simplified</div>
                        <div class="metric-value" style="color:#4CAF50">Grade ${data.metrics.new_grade}</div>
                        <div class="grade-bar"><div class="grade-fill safe" style="width: ${100 - reduction}%"></div></div>
                    </div>
                </div>
                <div style="text-align:center; color:#888; font-size:12px; margin-bottom:10px;">
                    ✨ Result: <strong>${improvement}</strong>
                </div>
                <div style="font-size:16px; line-height:1.6; color: #222;">${data.simplified}</div>
            `;
            
            showPopup("Smart Simplification", dashboardHTML);
            speak(data.simplified, currentLang);
        }
    } catch (error) { 
        console.error(error);
        showPopup("Error", "Server error. Check URL."); 
    }
}

// ==========================================
// 7. FEATURE: EXPLANATION (AI Tutor)
// ==========================================
async function handleExplanation(text) {
    showPopup("AI Tutor", `Generating explanation in ${currentLang.toUpperCase()}...`);
    
    try {
        const response = await fetch(`${BASE_URL}/explain`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: text, target_lang: currentLang })
        });
        const data = await response.json();

        if(data.explanation) {
            showPopup("AI Tutor Says:", `
                <div style="font-size:16px; color:#333; margin-bottom:10px; line-height:1.5;">
                    ${data.explanation}
                </div>
                <div style="font-size:12px; color:#666; font-style:italic;">(🔊 Speaking in ${currentLang}...)</div>
            `);
            speak(data.explanation, currentLang);
        }
    } catch (error) { showPopup("Error", "Could not explain."); }
}

// ==========================================
// 8. FEATURE: DICTIONARY
// ==========================================
async function handleDefinition(word) {
    try {
        const response = await fetch(`${BASE_URL}/define/${word}`);
        const data = await response.json();
        
        showPopup("Dictionary", `
            <div style="font-size:18px; margin-bottom:5px; color: #4CAF50;">
                <strong>${data.word}</strong>
            </div>
            <div style="color:#333; font-size: 14px; line-height: 1.4;">${data.definition}</div>
        `);
    } catch (error) { console.log("Dictionary failed"); }
}

// ==========================================
// 9. HELPER FUNCTIONS (Popup & TTS)
// ==========================================
function showPopup(title, content) {
    const old = document.getElementById('ai-popup'); if (old) old.remove();
    const menu = document.getElementById('ai-action-menu'); if (menu) menu.remove(); 

    const div = document.createElement('div');
    div.id = 'ai-popup';
    div.innerHTML = `
        <div style="background:#333; color:white; padding:10px; font-weight:bold; border-radius:5px 5px 0 0;">${title}</div>
        <div style="padding:15px; background:white; color:black; border:1px solid #ddd; max-height: 300px; overflow-y: auto;">
            ${content}
        </div>
        <button onclick="this.parentElement.remove()" style="width:100%; padding:8px; background:#444; color:white; border:none; cursor:pointer;">Close</button>
    `;
    div.style.cssText = "position:fixed; bottom:20px; right:20px; width:340px; z-index:2147483647; box-shadow:0 5px 15px rgba(0,0,0,0.3); font-family:sans-serif; background:white; border-radius: 8px; overflow:hidden;";
    document.body.appendChild(div);
}

function speak(text, lang = "en") {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Map short codes to full locale codes for better TTS support
    const langMap = {
        'en': 'en-US',
        'ta': 'ta-IN',
        'hi': 'hi-IN',
        'fr': 'fr-FR',
        'es': 'es-ES',
        'de': 'de-DE'
    };
    
    utterance.lang = langMap[lang] || 'en-US';
    utterance.rate = 0.9; 
    window.speechSynthesis.speak(utterance);
}