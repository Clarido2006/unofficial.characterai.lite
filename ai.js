// ============================================================
// ai.js — Character.ai Lite [UNOFFICIAL]
// AI engine: HuggingFace Mistral + Pollinations fallback
// No emoji, compatible with older JS engines (no arrow fns
// in fetch chains, uses .then/.catch where needed)
// ============================================================

var CAI = CAI || {};

CAI.isAITyping = false;

CAI.callAI = function(char, user, userText, storageKey, onDone) {
    CAI.isAITyping = true;
    CAI.UI.setAIStatus('AI: Thinking...', '#CC6600');
    CAI.UI.setStatus(char.name + ' is typing...');

    var history = CAI.getChat(storageKey).slice(-12);
    var ctx = history.map(function(m) {
        return (m.role === 'user' ? user.name : char.name) + ': ' + m.text;
    }).join('\n');

    var sysp = 'You are ' + char.name + '. Personality: ' + (char.desc || 'No description.') + '\n' +
        'The user is ' + user.name + '. Their bio: ' + (user.desc || 'A regular person.') + '\n' +
        'Rules: Stay in character at all times. Use *asterisks* for actions/emotes. Be creative.\n' +
        'Recent conversation:\n' + ctx;

    // Show typing indicator
    var targetBoxId = storageKey === 'GROUP_CHAT' ? 'gc-history' : 'chat-history';
    var box = document.getElementById(targetBoxId);
    var tid = 'typing-ind-' + storageKey;
    if (box) {
        var td = document.createElement('div');
        td.className = 'typing-indicator';
        td.id = tid;
        td.appendChild(document.createTextNode(char.name + ' is typing...'));
        box.appendChild(td);
        box.scrollTop = box.scrollHeight;
    }

    function removeTyping() {
        var t = document.getElementById(tid);
        if (t && t.parentNode) t.parentNode.removeChild(t);
    }

    function finish(reply) {
        removeTyping();
        if (!reply) reply = char.name + ' seems to be thinking... (AI unavailable - check connection)';
        CAI.AI.addMsg(storageKey, { sender: char, text: reply, role: 'ai' });
        CAI.isAITyping = false;
        CAI.UI.setAIStatus('AI: Ready', '#006600');
        CAI.UI.setStatus('Ready');
        if (onDone) onDone();
    }

    CAI.tryHF(char, user, userText, sysp, function(reply) {
        if (reply) { finish(reply); return; }
        CAI.tryPollinations(char, user, userText, sysp, function(reply2) {
            finish(reply2 || null);
        });
    });
};

CAI.tryHF = function(char, user, text, sysp, cb) {
    var prompt = '<s>[INST] ' + sysp + '\n\n' + user.name + ': ' + text + ' [/INST] ' + char.name + ':';
    var body = JSON.stringify({
        inputs: prompt,
        parameters: {
            max_new_tokens: 220,
            temperature: 0.85,
            return_full_text: false,
            stop: ['\n' + user.name + ':', '</s>']
        }
    });

    var xhr = new XMLHttpRequest();
    xhr.open('POST', 'https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.3', true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.timeout = 15000;
    xhr.onreadystatechange = function() {
        if (xhr.readyState !== 4) return;
        if (xhr.status === 200) {
            try {
                var d = JSON.parse(xhr.responseText);
                if (d && d[0] && d[0].generated_text) {
                    var t = d[0].generated_text.replace(/^\s+/, '').split('\n')[0].replace(/\s+$/, '');
                    if (t.length > 2) { cb(t); return; }
                }
            } catch(e) {}
        }
        cb(null);
    };
    xhr.ontimeout = function() { cb(null); };
    xhr.onerror   = function() { cb(null); };
    xhr.send(body);
};

CAI.tryPollinations = function(char, user, text, sysp, cb) {
    var seed = Math.floor(Math.random() * 99999);
    var prompt = sysp + '\n\nUser: ' + text + '\n' + char.name + ':';
    var encoded = encodeURIComponent(prompt);
    var url = 'https://text.pollinations.ai/' + encoded + '?model=mistral&seed=' + seed + '&temperature=0.9';

    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.timeout = 18000;
    xhr.onreadystatechange = function() {
        if (xhr.readyState !== 4) return;
        if (xhr.status === 200) {
            var t = (xhr.responseText || '').replace(/^\s+|\s+$/g, '');
            // Stop at next user turn
            var stop = t.indexOf('\nUser:');
            if (stop > 0) t = t.substring(0, stop);
            var stop2 = t.indexOf('\nHuman:');
            if (stop2 > 0) t = t.substring(0, stop2);
            if (t.length > 2) { cb(t); return; }
        }
        cb(null);
    };
    xhr.ontimeout = function() { cb(null); };
    xhr.onerror   = function() { cb(null); };
    xhr.send();
};

// Convenience: add message to history and draw it
CAI.AI = {
    addMsg: function(storageKey, msgObj) {
        var h = CAI.getChat(storageKey);
        h.push(msgObj);
        CAI.saveChat(storageKey, h);
        var boxId = storageKey === 'GROUP_CHAT' ? 'gc-history' : 'chat-history';
        var box = document.getElementById(boxId);
        if (box) CAI.UI.drawMsg(msgObj, box);
    }
};
