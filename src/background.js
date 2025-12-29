// background.js

chrome.runtime.onConnect.addListener((port) => {
    if (port.name === "enhance-stream") {
        port.onMessage.addListener(async (msg) => {
            if (msg.action === "enhance") {
                try {
                    await enhanceWithStreaming(msg.prompt, port);
                } catch (error) {
                    port.postMessage({ type: "error", message: error.message });
                }
            }
        });
    }
});

// Legacy support for one-shot messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "enhancePrompt") {
        (async () => {
            try {
                const result = await enhanceWithStreaming(request.prompt, null);
                sendResponse({ success: true, enhanced: result });
            } catch (error) {
                sendResponse({ success: false, error: error.message });
            }
        })();
        return true;
    }
});

async function enhanceWithStreaming(originalPrompt, port) {
    try {
        console.log("Step 1: Saving prompt...");
        const saveRes = await fetch("https://www.promptcowboy.ai/api/prompts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: 'include',
            body: JSON.stringify({
                description: originalPrompt,
                config: { mode: "standard", framework: "stoke" },
                promptType: "standard"
            })
        });

        if (saveRes.status === 401) throw new Error("AUTH_REQUIRED");
        if (!saveRes.ok) throw new Error(`Save failed: ${saveRes.status}`);
        const saveData = await saveRes.json();
        const promptId = saveData.id || (saveData.prompt && saveData.prompt.id) || (saveData.data && saveData.data.id);

        console.log("Prompt ID:", promptId);

        let initialEnhanced = saveData.initial_prompt || (saveData.prompt && saveData.prompt.initial_prompt);
        if (initialEnhanced && initialEnhanced.trim() !== originalPrompt.trim()) {
            if (port) port.postMessage({ type: "delta", text: initialEnhanced });
            return initialEnhanced;
        }

        if (!promptId) throw new Error("Could not obtain Prompt ID");

        console.log("Step 2: Streaming...");
        let enhanceRes = await fetch("https://www.promptcowboy.ai/api/prompt/initialPrompt", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: 'include',
            body: JSON.stringify({
                id: `initial-${promptId}`,
                messages: [{
                    role: "user",
                    content: JSON.stringify({ promptId: promptId, description: originalPrompt })
                }],
                config: { mode: "standard", framework: "stoke" }
            })
        });

        if (!enhanceRes.ok && enhanceRes.status === 400) {
            enhanceRes = await fetch("https://www.promptcowboy.ai/api/prompt/initialPrompt", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: 'include',
                body: JSON.stringify({
                    id: promptId,
                    messages: [{
                        role: "user",
                        content: JSON.stringify({ promptId: promptId, description: originalPrompt })
                    }],
                    config: { mode: "standard", framework: "stoke" }
                })
            });
        }

        if (enhanceRes.status === 401) throw new Error("AUTH_REQUIRED");
        if (!enhanceRes.ok) return await fetchStoredPrompt(promptId, originalPrompt, port);

        const reader = enhanceRes.body.getReader();
        const decoder = new TextDecoder();
        let streamText = "";
        let buffer = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop();

            for (const line of lines) {
                if (line.trim() === "" || !line.includes(':')) continue;
                const type = line.substring(0, line.indexOf(':')).trim();
                const content = line.substring(line.indexOf(':') + 1).trim();

                if (type === '0' || type === 'text') {
                    let chunk = content;
                    try { if (content.startsWith('"')) chunk = JSON.parse(content); } catch (e) { }

                    streamText += chunk;
                    if (port) port.postMessage({ type: "delta", text: streamText });
                }
            }
        }

        const final = streamText.trim().replace(/\\n/g, "\n").replace(/\\"/g, '"');
        if (final && final !== originalPrompt) {
            if (port) port.postMessage({ type: "complete", text: final });
            return final;
        }

        return await fetchStoredPrompt(promptId, originalPrompt, port);

    } catch (e) {
        console.error("Cowboy Error:", e);
        if (port) port.postMessage({ type: "error", message: e.message });
        throw e;
    }
}

async function fetchStoredPrompt(promptId, originalPrompt, port) {
    const res = await fetch(`https://www.promptcowboy.ai/api/prompts/${promptId}`, { credentials: 'include' });
    if (res.status === 401) throw new Error("AUTH_REQUIRED");
    if (res.ok) {
        const data = await res.json();
        const p = data.prompt || data;
        const text = p.initial_prompt || p.description;
        if (text && text.trim() !== originalPrompt.trim()) {
            if (port) {
                port.postMessage({ type: "delta", text: text });
                port.postMessage({ type: "complete", text: text });
            }
            return text;
        }
    }
    throw new Error("Enhancement failed");
}
