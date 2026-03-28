// ============================================================
// ai.js — AiCharacters lite & ChatHangout!
// Backend: Puter.ai (puter.js v2) — no API key required.
// Users sign in with their own Puter account (User-Pays model).
// ============================================================

var CAI = CAI || {};

CAI.isAITyping = false;

// ---- Available Puter models (open-source / creative-friendly) ----
CAI.PUTER_MODELS = [
    { id: 'meta-llama/llama-3.1-8b-instruct',  label: 'Llama 3.3 70B (Meta)'       },
    { id: 'meta-llama/llama-3.1-8b-instruct',   label: 'Llama 3.1 8B (Meta, fast)'  },
    { id: 'mistralai/mistral-7b-instruct',       label: 'Mistral 7B (fast)'           },
    { id: 'mistralai/mixtral-8x7b-instruct',     label: 'Mixtral 8x7B'                },
    { id: 'qwen/qwen3-30b-a3b',                 label: 'Qwen3 30B'                   },
    { id: 'qwen/qwen3-235b-a22b',               label: 'Qwen3 235B (large)'          },
    { id: 'google/gemini-2.5-flash',             label: 'Gemini 2.5 Flash (Google)'  },
    { id: 'gpt-4o-mini',                        label: 'GPT-4o Mini (OpenAI)'        },
    { id: 'gpt-4o',                             label: 'GPT-4o (OpenAI)'             }
];

// ---- Strip "CharacterName: " or "[label]:" prefix the model leaks ----
function stripRolePrefix(text, charName) {
    if (!text) return text;
    var patterns = [
        new RegExp('^\\[?' + charName.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + '\\]?\\s*[:\\-]\\s*','i'),
        /^\[?(AI|Assistant|Bot|Character|You)\]?\s*[:\-]\s*/i,
        /^\[.*?\]\s*/
    ];
    for (var i = 0; i < patterns.length; i++) text = text.replace(patterns[i], '');
    return text.replace(/^\s+|\s+$/g, '');
}

// ---- Normalise different model response shapes into a plain string ----
function extractText(response) {
    if (!response) return null;
    if (typeof response === 'string') return response;
    if (response.message) {
        var c = response.message.content;
        if (typeof c === 'string') return c;
        if (Array.isArray(c) && c.length && c[0].text) return c[0].text;
    }
    return String(response);
}

function puterReady() {
    return typeof window.puter !== 'undefined' && window.puter.ai && typeof window.puter.ai.chat === 'function';
}

// ---- Main chat call (streaming) ----
CAI.callAI = function(char, user, userText, storageKey, history, onDone) {
    CAI.isAITyping = true;
    var model = CAI.puterSettings.load().model;
    CAI.UI.setAIStatus('AI: Thinking...', '#CC6600');
    CAI.UI.setStatus(char.name + ' is typing...');

    if (!puterReady()) {
        CAI.UI.setAIStatus('AI: puter.js not loaded', '#CC0000');
        CAI.isAITyping = false;
        if (onDone) onDone();
        return;
    }

    var sysPrompt =
        'You are ' + char.name + '. ' +
        'Personality and background: ' + (char.desc || 'No description provided.') + '\n\n' +
        'STRICT OUTPUT FORMAT:\n' +
        '1. Output ONLY your spoken words or actions. Nothing else.\n' +
        '2. NEVER start with any name, label, or bracket. BAD: "' + char.name + ': hello" GOOD: "hello"\n' +
        '3. Use *asterisks* ONLY for physical actions, e.g. *smiles*.\n' +
        '4. Do NOT narrate. No "I say:" or "CHARACTER says:".\n' +
        '5. You are speaking directly to ' + user.name + ' (' + (user.desc || 'your conversation partner') + ').\n' +
        '6. Keep replies in character, natural, and concise.';

    var messages = [{ role: 'system', content: sysPrompt }];
    var ctx = (history || []).slice(-12);
    for (var i = 0; i < ctx.length; i++)
        messages.push({ role: ctx[i].role === 'user' ? 'user' : 'assistant', content: ctx[i].text || '' });
    messages.push({ role: 'user', content: userText });

    // Typing indicator
    var box = document.getElementById('chat-history');
    var tid = 'typing-ind-' + storageKey;
    if (box) {
        var td = document.createElement('div');
        td.className = 'typing-indicator'; td.id = tid;
        td.appendChild(document.createTextNode(char.name + ' is typing...'));
        box.appendChild(td); box.scrollTop = box.scrollHeight;
    }

    function removeTyping() { var t = document.getElementById(tid); if (t && t.parentNode) t.parentNode.removeChild(t); }

    function finish(reply) {
        removeTyping();
        if (!reply) reply = '[No response — check your Puter account or try a different model.]';
        reply = stripRolePrefix(reply, char.name);
        var msg = { sender: char, text: reply, role: 'ai', ts: Date.now() };
        CAI.saveChat(storageKey, (history || []).concat([msg]));
        var b = document.getElementById('chat-history');
        if (b) CAI.UI.drawMsg(msg, b);
        CAI.isAITyping = false;
        CAI.UI.setAIStatus('AI: Ready (' + model + ')', '#006600');
        CAI.UI.setStatus('Ready');
        if (onDone) onDone();
    }

    // Streaming with live typewriter bubble
    window.puter.ai.chat(messages, { model: model, stream: true })
        .then(function(stream) {
            removeTyping();
            var accumulated = '';
            var liveBubble = null, liveTxt = null;

            function ensureBubble() {
                if (liveBubble) return;
                var b2 = document.getElementById('chat-history'); if (!b2) return;
                var wrap = document.createElement('div'); wrap.className = 'chat-msg';
                var pfp = (typeof makePfpEl === 'function') ? makePfpEl(char, 'pfp-35') : document.createElement('div');
                liveBubble = document.createElement('div'); liveBubble.className = 'msg-bubble';
                var hdr = document.createElement('div'); hdr.className = 'msg-header ai-label';
                hdr.appendChild(document.createTextNode('AI: ' + char.name));
                liveTxt = document.createElement('div');
                liveBubble.appendChild(hdr); liveBubble.appendChild(liveTxt);
                wrap.appendChild(pfp); wrap.appendChild(liveBubble);
                b2.appendChild(wrap);
            }

            var iter = stream && stream[Symbol.asyncIterator] ? stream[Symbol.asyncIterator]() : null;
            function readNext() {
                if (!iter) { finish(accumulated || null); return; }
                iter.next().then(function(result) {
                    if (result.done) { finish(accumulated || null); return; }
                    var piece = (result.value && result.value.text) ? result.value.text : '';
                    if (piece) {
                        accumulated += piece;
                        ensureBubble();
                        if (liveTxt) liveTxt.innerHTML = stripRolePrefix(accumulated, char.name)
                            .replace(/\*(.*?)\*/g,'<em class="action-text">*$1*</em>');
                        var b2 = document.getElementById('chat-history');
                        if (b2) b2.scrollTop = b2.scrollHeight;
                    }
                    readNext();
                }).catch(function() { finish(accumulated || null); });
            }

            // Remove the static bubble added by finish() since streaming already drew it
            var origFinish = finish;
            finish = function(reply) {
                removeTyping();
                if (!reply) reply = '[No response]';
                reply = stripRolePrefix(reply, char.name);
                // Update the live bubble to final state then save
                if (liveTxt) liveTxt.innerHTML = reply.replace(/\*(.*?)\*/g,'<em class="action-text">*$1*</em>');
                var msg = { sender: char, text: reply, role: 'ai', ts: Date.now() };
                CAI.saveChat(storageKey, (history || []).concat([msg]));
                CAI.isAITyping = false;
                CAI.UI.setAIStatus('AI: Ready (' + model + ')', '#006600');
                CAI.UI.setStatus('Ready');
                if (onDone) onDone();
            };
            readNext();
        })
        .catch(function(err) {
            removeTyping();
            var msg = err && err.message ? err.message : String(err);
            finish('[Error: ' + msg + ' — if first time, allow the Puter sign-in popup.]');
        });
};

// ---- GC bot system prompt ----
CAI.buildGCBotSystem = function(bot, topic, otherBots) {
    return 'You are ' + bot.name + '. ' + (bot.desc || '') + '\n\n' +
        'STRICT OUTPUT FORMAT:\n' +
        '1. Output ONLY your spoken words or actions.\n' +
        '2. NEVER prefix with your name or any label.\n' +
        '3. Use *asterisks* ONLY for physical actions.\n' +
        '4. No narration, no "I say:" or "[Scene:]".\n' +
        '5. Group chat.' + (topic ? ' Topic: ' + topic : '') + '\n' +
        '6. Others: ' + (otherBots && otherBots.length ? otherBots.join(', ') : 'other characters') + '.\n' +
        '7. Stay in character, concise.';
};

// ---- GC bot call used by ui.js callGCBot ----
CAI.callPuterGCBot = function(messages, cb) {
    if (!puterReady()) { if (cb) cb(null); return; }
    var model = CAI.puterSettings.load().model;
    window.puter.ai.chat(messages, { model: model })
        .then(function(r) {
            var reply = extractText(r);
            if (cb) cb(reply ? reply.replace(/^\s+|\s+$/g,'') : null);
        })
        .catch(function() { if (cb) cb(null); });
};

// ---- List all models via Puter ----
CAI.fetchModels = function(onResult) {
    if (!puterReady()) { onResult('puter.js not loaded', []); return; }
    window.puter.ai.listModels()
        .then(function(models) {
            var names = (models || []).map(function(m){ return m.id || m; });
            onResult(null, names);
        })
        .catch(function(err) { onResult(err ? err.message : 'Error fetching models', []); });
};

// ---- Test connection ----
CAI.testPuter = function(model, onResult) {
    if (!puterReady()) { onResult('puter.js not loaded.'); return; }
    window.puter.ai.chat('Reply with "OK" only.', { model: model })
        .then(function(r) {
            var t = extractText(r);
            onResult(null, 'Connected! "' + model + '" replied: ' + (t||'(empty)').substring(0,60));
        })
        .catch(function(err) { onResult(err ? err.message : 'Error'); });
};
