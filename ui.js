// ============================================================
// ui.js — Character.ai Lite [UNOFFICIAL]
// All UI rendering, navigation, modals, search.
// No emojis. Compatible with older browsers (IE9+).
// ============================================================

var CAI = CAI || {};

CAI.selectedCharId    = null;
CAI.gcBotIds          = [];
CAI.editingId         = null;
CAI.tempPfpData       = null;
CAI.activePersonaId   = null;
CAI.currentProfileUser = null;

var pfpColors = [
    '#CC0000','#009900','#0000CC','#990099','#CC6600',
    '#009999','#444444','#336699','#994400','#006666',
    '#553388','#226644','#AA4400','#007799'
];

function pfpHash(name) {
    var h = 0;
    name = name || '?';
    for (var i = 0; i < name.length; i++) h = (name.charCodeAt(i) + ((h << 5) - h));
    return pfpColors[Math.abs(h) % pfpColors.length];
}

// Build a pfp div element (no innerHTML for compat)
function makePfpEl(item, sizeClass) {
    var d = document.createElement('div');
    d.className = 'pfp-box ' + (sizeClass || '');
    if (item && item.pfp) {
        d.style.backgroundImage = 'url(' + item.pfp + ')';
        d.style.backgroundSize  = 'cover';
        d.style.color = 'transparent';
    } else {
        d.style.backgroundColor = pfpHash(item ? item.name : '?');
        d.appendChild(document.createTextNode(item ? (item.name || '?')[0].toUpperCase() : '?'));
    }
    return d;
}

function makeUserAvatarEl(username, size) {
    var d = document.createElement('div');
    d.className = 'user-avatar';
    if (size) { d.style.width = size + 'px'; d.style.height = size + 'px'; d.style.fontSize = Math.floor(size * 0.45) + 'px'; }
    d.style.backgroundColor = pfpHash(username);
    d.appendChild(document.createTextNode((username || '?')[0].toUpperCase()));
    return d;
}

// ---- STATUS BAR ----
CAI.UI = {
    setStatus: function(msg) {
        var el = document.getElementById('status-text');
        if (el) el.firstChild ? (el.firstChild.nodeValue = msg) : el.appendChild(document.createTextNode(msg));
    },
    setAIStatus: function(msg, color) {
        var el = document.getElementById('ai-status');
        if (el) {
            el.firstChild ? (el.firstChild.nodeValue = msg) : el.appendChild(document.createTextNode(msg));
            if (color) el.style.color = color;
        }
    },
    drawMsg: function(m, box) {
        var wrap = document.createElement('div');
        wrap.className = 'chat-msg';
        var pfp = makePfpEl(m.sender, 'pfp-35');
        var bubble = document.createElement('div');
        bubble.className = 'msg-bubble' + (m.role === 'user' ? ' user-bubble' : '');
        var hdr = document.createElement('div');
        hdr.className = 'msg-header ' + (m.role === 'user' ? 'user-label' : 'ai-label');
        hdr.appendChild(document.createTextNode((m.role === 'user' ? 'USER' : 'AI') + ': ' + (m.sender ? m.sender.name : '?')));
        var txt = document.createElement('div');
        txt.innerHTML = fmtText(m.text || '');
        bubble.appendChild(hdr);
        bubble.appendChild(txt);
        wrap.appendChild(pfp);
        wrap.appendChild(bubble);
        box.appendChild(wrap);
        box.scrollTop = box.scrollHeight;
    }
};

function fmtText(t) {
    return (t || '').replace(/\*(.*?)\*/g, '<em class="action-text">*$1*</em>');
}

// ---- NAVIGATION ----
var NAV_MAP = { home:0, messenger:1, 'group-chat':2, browse:3, 'persona-mgr':4, 'create-char':5, updates:6 };

function nav(id) {
    var views = document.querySelectorAll('.view');
    for (var i = 0; i < views.length; i++) views[i].className = views[i].className.replace(' active','');
    var navLinks = document.querySelectorAll('.nav-link');
    for (var j = 0; j < navLinks.length; j++) navLinks[j].className = navLinks[j].className.replace(' active','');

    var view = document.getElementById(id);
    if (view) view.className += ' active';
    var idx = NAV_MAP[id];
    if (idx !== undefined && navLinks[idx]) navLinks[idx].className += ' active';

    if (id === 'home')        renderHome();
    if (id === 'messenger')   renderMessenger();
    if (id === 'persona-mgr') renderPersonaList();
    if (id === 'group-chat')  loadGCView();
    if (id === 'create-char') prepareNewChar();
    if (id === 'browse')      renderBrowse();
}

// ---- HOME ----
function renderHome() {
    var chars   = CAI.getUserChars();
    var recents = CAI.getRecents();

    // recent
    var rEl = document.getElementById('recent-list');
    clearEl(rEl);
    var recChars = recents.map(function(id) {
        for (var i = 0; i < chars.length; i++) if (chars[i].id === id) return chars[i];
        return null;
    }).filter(Boolean).slice(0, 8);
    if (!recChars.length) {
        var em = document.createElement('div');
        em.style.cssText = 'color:#888;font-style:italic;padding:8px;';
        em.appendChild(document.createTextNode('No recent chats yet.'));
        rEl.appendChild(em);
    } else {
        recChars.forEach(function(c) { rEl.appendChild(makeCharCard(c, true)); });
    }

    // all chars
    var aEl = document.getElementById('all-chars-list');
    clearEl(aEl);
    if (!chars.length) {
        aEl.innerHTML = '<div class="empty-state"><h3>No Characters Yet</h3><p>Create your first AI character.</p><button class="classic-btn primary" onclick="nav(\'create-char\')">+ Create AI</button></div>';
    } else {
        chars.forEach(function(c) { aEl.appendChild(makeCharCard(c, true)); });
    }
}

function makeCharCard(c, showDel) {
    var div = document.createElement('div');
    div.className = 'char-card';
    div.style.width = '240px';

    var inner = document.createElement('div');
    inner.className = 'char-card-inner';
    inner.appendChild(makePfpEl(c, 'pfp-35'));

    var info = document.createElement('div');
    info.className = 'char-card-info';

    var nm = document.createElement('strong');
    nm.appendChild(document.createTextNode(c.name));

    var badge = document.createElement('span');
    badge.className = 'privacy-badge ' + (c.pub ? 'badge-public' : 'badge-private');
    badge.appendChild(document.createTextNode(c.pub ? 'Public' : 'Private'));

    var sm = document.createElement('small');
    sm.appendChild(document.createTextNode((c.desc || '').substring(0, 45) + ((c.desc || '').length > 45 ? '...' : '')));

    info.appendChild(nm);
    info.appendChild(badge);
    info.appendChild(document.createElement('br'));
    info.appendChild(sm);
    inner.appendChild(info);
    div.appendChild(inner);

    if (showDel) {
        var del = document.createElement('button');
        del.className = 'card-del';
        del.appendChild(document.createTextNode('X'));
        (function(cid, cname) {
            del.onclick = function(e) {
                e.stopPropagation();
                if (confirm('Delete ' + cname + '? All chat history will be lost.')) deleteCharFull(cid);
            };
        })(c.id, c.name);
        div.appendChild(del);
    }

    (function(cid) {
        div.onclick = function() { nav('messenger'); selectChar(cid); };
    })(c.id);
    return div;
}

// ---- MESSENGER ----
function renderMessenger() {
    var chars = CAI.getUserChars();
    var inner = document.getElementById('contact-list-inner');
    clearEl(inner);

    if (!chars.length) {
        var em = document.createElement('div');
        em.style.cssText = 'padding:10px;color:#666;font-style:italic;font-size:11px;';
        em.appendChild(document.createTextNode('No characters. Create one or find public ones in Discover.'));
        inner.appendChild(em);
        loadChatHistory(null);
        return;
    }

    chars.forEach(function(c) {
        var row = document.createElement('div');
        row.className = 'contact-row' + (c.id === CAI.selectedCharId ? ' active' : '');
        row.appendChild(makePfpEl(c, 'pfp-24'));
        var nm = document.createElement('span');
        nm.className = 'contact-name';
        nm.appendChild(document.createTextNode(c.name));
        row.appendChild(nm);

        var del = document.createElement('button');
        del.className = 'contact-del';
        del.appendChild(document.createTextNode('X'));
        (function(cid, cname) {
            del.onclick = function(e) {
                e.stopPropagation();
                if (confirm('Delete ' + cname + '?')) deleteCharFull(cid);
            };
        })(c.id, c.name);
        row.appendChild(del);

        (function(cid) { row.onclick = function() { selectChar(cid); }; })(c.id);
        inner.appendChild(row);
    });

    if (!CAI.selectedCharId && chars.length) selectChar(chars[0].id);
    else loadChatHistory(CAI.selectedCharId);
}

function selectChar(id) {
    var chars = CAI.getUserChars();
    var char  = null;
    for (var i = 0; i < chars.length; i++) if (chars[i].id === id) { char = chars[i]; break; }
    if (!id || !char) { loadChatHistory(null); return; }

    CAI.selectedCharId = id;
    var rec = CAI.getRecents();
    rec = [id].concat(rec.filter(function(r) { return r !== id; })).slice(0, 20);
    CAI.saveRecents(rec);

    // Update contact list active state
    var rows = document.querySelectorAll('.contact-row');
    for (var j = 0; j < rows.length; j++) {
        var nm = rows[j].querySelector('.contact-name');
        if (nm && nm.firstChild && nm.firstChild.nodeValue === char.name) rows[j].className = 'contact-row active';
        else rows[j].className = 'contact-row';
    }

    // Update chat header
    var hPfp = document.getElementById('chat-header-pfp');
    clearEl(hPfp);
    if (char.pfp) {
        hPfp.style.backgroundImage = 'url(' + char.pfp + ')';
        hPfp.style.backgroundSize  = 'cover';
        hPfp.style.backgroundColor = '';
    } else {
        hPfp.style.backgroundImage = 'none';
        hPfp.style.backgroundColor = pfpHash(char.name);
        hPfp.appendChild(document.createTextNode(char.name[0].toUpperCase()));
    }

    var hnEl = document.getElementById('chat-header-name');
    clearEl(hnEl); hnEl.appendChild(document.createTextNode(char.name));

    var hdEl = document.getElementById('chat-header-desc');
    clearEl(hdEl); hdEl.appendChild(document.createTextNode((char.desc || '').substring(0, 80)));

    // Visitor count
    if (char.pub || char.ownedBy !== CAI.currentUser) CAI.recordVisitor(char.id);
    var vcEl = document.getElementById('chat-visitor-count');
    if (vcEl) {
        var vc = CAI.getVisitorCount(char.id);
        clearEl(vcEl);
        vcEl.appendChild(document.createTextNode(vc + ' visitor' + (vc !== 1 ? 's' : '')));
        vcEl.style.display = (char.pub || char.ownedBy !== CAI.currentUser) ? 'inline-block' : 'none';
    }

    var editBtn = document.getElementById('edit-ai-btn');
    if (editBtn) editBtn.style.display = (!char.ownedBy || char.ownedBy === CAI.currentUser) ? 'inline-block' : 'none';

    loadChatHistory(id);
}

function loadChatHistory(charId) {
    var box = document.getElementById('chat-history');
    clearEl(box);
    if (!charId) {
        box.innerHTML = '<div class="empty-state"><p>Select a character to start chatting.</p></div>';
        return;
    }
    var chars = CAI.getUserChars();
    var char  = null;
    for (var i = 0; i < chars.length; i++) if (chars[i].id === charId) { char = chars[i]; break; }
    if (!char) { box.innerHTML = '<div class="empty-state"><p>Character not found.</p></div>'; return; }

    var history = CAI.getChat(charId);
    if (!history.length) {
        CAI.AI.addMsg(charId, { sender: char, text: char.greet || 'Hello! I am ' + char.name + '. How can I help?', role: 'ai' });
    } else {
        for (var j = 0; j < history.length; j++) CAI.UI.drawMsg(history[j], box);
    }
}

function sendChatMessage() {
    if (CAI.isAITyping) return;
    var input = document.getElementById('chat-input');
    var text  = (input.value || '').replace(/^\s+|\s+$/g, '');
    if (!text || !CAI.selectedCharId) return;

    var personas = CAI.getUserPersonas();
    var user = null;
    for (var i = 0; i < personas.length; i++) if (personas[i].id === CAI.activePersonaId) { user = personas[i]; break; }
    if (!user && personas.length) user = personas[0];
    if (!user) user = { id: 'u', name: CAI.currentUser, desc: 'A user.', pfp: null };

    var chars = CAI.getUserChars();
    var char = null;
    for (var j = 0; j < chars.length; j++) if (chars[j].id === CAI.selectedCharId) { char = chars[j]; break; }
    if (!char) return;

    CAI.AI.addMsg(CAI.selectedCharId, { sender: user, text: text, role: 'user' });
    input.value = '';
    CAI.callAI(char, user, text, CAI.selectedCharId, null);
}

function resetCurrentChat() {
    var chars = CAI.getUserChars();
    var char  = null;
    for (var i = 0; i < chars.length; i++) if (chars[i].id === CAI.selectedCharId) { char = chars[i]; break; }
    if (!char) return;
    if (confirm('Reset chat with ' + char.name + '? All history will be cleared.')) {
        CAI.saveChat(CAI.selectedCharId, []);
        loadChatHistory(CAI.selectedCharId);
    }
}

// ---- GROUP CHAT ----
function loadGCView() {
    var personas = CAI.getUserPersonas();
    var sel = document.getElementById('gc-persona-select');
    clearEl(sel);
    for (var i = 0; i < personas.length; i++) {
        var o = document.createElement('option');
        o.value = personas[i].id;
        o.appendChild(document.createTextNode(personas[i].name));
        if (personas[i].id === CAI.activePersonaId) o.selected = true;
        sel.appendChild(o);
    }
    var box = document.getElementById('gc-history');
    clearEl(box);
    var h = CAI.getChat('GROUP_CHAT');
    for (var j = 0; j < h.length; j++) CAI.UI.drawMsg(h[j], box);
    updateGCLabel();
}
function updateGCPersona() { CAI.activePersonaId = document.getElementById('gc-persona-select').value; }
function clearGCHistory() {
    if (confirm('Clear group chat history?')) {
        CAI.saveChat('GROUP_CHAT', []);
        clearEl(document.getElementById('gc-history'));
    }
}
function updateGCLabel() {
    var chars = CAI.getUserChars();
    var names = CAI.gcBotIds.map(function(id) {
        for (var i = 0; i < chars.length; i++) if (chars[i].id === id) return chars[i].name;
        return null;
    }).filter(Boolean);
    var el = document.getElementById('gc-bots-label');
    clearEl(el);
    el.appendChild(document.createTextNode(names.length ? 'Bots: ' + names.join(', ') : 'No bots selected'));
}
function openGCBotPicker() {
    document.getElementById('modal-gc-bots').style.display = 'flex';
    var list = document.getElementById('gc-bot-picker-list');
    clearEl(list);
    var chars = CAI.getUserChars();
    if (!chars.length) {
        list.innerHTML = '<div style="padding:8px;color:#666;">No characters yet.</div>';
        return;
    }
    chars.forEach(function(c) {
        var btn = document.createElement('button');
        btn.className = 'classic-btn';
        btn.style.cssText = 'width:100%;margin-bottom:5px;text-align:left;display:block;';
        var chk = CAI.gcBotIds.indexOf(c.id) >= 0 ? '[X] ' : '[ ] ';
        btn.appendChild(document.createTextNode(chk + c.name));
        (function(cid) {
            btn.onclick = function() {
                var idx = CAI.gcBotIds.indexOf(cid);
                if (idx >= 0) CAI.gcBotIds.splice(idx, 1);
                else CAI.gcBotIds.push(cid);
                openGCBotPicker();
                updateGCLabel();
            };
        })(c.id);
        list.appendChild(btn);
    });
}

var gcQueue = [];
var gcRunning = false;
function sendGroupMessage() {
    var input = document.getElementById('gc-input');
    var text  = (input.value || '').replace(/^\s+|\s+$/g, '');
    if (!text || !CAI.gcBotIds.length) { alert('Add at least one bot and type a message.'); return; }

    var personas = CAI.getUserPersonas();
    var user = null;
    for (var i = 0; i < personas.length; i++) if (personas[i].id === CAI.activePersonaId) { user = personas[i]; break; }
    if (!user && personas.length) user = personas[0];

    var chars = CAI.getUserChars();
    CAI.AI.addMsg('GROUP_CHAT', { sender: user, text: text, role: 'user' });
    input.value = '';

    var bots = CAI.gcBotIds.map(function(bid) {
        for (var i = 0; i < chars.length; i++) if (chars[i].id === bid) return chars[i];
        return null;
    }).filter(Boolean);

    // Sequential queue
    gcQueue = bots.slice();
    var capturedUser = user;
    var capturedText = '(Group) ' + text;

    function next() {
        if (!gcQueue.length) { gcRunning = false; return; }
        gcRunning = true;
        var bot = gcQueue.shift();
        CAI.callAI(bot, capturedUser, capturedText, 'GROUP_CHAT', next);
    }
    if (!gcRunning) next();
}

// ---- PERSONAS ----
function renderPersonaList() {
    var container = document.getElementById('persona-list-container');
    clearEl(container);
    var personas = CAI.getUserPersonas();
    if (!personas.length) {
        container.innerHTML = '<div class="empty-state"><p>No personas yet. Create one below.</p></div>';
        return;
    }
    personas.forEach(function(p) {
        var div = document.createElement('div');
        div.className = 'persona-card';
        div.appendChild(makePfpEl(p, 'pfp-50'));

        var info = document.createElement('div');
        info.style.flex = '1';
        var nm = document.createElement('strong');
        nm.appendChild(document.createTextNode(p.name));
        if (p.id === CAI.activePersonaId) {
            var act = document.createElement('span');
            act.style.cssText = 'color:#009900;font-size:10px;margin-left:6px;';
            act.appendChild(document.createTextNode('[Active]'));
            nm.appendChild(act);
        }
        var sm = document.createElement('small');
        sm.style.color = '#666';
        sm.appendChild(document.createTextNode(p.desc || ''));
        info.appendChild(nm);
        info.appendChild(document.createElement('br'));
        info.appendChild(sm);
        div.appendChild(info);

        var useBtn = document.createElement('button'); useBtn.className = 'classic-btn';
        useBtn.appendChild(document.createTextNode('Use'));
        (function(pid) { useBtn.onclick = function() { setActivePersona(pid); }; })(p.id);

        var editBtn = document.createElement('button'); editBtn.className = 'classic-btn';
        editBtn.appendChild(document.createTextNode('Edit'));
        (function(pid) { editBtn.onclick = function() { openPersonaEditor(pid); }; })(p.id);

        var delBtn = document.createElement('button'); delBtn.className = 'classic-btn danger';
        delBtn.appendChild(document.createTextNode('Del'));
        (function(pid) {
            delBtn.onclick = function() {
                if (confirm('Delete persona?')) { CAI.deletePersonaLocal(pid); renderPersonaList(); }
            };
        })(p.id);

        div.appendChild(useBtn);
        div.appendChild(editBtn);
        div.appendChild(delBtn);
        container.appendChild(div);
    });
}

function setActivePersona(id) { CAI.activePersonaId = id; renderPersonaList(); CAI.UI.setStatus('Active persona updated.'); }

function openPersonaEditor(id) {
    id = id || null;
    CAI.editingId   = id;
    CAI.tempPfpData = null;
    document.getElementById('modal-persona').style.display = 'flex';
    var preview = document.getElementById('p-pfp-preview');
    if (id) {
        var personas = CAI.getUserPersonas();
        var p = null;
        for (var i = 0; i < personas.length; i++) if (personas[i].id === id) { p = personas[i]; break; }
        if (p) {
            document.getElementById('p-name-in').value = p.name || '';
            document.getElementById('p-desc-in').value = p.desc || '';
            if (p.pfp) { preview.style.backgroundImage = 'url(' + p.pfp + ')'; preview.style.backgroundSize = 'cover'; clearEl(preview); }
            else { preview.style.backgroundImage = 'none'; clearEl(preview); preview.appendChild(document.createTextNode('Click to Upload')); }
        }
    } else {
        document.getElementById('p-name-in').value = '';
        document.getElementById('p-desc-in').value = '';
        preview.style.backgroundImage = 'none';
        clearEl(preview); preview.appendChild(document.createTextNode('Click to Upload'));
    }
}

function savePersona() {
    var name = (document.getElementById('p-name-in').value || '').replace(/^\s+|\s+$/g, '');
    var desc = (document.getElementById('p-desc-in').value || '').replace(/^\s+|\s+$/g, '');
    if (!name) { alert('Please enter a name.'); return; }
    if (CAI.editingId) {
        var personas = CAI.getUserPersonas();
        for (var i = 0; i < personas.length; i++) {
            if (personas[i].id === CAI.editingId) {
                personas[i].name = name; personas[i].desc = desc;
                if (CAI.tempPfpData) personas[i].pfp = CAI.tempPfpData;
                CAI.savePersonaItem(personas[i]); break;
            }
        }
    } else {
        var np = { id: 'p' + Date.now(), name: name, desc: desc, pfp: CAI.tempPfpData };
        CAI.savePersonaItem(np);
        if (!CAI.activePersonaId) CAI.activePersonaId = np.id;
    }
    closeModals(); renderPersonaList(); CAI.UI.setStatus('Persona saved.');
}

// ---- CREATE / EDIT CHARACTER ----
function prepareNewChar() {
    CAI.editingId   = null;
    CAI.tempPfpData = null;
    document.getElementById('char-form-title').firstChild.nodeValue = 'Create Character';
    document.getElementById('c-name-in').value  = '';
    document.getElementById('c-greet-in').value = '';
    document.getElementById('c-desc-in').value  = '';
    document.getElementById('vis-private').checked = true;
    var visInfo = document.getElementById('vis-info');
    clearEl(visInfo); visInfo.appendChild(document.createTextNode('Private — only visible to you.'));
    document.getElementById('publish-btn').style.display = 'none';
    var preview = document.getElementById('c-pfp-preview');
    preview.style.backgroundImage = 'none'; preview.style.backgroundSize = '';
    clearEl(preview); preview.appendChild(document.createTextNode('Click to Upload'));
}

function saveCharacter() {
    var name    = (document.getElementById('c-name-in').value || '').replace(/^\s+|\s+$/g, '');
    var greet   = (document.getElementById('c-greet-in').value || '').replace(/^\s+|\s+$/g, '');
    var desc    = (document.getElementById('c-desc-in').value || '').replace(/^\s+|\s+$/g, '');
    var isPub   = document.getElementById('vis-public').checked;
    if (!name) { alert('Please enter a character name.'); return; }

    if (CAI.editingId) {
        var chars = CAI.getUserChars();
        for (var i = 0; i < chars.length; i++) {
            if (chars[i].id === CAI.editingId) {
                chars[i].name  = name; chars[i].greet = greet; chars[i].desc = desc; chars[i].pub = isPub;
                if (CAI.tempPfpData) chars[i].pfp = CAI.tempPfpData;
                CAI.saveChar(chars[i]);
                if (isPub) CAI.syncToPublic(chars[i]); else CAI.removeFromPublic(chars[i].id);
                break;
            }
        }
        CAI.selectedCharId = CAI.editingId;
        document.getElementById('publish-btn').style.display = 'inline-block';
    } else {
        var newId = 'c' + Date.now();
        var newC  = { id: newId, name: name, greet: greet, desc: desc, pfp: CAI.tempPfpData, pub: isPub, ownedBy: CAI.currentUser, created: Date.now() };
        CAI.saveChar(newC);
        if (isPub) CAI.syncToPublic(newC);
        CAI.selectedCharId = newId;
    }
    CAI.editingId = null; CAI.tempPfpData = null;
    CAI.UI.setStatus('Character "' + name + '" saved.');
    nav('messenger'); selectChar(CAI.selectedCharId);
}

function publishCharacter() {
    if (!CAI.editingId) { saveCharacter(); return; }
    var chars = CAI.getUserChars();
    for (var i = 0; i < chars.length; i++) {
        if (chars[i].id === CAI.editingId) {
            chars[i].pub = true; CAI.saveChar(chars[i]); CAI.syncToPublic(chars[i]);
            alert(chars[i].name + ' is now public!');
            document.getElementById('vis-public').checked = true;
            CAI.UI.setStatus(chars[i].name + ' published.');
            break;
        }
    }
}

function openCharEditor() {
    var chars = CAI.getUserChars();
    var c = null;
    for (var i = 0; i < chars.length; i++) if (chars[i].id === CAI.selectedCharId) { c = chars[i]; break; }
    if (!c) return;
    CAI.editingId = c.id;
    var titleEl = document.getElementById('char-form-title');
    clearEl(titleEl); titleEl.appendChild(document.createTextNode('Edit AI'));
    document.getElementById('c-name-in').value  = c.name  || '';
    document.getElementById('c-greet-in').value = c.greet || '';
    document.getElementById('c-desc-in').value  = c.desc  || '';
    if (c.pub) document.getElementById('vis-public').checked = true;
    else document.getElementById('vis-private').checked = true;
    var preview = document.getElementById('c-pfp-preview');
    if (c.pfp) { preview.style.backgroundImage = 'url(' + c.pfp + ')'; preview.style.backgroundSize = 'cover'; clearEl(preview); }
    else { preview.style.backgroundImage = 'none'; preview.style.backgroundSize = ''; clearEl(preview); preview.appendChild(document.createTextNode('Click to Upload')); }
    CAI.tempPfpData = null;
    document.getElementById('publish-btn').style.display = 'inline-block';
    nav('create-char');
}

function deleteCharFull(id) {
    var chars = CAI.getUserChars();
    var c = null;
    for (var i = 0; i < chars.length; i++) if (chars[i].id === id) { c = chars[i]; break; }
    if (!c || !confirm('Delete "' + c.name + '"? All chat history will be lost.')) return;
    CAI.deleteCharLocal(id); CAI.removeFromPublic(id);
    CAI.saveRecents(CAI.getRecents().filter(function(x) { return x !== id; }));
    CAI.gcBotIds = CAI.gcBotIds.filter(function(x) { return x !== id; });
    if (CAI.selectedCharId === id) CAI.selectedCharId = null;
    renderHome(); renderMessenger(); CAI.UI.setStatus('"' + c.name + '" deleted.');
}

// ---- BROWSE / DISCOVER ----
function renderBrowse() {
    var query  = (document.getElementById('browse-search-input') ? document.getElementById('browse-search-input').value : '').toLowerCase().replace(/^\s+|\s+$/g, '');
    var sortBy = document.getElementById('browse-sort') ? document.getElementById('browse-sort').value : 'newest';
    var db     = CAI.getPublicDB();
    var browseEl = document.getElementById('browse-list');
    clearEl(browseEl);

    var allChars = [];
    for (var k in db) { if (db.hasOwnProperty(k) && db[k].pub !== false) allChars.push(db[k]); }

    if (query) {
        allChars = allChars.filter(function(c) {
            return (c.name || '').toLowerCase().indexOf(query) >= 0 ||
                   (c.ownedBy || '').toLowerCase().indexOf(query) >= 0 ||
                   (c.desc || '').toLowerCase().indexOf(query) >= 0;
        });
    }
    if (sortBy === 'newest')   allChars.sort(function(a,b){ return (b.publishedAt||0)-(a.publishedAt||0); });
    else if (sortBy === 'visitors') allChars.sort(function(a,b){ return CAI.getVisitorCount(b.id)-CAI.getVisitorCount(a.id); });
    else if (sortBy === 'az')  allChars.sort(function(a,b){ return (a.name||'').localeCompare(b.name||''); });

    if (!allChars.length) {
        browseEl.innerHTML = '<div class="empty-state"><p>' + (query ? 'No characters match your search.' : 'No public characters yet. Be the first to publish one!') + '</p></div>';
    } else {
        allChars.forEach(function(c) {
            browseEl.appendChild(makePubCharCard(c));
        });
    }

    // Users list
    var usersEl = document.getElementById('users-list');
    clearEl(usersEl);
    var usersDB = CAI.getUsersDB();
    var unames  = Object.keys(usersDB).filter(function(u) { return u !== CAI.currentUser; });
    if (!unames.length) {
        var em = document.createElement('div');
        em.style.cssText = 'color:#888;padding:8px;font-style:italic;';
        em.appendChild(document.createTextNode('No other users yet.'));
        usersEl.appendChild(em);
        return;
    }
    if (query) {
        unames = unames.filter(function(u) { return u.toLowerCase().indexOf(query) >= 0; });
    }
    unames.forEach(function(u) {
        usersEl.appendChild(makeUserRow(u));
    });
}

function makePubCharCard(c) {
    var div = document.createElement('div');
    div.className = 'pub-char-card';

    div.appendChild(makePfpEl(c, 'pfp-50'));

    var info = document.createElement('div');
    info.className = 'pub-char-info';

    var h3 = document.createElement('h3');
    h3.appendChild(document.createTextNode(c.name));
    info.appendChild(h3);

    var auth = document.createElement('div');
    auth.className = 'author';
    auth.appendChild(document.createTextNode('by '));
    var alink = document.createElement('span');
    alink.style.cssText = 'color:#0033AA;cursor:pointer;text-decoration:underline;';
    alink.appendChild(document.createTextNode(c.ownedBy || 'unknown'));
    (function(u) { alink.onclick = function() { viewProfile(u); }; })(c.ownedBy || '');
    auth.appendChild(alink);
    auth.appendChild(document.createTextNode(' - ' + new Date(c.publishedAt || 0).toLocaleDateString()));
    info.appendChild(auth);

    var desc = document.createElement('div');
    desc.className = 'desc';
    desc.appendChild(document.createTextNode((c.desc || '').substring(0, 100) + ((c.desc || '').length > 100 ? '...' : '')));
    info.appendChild(desc);

    var vc = CAI.getVisitorCount(c.id);
    var vbadge = document.createElement('span');
    vbadge.className = 'visitor-badge';
    vbadge.appendChild(document.createTextNode(vc + ' visitor' + (vc !== 1 ? 's' : '')));
    info.appendChild(document.createElement('br'));
    info.appendChild(vbadge);

    div.appendChild(info);

    var actions = document.createElement('div');
    actions.className = 'pub-char-actions';
    var myChars = CAI.getUserChars();
    var alreadyHave = false;
    for (var i = 0; i < myChars.length; i++) if (myChars[i].id === c.id) { alreadyHave = true; break; }

    var actionBtn = document.createElement('button');
    if (alreadyHave) {
        actionBtn.className = 'classic-btn';
        actionBtn.appendChild(document.createTextNode('Chat'));
        (function(cid) { actionBtn.onclick = function() { nav('messenger'); selectChar(cid); }; })(c.id);
    } else {
        actionBtn.className = 'classic-btn success';
        actionBtn.appendChild(document.createTextNode('Add + Chat'));
        (function(cid) { actionBtn.onclick = function() { addPublicCharToMine(cid); }; })(c.id);
    }
    actions.appendChild(actionBtn);

    var profBtn = document.createElement('button');
    profBtn.className = 'classic-btn';
    profBtn.appendChild(document.createTextNode('Profile'));
    (function(u) { profBtn.onclick = function() { viewProfile(u); }; })(c.ownedBy || '');
    actions.appendChild(profBtn);

    div.appendChild(actions);
    return div;
}

function makeUserRow(u) {
    var db       = CAI.getPublicDB();
    var pubCount = 0;
    for (var k in db) if (db.hasOwnProperty(k) && db[k].ownedBy === u) pubCount++;
    var following = CAI.isFollowing(u);

    var div = document.createElement('div');
    div.className = 'user-row';
    div.appendChild(makeUserAvatarEl(u, 32));

    var info = document.createElement('div');
    info.style.flex = '1';
    var nm = document.createElement('strong');
    nm.style.cssText = 'cursor:pointer;color:#0033AA;text-decoration:underline;';
    nm.appendChild(document.createTextNode(u));
    (function(un) { nm.onclick = function() { viewProfile(un); }; })(u);
    var sm = document.createElement('small');
    sm.style.cssText = 'display:block;font-size:10px;color:#666;';
    sm.appendChild(document.createTextNode(pubCount + ' public character' + (pubCount !== 1 ? 's' : '') + ' - ' + CAI.getFollowers(u).length + ' followers'));
    info.appendChild(nm);
    info.appendChild(sm);
    div.appendChild(info);

    var fBtn = document.createElement('button');
    fBtn.className = 'classic-btn' + (following ? ' danger' : '');
    fBtn.appendChild(document.createTextNode(following ? 'Unfollow' : 'Follow'));
    (function(un, btn) {
        btn.onclick = function() {
            if (CAI.isFollowing(un)) { CAI.unfollowUser(un); btn.firstChild.nodeValue = 'Follow'; btn.className = 'classic-btn'; }
            else { CAI.followUser(un); btn.firstChild.nodeValue = 'Unfollow'; btn.className = 'classic-btn danger'; }
        };
    })(u, fBtn);
    div.appendChild(fBtn);

    var pBtn = document.createElement('button');
    pBtn.className = 'classic-btn';
    pBtn.appendChild(document.createTextNode('View Profile'));
    (function(un) { pBtn.onclick = function() { viewProfile(un); }; })(u);
    div.appendChild(pBtn);
    return div;
}

function addPublicCharToMine(charId) {
    var db = CAI.getPublicDB();
    var c  = db[charId];
    if (!c) return;
    var copy = {};
    for (var k in c) if (c.hasOwnProperty(k)) copy[k] = c[k];
    copy.id = charId;
    CAI.saveChar(copy);
    CAI.recordVisitor(charId);
    CAI.UI.setStatus('"' + c.name + '" added! Starting chat...');
    nav('messenger'); selectChar(charId);
}

// ---- USER PROFILES ----
function viewProfile(username) {
    if (!username || username === '?') return;
    CAI.currentProfileUser = username;
    var db       = CAI.getPublicDB();
    var isMe     = username === CAI.currentUser;
    var amFoll   = CAI.isFollowing(username);
    var followers = CAI.getFollowers(username);
    var following = CAI.getFollowing(username);
    var pubChars  = [];
    for (var k in db) if (db.hasOwnProperty(k) && db[k].ownedBy === username) pubChars.push(db[k]);

    var content = document.getElementById('profile-content');
    clearEl(content);
    var pad = document.createElement('div');
    pad.style.padding = '14px';

    // Header
    var hdr = document.createElement('div');
    hdr.className = 'profile-header';
    hdr.appendChild(makeUserAvatarEl(username, 60));

    var hdrInfo = document.createElement('div');
    hdrInfo.style.flex = '1';

    var h2 = document.createElement('h2');
    h2.style.cssText = 'font-size:16px;color:#0033AA;margin-bottom:4px;';
    h2.appendChild(document.createTextNode(username));
    hdrInfo.appendChild(h2);

    var stats = document.createElement('div');
    stats.className = 'profile-stats';

    function makeStatBox(num, label, clickFn) {
        var sb = document.createElement('div');
        sb.className = 'stat-box';
        if (clickFn) sb.style.cursor = 'pointer';
        var sn = document.createElement('span'); sn.className = 'stat-num'; sn.appendChild(document.createTextNode(String(num)));
        var sl = document.createElement('span'); sl.className = 'stat-label'; sl.appendChild(document.createTextNode(label));
        sb.appendChild(sn); sb.appendChild(sl);
        if (clickFn) sb.onclick = clickFn;
        return sb;
    }
    stats.appendChild(makeStatBox(pubChars.length, 'Characters'));
    stats.appendChild(makeStatBox(followers.length, 'Followers', function() { showFollowersList(username, 'followers'); }));
    stats.appendChild(makeStatBox(following.length, 'Following', function() { showFollowersList(username, 'following'); }));
    hdrInfo.appendChild(stats);

    if (!isMe) {
        var fBtnWrap = document.createElement('div');
        fBtnWrap.style.marginTop = '10px';
        var fBtn = document.createElement('button');
        fBtn.className = 'classic-btn' + (amFoll ? ' danger' : '');
        fBtn.appendChild(document.createTextNode(amFoll ? 'Unfollow' : 'Follow'));
        (function(un, btn) {
            btn.onclick = function() {
                if (CAI.isFollowing(un)) CAI.unfollowUser(un); else CAI.followUser(un);
                viewProfile(un);
            };
        })(username, fBtn);
        fBtnWrap.appendChild(fBtn);
        hdrInfo.appendChild(fBtnWrap);
    } else {
        var meBadge = document.createElement('div');
        meBadge.style.marginTop = '8px';
        var meSpan = document.createElement('span');
        meSpan.style.cssText = 'background:#CCFFCC;border:1px solid #009900;color:#006600;padding:3px 8px;font-size:10px;';
        meSpan.appendChild(document.createTextNode('This is you'));
        meBadge.appendChild(meSpan);

        var dlBtn = document.createElement('button');
        dlBtn.className = 'classic-btn';
        dlBtn.style.marginLeft = '8px';
        dlBtn.appendChild(document.createTextNode('Download user.json'));
        dlBtn.onclick = function() { CAI.downloadUserJson(CAI.currentUser); };
        meBadge.appendChild(dlBtn);

        var dlCharBtn = document.createElement('button');
        dlCharBtn.className = 'classic-btn';
        dlCharBtn.style.marginLeft = '8px';
        dlCharBtn.appendChild(document.createTextNode('Download character list'));
        dlCharBtn.onclick = function() { CAI.downloadCharacterList(); };
        meBadge.appendChild(dlCharBtn);

        var dlPersBtn = document.createElement('button');
        dlPersBtn.className = 'classic-btn';
        dlPersBtn.style.marginLeft = '8px';
        dlPersBtn.appendChild(document.createTextNode('Download persona list'));
        dlPersBtn.onclick = function() { CAI.downloadPersonaList(); };
        meBadge.appendChild(dlPersBtn);

        hdrInfo.appendChild(meBadge);
    }
    hdr.appendChild(hdrInfo);
    pad.appendChild(hdr);

    // Public characters
    var charTitle = document.createElement('div');
    charTitle.className = 'section-title';
    charTitle.appendChild(document.createTextNode('Public Characters by ' + username));
    pad.appendChild(charTitle);

    var charGrid = document.createElement('div');
    charGrid.className = 'char-grid';
    if (!pubChars.length) {
        var em2 = document.createElement('div');
        em2.style.cssText = 'color:#888;font-style:italic;padding:8px;';
        em2.appendChild(document.createTextNode('No public characters yet.'));
        charGrid.appendChild(em2);
    } else {
        pubChars.forEach(function(c) {
            var card = document.createElement('div');
            card.className = 'char-card';
            card.style.width = '240px';
            var ci = document.createElement('div'); ci.className = 'char-card-inner';
            ci.appendChild(makePfpEl(c, 'pfp-35'));
            var cinf = document.createElement('div'); cinf.className = 'char-card-info';
            var cnm = document.createElement('strong'); cnm.appendChild(document.createTextNode(c.name));
            var csm = document.createElement('small'); csm.appendChild(document.createTextNode((c.desc || '').substring(0, 50)));
            var cvc = document.createElement('div');
            var cvb = document.createElement('span'); cvb.className = 'visitor-badge';
            var vn = CAI.getVisitorCount(c.id);
            cvb.appendChild(document.createTextNode(vn + ' visitor' + (vn !== 1 ? 's' : '')));
            cvc.appendChild(cvb);
            cinf.appendChild(cnm); cinf.appendChild(document.createElement('br')); cinf.appendChild(csm); cinf.appendChild(cvc);
            ci.appendChild(cinf); card.appendChild(ci);

            var myChars = CAI.getUserChars();
            var have = false;
            for (var i = 0; i < myChars.length; i++) if (myChars[i].id === c.id) { have = true; break; }
            var actDiv = document.createElement('div'); actDiv.style.marginTop = '8px';
            var actBtn = document.createElement('button');
            if (have) {
                actBtn.className = 'classic-btn'; actBtn.appendChild(document.createTextNode('Chat'));
                (function(cid) { actBtn.onclick = function() { nav('messenger'); selectChar(cid); }; })(c.id);
            } else {
                actBtn.className = 'classic-btn success'; actBtn.appendChild(document.createTextNode('Add'));
                (function(cid) { actBtn.onclick = function() { addPublicCharToMine(cid); }; })(c.id);
            }
            actDiv.appendChild(actBtn); card.appendChild(actDiv);
            charGrid.appendChild(card);
        });
    }
    pad.appendChild(charGrid);
    content.appendChild(pad);

    // switch to profile view
    var views = document.querySelectorAll('.view');
    for (var i = 0; i < views.length; i++) views[i].className = views[i].className.replace(' active', '');
    document.getElementById('profile-view').className += ' active';
    var navLinks = document.querySelectorAll('.nav-link');
    for (var j = 0; j < navLinks.length; j++) navLinks[j].className = navLinks[j].className.replace(' active','');
}

function showFollowersList(username, type) {
    var list = type === 'followers' ? CAI.getFollowers(username) : CAI.getFollowing(username);
    var titleEl = document.getElementById('followers-modal-title');
    clearEl(titleEl); titleEl.appendChild(document.createTextNode((type === 'followers' ? 'Followers' : 'Following') + ' - ' + username));
    var el = document.getElementById('followers-list');
    clearEl(el);
    if (!list.length) {
        el.innerHTML = '<div style="padding:8px;color:#888;font-style:italic;">Nobody here yet.</div>';
    } else {
        list.forEach(function(u) {
            var row = document.createElement('div'); row.className = 'user-row';
            row.appendChild(makeUserAvatarEl(u, 28));
            var nm = document.createElement('span');
            nm.style.cssText = 'flex:1;cursor:pointer;color:#0033AA;text-decoration:underline;';
            nm.appendChild(document.createTextNode(u));
            (function(un) { nm.onclick = function() { closeModals(); viewProfile(un); }; })(u);
            row.appendChild(nm);
            el.appendChild(row);
        });
    }
    document.getElementById('modal-followers').style.display = 'flex';
}

// ---- GLOBAL SEARCH ----
function liveSearch(query) {
    var dd = document.getElementById('search-dropdown');
    query = (query || '').replace(/^\s+|\s+$/g, '').toLowerCase();
    if (!query) { closeSearch(); return; }

    var db = CAI.getPublicDB();
    var matchChars = [];
    for (var k in db) {
        if (!db.hasOwnProperty(k)) continue;
        var c = db[k];
        if ((c.name||'').toLowerCase().indexOf(query) >= 0 ||
            (c.desc||'').toLowerCase().indexOf(query) >= 0 ||
            (c.ownedBy||'').toLowerCase().indexOf(query) >= 0) {
            matchChars.push(c);
            if (matchChars.length >= 6) break;
        }
    }

    var myChars = CAI.getUserChars().filter(function(c) {
        return !c.pub && ((c.name||'').toLowerCase().indexOf(query) >= 0 || (c.desc||'').toLowerCase().indexOf(query) >= 0);
    }).slice(0, 4);

    var usersDB    = CAI.getUsersDB();
    var matchUsers = Object.keys(usersDB).filter(function(u) { return u.toLowerCase().indexOf(query) >= 0; }).slice(0, 5);

    clearEl(dd);
    var hasAny = false;

    if (matchChars.length) {
        hasAny = true;
        var sh1 = document.createElement('div'); sh1.className = 'search-section-hdr';
        sh1.appendChild(document.createTextNode('Public Characters'));
        dd.appendChild(sh1);
        matchChars.forEach(function(c) {
            var row = document.createElement('div'); row.className = 'search-row';
            row.appendChild(makePfpEl(c, 'pfp-24'));
            var info = document.createElement('div'); info.className = 'search-row-info';
            var snm = document.createElement('strong'); snm.appendChild(document.createTextNode(c.name));
            var ssm = document.createElement('small');
            var vc = CAI.getVisitorCount(c.id);
            ssm.appendChild(document.createTextNode('by ' + (c.ownedBy||'?') + ' - ' + vc + ' visitor' + (vc!==1?'s':'')));
            info.appendChild(snm); info.appendChild(ssm); row.appendChild(info);
            (function(cid) { row.onclick = function() { closeSearch(); addPublicCharAndNav(cid); }; })(c.id);
            dd.appendChild(row);
        });
    }

    if (myChars.length) {
        hasAny = true;
        var sh2 = document.createElement('div'); sh2.className = 'search-section-hdr';
        sh2.appendChild(document.createTextNode('My Private Characters'));
        dd.appendChild(sh2);
        myChars.forEach(function(c) {
            var row = document.createElement('div'); row.className = 'search-row';
            row.appendChild(makePfpEl(c, 'pfp-24'));
            var info = document.createElement('div'); info.className = 'search-row-info';
            var snm = document.createElement('strong'); snm.appendChild(document.createTextNode(c.name));
            var ssm = document.createElement('small'); ssm.appendChild(document.createTextNode('Private - ' + (c.desc||'').substring(0,40)));
            info.appendChild(snm); info.appendChild(ssm); row.appendChild(info);
            (function(cid) { row.onclick = function() { closeSearch(); nav('messenger'); selectChar(cid); }; })(c.id);
            dd.appendChild(row);
        });
    }

    if (matchUsers.length) {
        hasAny = true;
        var sh3 = document.createElement('div'); sh3.className = 'search-section-hdr';
        sh3.appendChild(document.createTextNode('Users'));
        dd.appendChild(sh3);
        matchUsers.forEach(function(u) {
            var db2 = CAI.getPublicDB(); var cnt = 0;
            for (var k2 in db2) if (db2.hasOwnProperty(k2) && db2[k2].ownedBy===u) cnt++;
            var row = document.createElement('div'); row.className = 'search-row';
            row.appendChild(makeUserAvatarEl(u, 24));
            var info = document.createElement('div'); info.className = 'search-row-info';
            var snm = document.createElement('strong'); snm.appendChild(document.createTextNode(u));
            var ssm = document.createElement('small'); ssm.appendChild(document.createTextNode(cnt + ' characters - ' + CAI.getFollowers(u).length + ' followers'));
            info.appendChild(snm); info.appendChild(ssm); row.appendChild(info);
            (function(un) { row.onclick = function() { closeSearch(); viewProfile(un); }; })(u);
            dd.appendChild(row);
        });
    }

    if (!hasAny) {
        var nm2 = document.createElement('div'); nm2.className = 'search-no-results';
        nm2.appendChild(document.createTextNode('No results for "' + query + '"'));
        dd.appendChild(nm2);
    }

    dd.className = 'open';
    dd.style.display = 'block';
}

function closeSearch() {
    var dd = document.getElementById('search-dropdown');
    if (dd) { dd.style.display = 'none'; dd.className = ''; clearEl(dd); }
    var inp = document.getElementById('global-search-input');
    if (inp) inp.value = '';
}

function addPublicCharAndNav(charId) {
    var db = CAI.getPublicDB(); var c = db[charId]; if (!c) return;
    var myChars = CAI.getUserChars(); var have = false;
    for (var i = 0; i < myChars.length; i++) if (myChars[i].id === charId) { have = true; break; }
    if (!have) { var copy = {}; for (var k in c) if(c.hasOwnProperty(k)) copy[k]=c[k]; copy.id=charId; CAI.saveChar(copy); }
    CAI.recordVisitor(charId);
    nav('messenger'); selectChar(charId);
}

// ---- PFP UPLOAD ----
function triggerPfpUpload(prefix) { document.getElementById(prefix + '-pfp-input').click(); }
function handlePfpUpload(input, prefix) {
    if (input.files && input.files[0]) {
        var reader = new FileReader();
        reader.onload = function(e) {
            CAI.tempPfpData = e.target.result;
            var preview = document.getElementById(prefix + '-pfp-preview');
            preview.style.backgroundImage = 'url(' + CAI.tempPfpData + ')';
            preview.style.backgroundSize  = 'cover';
            clearEl(preview);
        };
        reader.readAsDataURL(input.files[0]);
    }
}

// ---- VIS RADIO CHANGE ----
function onVisChange() {
    var isPub = document.getElementById('vis-public').checked;
    var viInfo = document.getElementById('vis-info');
    clearEl(viInfo);
    viInfo.appendChild(document.createTextNode(isPub ? 'Public — appears in Discover for everyone.' : 'Private — only visible to you.'));
    if (CAI.editingId) document.getElementById('publish-btn').style.display = 'inline-block';
}

// ---- MODALS ----
function closeModals() {
    var overlays = document.querySelectorAll('.overlay');
    for (var i = 0; i < overlays.length; i++) overlays[i].style.display = 'none';
}

// ---- UTIL ----
function clearEl(el) {
    if (!el) return;
    while (el.firstChild) el.removeChild(el.firstChild);
}
