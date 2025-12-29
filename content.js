// content.js
console.log("%c >>> PROMPT ENHANCER LOADING... <<< ", "background: #222; color: #bada55; font-size: 20px");

let isEnhancing = false;
let currentMode = 'manual';
let lastOriginalText = "";
let currentInjectedText = "";
let lastEnhancedElement = null;
let currentPort = null; // Track active port for aborting

// Throttling variables
let lastUpdate = 0;
let pendingUpdate = null;
const THROTTLE_MS = 100;

const SITE_CONFIG = {
    "chatgpt.com": {
        inputSelector: "#prompt-textarea",
        submitSelector: "button[data-testid='send-button'], [data-testid='composer-send-button']"
    },
    "claude.ai": {
        inputSelector: "div[contenteditable='true'], .ProseMirror, fieldset div[contenteditable='true']",
        submitSelector: "button[aria-label*='Send'], button:has(svg), [data-testid='send-button']"
    },
    "gemini.google.com": {
        inputSelector: ".ql-editor, [contenteditable='true']",
        submitSelector: "button[aria-label*='Send message'], .send-button"
    },
    "notebooklm.google.com": {
        inputSelector: "textarea[placeholder*='Ask'], .chat-input textarea, textarea",
        submitSelector: "button[aria-label='Send']"
    }
};

// Initialize Settings
const siteKey = `enhancerMode_${window.location.hostname}`;
chrome.storage.local.get([siteKey, 'enhancerMode'], (result) => {
    // Priority: Site-specific mode -> Global legacy mode -> default ('manual')
    if (result[siteKey]) {
        currentMode = result[siteKey];
    } else if (result.enhancerMode) {
        currentMode = result.enhancerMode;
    }
    console.log(`Loaded mode for ${window.location.hostname}:`, currentMode);
    injectUI();
});

function getSiteConfig() {
    const host = window.location.hostname;
    for (const key in SITE_CONFIG) {
        if (host.includes(key)) return SITE_CONFIG[key];
    }
    return {
        inputSelector: "textarea, [contenteditable='true']",
        submitSelector: "button[type='submit']"
    };
}

function injectUI() {
    if (document.getElementById('cowboy-controls')) return;

    const container = document.createElement('div');
    container.id = 'cowboy-controls';
    container.innerHTML = `
        <style>
            #cowboy-controls {
                position: fixed;
                bottom: 20px;
                right: 20px;
                z-index: 9999;
                display: flex;
                flex-direction: column;
                align-items: flex-end;
                gap: 10px;
                font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            }
            .cowboy-row {
                background: rgba(255, 255, 255, 0.15);
                backdrop-filter: blur(12px);
                -webkit-backdrop-filter: blur(12px);
                border: 1px solid rgba(255, 255, 255, 0.2);
                border-radius: 12px;
                padding: 4px;
                display: flex;
                box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.3);
            }
            .cowboy-btn {
                position: relative;
                padding: 6px 12px;
                border-radius: 8px;
                border: none;
                background: transparent;
                color: #fff;
                cursor: pointer;
                font-size: 11px;
                font-weight: 500;
                transition: all 0.2s;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            .cowboy-btn::after {
                content: attr(data-tooltip);
                position: absolute;
                bottom: 120%;
                left: 50%;
                transform: translateX(-50%) translateY(10px);
                background: rgba(0, 0, 0, 0.85);
                backdrop-filter: blur(4px);
                color: white;
                padding: 6px 10px;
                border-radius: 6px;
                font-size: 11px;
                white-space: nowrap;
                opacity: 0;
                visibility: hidden;
                transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                pointer-events: none;
                box-shadow: 0 4px 12px rgba(0,0,0,0.5);
                border: 1px solid rgba(255,255,255,0.1);
            }
            .cowboy-btn:hover::after {
                opacity: 1;
                visibility: visible;
                transform: translateX(-50%) translateY(0);
            }
            .cowboy-btn.active {
                background: rgba(255, 255, 255, 0.25);
                box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            }
            .cowboy-btn:hover:not(.active) {
                background: rgba(255, 255, 255, 0.1);
            }
            #cowboy-revert {
                display: none;
                background: #ff4757;
                color: white;
                border-radius: 10px;
                padding: 8px 16px;
                font-weight: bold;
                animation: cowboy-pop 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                box-shadow: 0 4px 15px rgba(255, 71, 87, 0.4);
            }
            @keyframes cowboy-pop {
                from { opacity: 0; transform: scale(0.8) translateY(10px); }
                to { opacity: 1; transform: scale(1) translateY(0); }
            }
        </style>
        <button id="cowboy-revert" class="cowboy-btn">↩ Undo Enhancement</button>
        <div class="cowboy-row">
            <button class="cowboy-btn ${currentMode === 'auto' ? 'active' : ''}" data-mode="auto" data-tooltip="שיפור ושליחה אוטומטית">Auto</button>
            <button class="cowboy-btn ${currentMode === 'manual' ? 'active' : ''}" data-mode="manual" data-tooltip="שיפור והמתנה לבדיקה">Manual</button>
            <button class="cowboy-btn ${currentMode === 'off' ? 'active' : ''}" data-mode="off" data-tooltip="כיבוי זמני של התוסף">Off</button>
        </div>
    `;
    document.body.appendChild(container);

    container.addEventListener('click', (e) => {
        const mode = e.target.dataset.mode;
        if (mode) {
            currentMode = mode;
            const siteKey = `enhancerMode_${window.location.hostname}`;
            chrome.storage.local.set({ [siteKey]: mode });
            container.querySelectorAll('[data-mode]').forEach(btn => btn.classList.toggle('active', btn.dataset.mode === mode));
            console.log(`Mode switched to ${mode} for ${window.location.hostname}`);
        }

        if (e.target.id === 'cowboy-revert') {
            handleRevertClick();
        }
    });
}

function handleRevertClick() {
    if (isEnhancing && currentPort) {
        console.log("Aborting enhancement mid-stream...");
        currentPort.disconnect();
        currentPort = null;
    }
    revertToOriginal();
}

function revertToOriginal() {
    isEnhancing = false;
    const input = lastEnhancedElement;
    if (input && lastOriginalText !== null) {
        currentInjectedText = "";
        updateInput(input, lastOriginalText, true);
        delete input.dataset.isEnhanced;
        input.style.border = "";
        input.style.opacity = "1";
        document.getElementById('cowboy-revert').style.display = 'none';
        console.log("Reverted to original text.");
    }
}

async function handleEnhancement(inputElement, originalText) {
    if (currentMode === 'off') return;

    console.log("Interceptor triggered. Mode:", currentMode);
    if (isEnhancing) return;
    isEnhancing = true;
    lastOriginalText = originalText;
    currentInjectedText = "";
    lastEnhancedElement = inputElement;

    // Show STOP button immediately
    const revertBtn = document.getElementById('cowboy-revert');
    revertBtn.innerText = "⏹ Stop & Revert";
    revertBtn.style.display = 'block';

    inputElement.style.border = "2px solid #ff9100";
    inputElement.style.opacity = "0.7";

    currentPort = chrome.runtime.connect({ name: "enhance-stream" });
    currentPort.postMessage({ action: "enhance", prompt: originalText });

    lastUpdate = 0;

    currentPort.onMessage.addListener((msg) => {
        if (msg.type === "delta") {
            const now = Date.now();
            if (now - lastUpdate > THROTTLE_MS) {
                updateInput(inputElement, msg.text, false);
                lastUpdate = now;
                if (pendingUpdate) clearTimeout(pendingUpdate);
                pendingUpdate = null;
            } else {
                if (pendingUpdate) clearTimeout(pendingUpdate);
                pendingUpdate = setTimeout(() => {
                    updateInput(inputElement, msg.text, false);
                    lastUpdate = Date.now();
                    pendingUpdate = null;
                }, THROTTLE_MS);
            }
        } else if (msg.type === "complete") {
            if (pendingUpdate) clearTimeout(pendingUpdate);
            updateInput(inputElement, msg.text, true);
            currentPort = null;
            finishEnhancement(inputElement);
        } else if (msg.type === "error") {
            if (pendingUpdate) clearTimeout(pendingUpdate);
            if (msg.message === "AUTH_REQUIRED") {
                if (confirm("אתה מנותק מ-PromptCowboy. האם תרצה לעבור לדף ההתחברות?")) {
                    window.open("https://www.promptcowboy.ai/login", "_blank");
                }
            } else {
                console.error("Enhancement error:", msg.message);
            }
            currentInjectedText = "";
            updateInput(inputElement, originalText, true);
            currentPort = null;
            finishEnhancement(inputElement);
        }
    });

    currentPort.onDisconnect.addListener(() => {
        if (isEnhancing) {
            isEnhancing = false;
            currentPort = null;
            inputElement.style.opacity = "1";
            inputElement.style.border = "";
        }
    });
}

function finishEnhancement(inputElement) {
    inputElement.style.opacity = "1";
    isEnhancing = false;

    const revertBtn = document.getElementById('cowboy-revert');
    revertBtn.innerText = "↩ Undo Enhancement";

    if (currentMode === 'auto') {
        inputElement.style.border = "";
        revertBtn.style.display = 'none';
        console.log("Auto-sending...");
        setTimeout(() => triggerSubmit(), 100);
    } else {
        inputElement.style.border = "2px solid #4CAF50";
        inputElement.dataset.isEnhanced = "true";
        revertBtn.style.display = 'block';
        console.log("Waiting for manual review.");

        setTimeout(() => {
            if (inputElement.style.borderColor === "rgb(76, 175, 80)") {
                inputElement.style.border = "";
            }
        }, 5000);
    }
}

function updateInput(inputElement, fullText, isFinal) {
    if (!inputElement) return;

    if (inputElement.tagName === "TEXTAREA" || inputElement.tagName === "INPUT") {
        if (inputElement.value === fullText) return;

        const descriptor = Object.getOwnPropertyDescriptor(
            inputElement.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype,
            "value"
        );
        const nativeValueSetter = descriptor ? descriptor.set : null;

        if (nativeValueSetter) {
            nativeValueSetter.call(inputElement, fullText);
        } else {
            inputElement.value = fullText;
        }
    } else {
        if (fullText.startsWith(currentInjectedText) && currentInjectedText.length > 0 && !isFinal) {
            const delta = fullText.substring(currentInjectedText.length);
            if (delta.length > 0) {
                try {
                    const selection = window.getSelection();
                    const range = document.createRange();
                    range.selectNodeContents(inputElement);
                    range.collapse(false);
                    selection.removeAllRanges();
                    selection.addRange(range);

                    document.execCommand('insertText', false, delta);
                    currentInjectedText = fullText;
                } catch (e) {
                    replaceFullText(inputElement, fullText);
                }
            }
        } else {
            replaceFullText(inputElement, fullText);
        }
    }

    ['input', 'change', 'compositionend'].forEach(type => {
        inputElement.dispatchEvent(new Event(type, { bubbles: true }));
    });

    const host = window.location.hostname;
    if (isFinal) {
        if (host.includes("gemini.google.com") || host.includes("chatgpt.com") || host.includes("notebooklm.google.com")) {
            setTimeout(() => {
                inputElement.blur();
                inputElement.focus();
                const inputEvent = new InputEvent('input', { bubbles: true, inputType: 'insertText', data: ' ' });
                inputElement.dispatchEvent(inputEvent);
                const deleteEvent = new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward' });
                inputElement.dispatchEvent(deleteEvent);

                inputElement.dispatchEvent(new Event('change', { bubbles: true }));
            }, 10);
        }
    }
}

function replaceFullText(inputElement, text) {
    try {
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(inputElement);
        selection.removeAllRanges();
        selection.addRange(range);

        document.execCommand('delete', false);
        document.execCommand('insertText', false, text);

        if (inputElement.innerText.trim().length < text.length * 0.5) {
            inputElement.innerText = text;
        }
        currentInjectedText = text;
    } catch (e) {
        inputElement.innerText = text;
        currentInjectedText = text;
    }
}

function triggerSubmit() {
    const config = getSiteConfig();
    const btn = document.querySelector(config.submitSelector);
    if (btn) {
        btn.disabled = false;
        btn.click();
    }
}

// Event Listeners
document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !isEnhancing && e.isTrusted) {
        if (currentMode === 'off') return;

        const config = getSiteConfig();
        let input = document.activeElement;
        const targetInput = (input && (input.matches(config.inputSelector) || input.closest(config.inputSelector))) ?
            (input.closest(config.inputSelector) || input) : null;

        if (targetInput) {
            if (targetInput.dataset.isEnhanced === "true") {
                delete targetInput.dataset.isEnhanced;
                document.getElementById('cowboy-revert').style.display = 'none';
                return;
            }

            const text = targetInput.value || targetInput.innerText;
            if (text.trim().length > 0) {
                e.preventDefault();
                e.stopImmediatePropagation();
                handleEnhancement(targetInput, text);
            }
        }
    }
}, true);

document.addEventListener("click", (e) => {
    if (isEnhancing || !e.isTrusted || currentMode === 'off') return;
    const config = getSiteConfig();
    const btn = e.target.closest(config.submitSelector);

    if (btn) {
        const input = document.querySelector(config.inputSelector);
        if (input) {
            if (input.dataset.isEnhanced === "true") {
                delete input.dataset.isEnhanced;
                document.getElementById('cowboy-revert').style.display = 'none';
                return;
            }

            const text = input.value || input.innerText;
            if (text.trim().length > 0) {
                e.preventDefault();
                e.stopImmediatePropagation();
                handleEnhancement(input, text);
            }
        }
    }
}, true);
