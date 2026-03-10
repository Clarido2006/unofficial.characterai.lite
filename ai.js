// ============================================================
// ai.js — Character.ai Lite [UNOFFICIAL]
// WebLLM — runs 100% in the browser via WebGPU.
// No server, no API key, no Ollama needed.
//
// How it works:
//  1. webllm-init.js (ES module) loads @mlc-ai/web-llm from CDN
//     and sets window._webllm when ready.
//  2. First chat call triggers engine creation (model download +
//     cache, ~1-3 GB, one-time).
//  3. Engine is reused for all subsequent calls.
//
// Requires: Chrome 113+ / Edge 113+ / Safari 18+ (WebGPU).
// ============================================================

var CAI = CAI || {};

CAI.isAITyping      = false;
CAI._webllmEngine   = null;
CAI._webllmModel    = null;
CAI._webllmLoading  = false;

// ---- Available models (shown in Settings dropdown) ----
// Hermes models (by Nous Research) are the least censored models
// natively prebuilt in WebLLM — designed for roleplay and open chat.
CAI.WEBLLM_MODELS = [
    // -- Hermes (uncensored-friendly, roleplay-tuned) --
    { id: 'Hermes-3-Llama-3.1-8B-q4f16_1-MLC',       label: 'Hermes 3 Llama 3.1 8B  — BEST: smart + open (~4.5 GB)' },
    { id: 'Hermes-2-Theta-Llama-3-8B-q4f16_1-MLC',   label: 'Hermes 2 Theta 8B       — Great roleplay (~4.5 GB)' },
    { id: 'Hermes-2-Pro-Llama-3-8B-q4f16_1-MLC',     label: 'Hermes 2 Pro Llama 3 8B — Solid, open (~4.5 GB)' },
    { id: 'Hermes-2-Pro-Mistral-7B-q4f16_1-MLC',     label: 'Hermes 2 Pro Mistral 7B — Open, fast (~4.5 GB)' },
    { id: 'OpenHermes-2.5-Mistral-7B-q4f16_1-MLC',   label: 'OpenHermes 2.5 Mistral  — Lightweight open (~4.5 GB)' },
    { id: 'NeuralHermes-2.5-Mistral-7B-q4f16_1-MLC', label: 'NeuralHermes 2.5        — Alternative open (~4.5 GB)' },
    // -- Standard / filtered --
    { id: 'Llama-3.2-3B-Instruct-q4f16_1-MLC',       label: 'Llama 3.2 3B Instruct   — Small, faster (~2 GB)' },
    { id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC',       label: 'Llama 3.2 1B Instruct   — Smallest (~1 GB)' },
    { id: 'Phi-3.5-mini-instruct-q4f16_1-MLC',       label: 'Phi 3.5 Mini             — Compact quality (~2.4 GB)' },
    { id: 'Mistral-7B-Instruct-v0.3-q4f16_1-MLC',    label: 'Mistral 7B Instruct      — Large GPU (~4.5 GB)' },
];

// ---- Strip role prefixes the model might leak ----
function stripRolePrefix(text, charName) {
    if (!text) return text;
    var patterns = [
        new RegExp('^\\[?' + charName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\]?\\s*[:\\-]\\s*', 'i'),
        /^\[?(AI|Assistant|Bot|Character|You)\]?\s*[:\-]\s*/i,
        /^\[.*?\]\s*/
    ];
    for (var i = 0; i < patterns.length; i++) text = text.replace(patterns[i], '');
    return text.replace(/^\s+|\s+$/g, '');
}

// ---- WebLLM loading overlay helpers ----
function showWebLLMLoading(text, progress) {
    var ov  = document.getElementById('webllm-load-overlay');
    var msg = document.getElementById('webllm-load-msg');
    var bar = document.getElementById('webllm-load-bar');
    if (!ov) return;
    ov.style.display = 'flex';
    if (msg) {
        while (msg.firstChild) msg.removeChild(msg.firstChild);
        msg.appendChild(document.createTextNode(text || 'Loading model...'));
    }
    if (bar && progress !== undefined)
        bar.style.width = Math.round((progress || 0) * 100) + '%';
}
function hideWebLLMLoading() {
    var ov = document.getElementById('webllm-load-overlay');
    if (ov) ov.style.display = 'none';
}

// ---- Get or create the WebLLM engine ----
// Caches engine for current model. Re-creates if model changes.
CAI.getWebLLMEngine = function(model, onProgress, cb) {
    // Reuse cached engine
    if (CAI._webllmEngine && CAI._webllmModel === model) {
        cb(null, CAI._webllmEngine); return;
    }
    // If already loading, poll and retry
    if (CAI._webllmLoading) {
        var poll = setInterval(function() {
            if (!CAI._webllmLoading) {
                clearInterval(poll);
                CAI.getWebLLMEngine(model, onProgress, cb);
            }
        }, 500);
        return;
    }
    // WebGPU check
    if (!navigator.gpu) {
        cb('WebGPU is not supported.\nUse Chrome 113+, Edge 113+, or Safari 18+.'); return;
    }
    var wllm = window._webllm;
    if (!wllm) {
        cb('WebLLM library not loaded yet. Wait a moment and try again.'); return;
    }

    CAI._webllmLoading = true;
    CAI._webllmEngine  = null;

    wllm.CreateMLCEngine(model, {
        initProgressCallback: function(report) {
            if (onProgress) onProgress(report.text || '', report.progress || 0);
        }
    }).then(function(engine) {
        CAI._webllmEngine  = engine;
        CAI._webllmModel   = model;
        CAI._webllmLoading = false;
        cb(null, engine);
    }).catch(function(err) {
        CAI._webllmLoading = false;
        cb('Model load failed: ' + (err && err.message ? err.message : String(err)));
    });
};

// ---- Main AI call (same signature as before) ----
CAI.callAI = function(char, user, userText, storageKey, history, onDone) {
    CAI.isAITyping = true;
    CAI.UI.setAIStatus('AI: Loading...', '#CC6600');
    CAI.UI.setStatus(char.name + ' is typing...');

    var settings = CAI.ollamaSettings.load();

    var sysPrompt =
        'You are ' + char.name + '. ' +
        'Personality and background: ' + (char.desc || 'No description provided.') + '\n\n' +
        'STRICT OUTPUT FORMAT — violating any rule ruins the roleplay:\n' +
        '1. Output ONLY your spoken words or actions. Nothing else.\n' +
        '2. NEVER start your reply with any name, label, or bracket. BAD: "' + char.name + ': hello" — GOOD: "hello"\n' +
        '3. NEVER write the user\'s name as a label.\n' +
        '4. NEVER use [brackets], (parens), or "Name:" to describe who is speaking.\n' +
        '5. Use *asterisks* ONLY for physical actions, e.g. *smiles*. Never for annotations.\n' +
        '6. Do NOT narrate. Do NOT write "I respond:" or "I say:" or "CHARACTER says:".\n' +
        '7. You are speaking directly to ' + user.name + ' (' + (user.desc || 'your conversation partner') + ').\n' +
        '8. Keep replies in character, natural, and concise.';

    var messages = [{ role: 'system', content: sysPrompt }];
    var ctx = (history || []).slice(-12);
    for (var i = 0; i < ctx.length; i++) {
        messages.push({ role: ctx[i].role === 'user' ? 'user' : 'assistant', content: ctx[i].text || '' });
    }
    messages.push({ role: 'user', content: userText });

    // Typing indicator
    var box = document.getElementById('chat-history');
    var tid = 'typing-ind-' + storageKey;
    if (box) {
        var td = document.createElement('div'); td.className = 'typing-indicator'; td.id = tid;
        td.appendChild(document.createTextNode(char.name + ' is typing...'));
        box.appendChild(td); box.scrollTop = box.scrollHeight;
    }
    function removeTyping() { var t = document.getElementById(tid); if (t && t.parentNode) t.parentNode.removeChild(t); }

    function finish(reply) {
        removeTyping(); hideWebLLMLoading();
        if (!reply) reply = '[No response — is the model loaded? Check Settings > AI.]';
        reply = stripRolePrefix(reply, char.name);
        var msg = { sender: char, text: reply, role: 'ai', ts: Date.now() };
        var newHistory = (history || []).concat([msg]);
        CAI.saveChat(storageKey, newHistory);
        var b = document.getElementById('chat-history');
        if (b) CAI.UI.drawMsg(msg, b);
        CAI.isAITyping = false;
        CAI.UI.setAIStatus('AI: Ready', '#006600');
        CAI.UI.setStatus('Ready');
        if (onDone) onDone();
    }

    CAI.getWebLLMEngine(settings.model, function(text, progress) {
        showWebLLMLoading(text, progress);
        CAI.UI.setAIStatus('AI: Loading ' + Math.round((progress || 0) * 100) + '%', '#CC6600');
    }, function(err, engine) {
        hideWebLLMLoading();
        if (err) {
            removeTyping();
            CAI.isAITyping = false;
            CAI.UI.setAIStatus('AI: Error', '#CC0000');
            CAI.UI.setStatus('Error: ' + err);
            if (onDone) onDone();
            return;
        }
        CAI.UI.setAIStatus('AI: Thinking...', '#CC6600');
        engine.chat.completions.create({
            messages:    messages,
            stream:      false,
            temperature: 0.85,
            max_tokens:  220
        }).then(function(resp) {
            var content = resp.choices && resp.choices[0] &&
                          resp.choices[0].message && resp.choices[0].message.content;
            finish(content || null);
        }).catch(function(e) {
            CAI.UI.setAIStatus('AI: Error', '#CC0000');
            finish(null);
        });
    });
};

// ---- GC bot system prompt ----
CAI.buildGCBotSystem = function(bot, topic, otherBots) {
    return 'You are ' + bot.name + '. ' + (bot.desc || '') + '\n\n' +
        'STRICT OUTPUT FORMAT:\n' +
        '1. Output ONLY your spoken words or actions. Nothing else.\n' +
        '2. NEVER prefix your reply with your name or any label. BAD: "' + bot.name + ': hi" — GOOD: "hi"\n' +
        '3. NEVER use [brackets], (parens), or "Name:" annotations.\n' +
        '4. Use *asterisks* ONLY for physical actions, e.g. *nods*.\n' +
        '5. Do NOT narrate. No "I say:" or "I respond:" or "[Scene:]".\n' +
        '6. You are in a group chat.' + (topic ? ' Topic: ' + topic : '') + '\n' +
        '7. Other participants: ' + (otherBots && otherBots.length ? otherBots.join(', ') : 'other characters') + '.\n' +
        '8. Reply naturally, stay in character, keep it concise.';
};

// ---- Fetch available models (returns static list for Settings UI) ----
CAI.fetchModels = function(onResult) {
    onResult(null, CAI.WEBLLM_MODELS.map(function(m) { return m.id; }));
};

// ---- Check WebGPU support (replaces testOllama, same signature) ----
CAI.testOllama = function(model, onResult) {
    if (!navigator.gpu) {
        onResult('WebGPU not supported. Use Chrome 113+, Edge 113+, or Safari 18+.');
        return;
    }
    var wllm = window._webllm;
    if (!wllm) { onResult('WebLLM library loading... try again in a moment.'); return; }
    // Check if already loaded
    if (CAI._webllmEngine && CAI._webllmModel === model) {
        onResult(null, 'Model "' + model + '" is loaded and ready!');
        return;
    }
    onResult(null, 'WebGPU available. Press "Load Model" to download and cache the model.');
};

// ---- Preload model from Settings page ----
CAI.loadWebLLMModel = function(model, onProgress, onDone) {
    CAI.getWebLLMEngine(model, onProgress, function(err, engine) {
        if (err) onDone(err);
        else     onDone(null, 'Model ready: ' + model);
    });
};
