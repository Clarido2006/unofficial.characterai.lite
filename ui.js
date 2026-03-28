// ============================================================
// ui.js — SUPER ULTRA-LITE edition
// Group Chat and DM panels are hidden for performance.
// Optimised for older/slower devices.
// ============================================================

// All rendering. Data calls are async (server API).
// Creator-only edit enforced via ownedBy field.
// ============================================================

var CAI = CAI || {};

CAI.selectedCharId     = null;
CAI.editingId          = null;
CAI.tempPfpData        = null;
CAI.activePersonaId    = null;
CAI.currentProfileUser = null;
CAI._chatHistory       = [];   // in-memory cache of current chat

var pfpColors = [
    '#CC0000','#009900','#0000CC','#990099','#CC6600',
    '#009999','#444444','#336699','#994400','#006666',
    '#553388','#226644','#AA4400','#007799'
];
function pfpHash(name) {
    var h = 0; name = name || '?';
    for (var i = 0; i < name.length; i++) h = (name.charCodeAt(i) + ((h << 5) - h));
    return pfpColors[Math.abs(h) % pfpColors.length];
}
function makePfpEl(item, sizeClass) {
    var d = document.createElement('div');
    d.className = 'pfp-box ' + (sizeClass || '');
    if (item && item.pfp) {
        d.style.backgroundImage = 'url(' + item.pfp + ')';
        d.style.backgroundSize  = 'cover';
        d.style.color = 'transparent';
    } else {
        d.style.backgroundColor = pfpHash(item ? item.name : '?');
        d.appendChild(document.createTextNode(item ? (item.name||'?')[0].toUpperCase() : '?'));
    }
    return d;
}
function makeUserAvatarEl(username, size) {
    var d = document.createElement('div');
    d.className = 'user-avatar';
    if (size) { d.style.width = size+'px'; d.style.height = size+'px'; d.style.fontSize = Math.floor(size*0.45)+'px'; }
    d.style.backgroundColor = pfpHash(username);
    d.appendChild(document.createTextNode((username||'?')[0].toUpperCase()));
    return d;
}
function clearEl(el) { if (!el) return; while (el.firstChild) el.removeChild(el.firstChild); }

// ---- STATUS ----
CAI.UI = {
    setStatus: function(msg) {
        var el = document.getElementById('status-text');
        if (el) { clearEl(el); el.appendChild(document.createTextNode(msg)); }
    },
    setAIStatus: function(msg, color) {
        var el = document.getElementById('ai-status');
        if (el) { clearEl(el); el.appendChild(document.createTextNode(msg)); if (color) el.style.color = color; }
    },
    fmtDateTime: function(ts) {
        if (!ts) return '';
        var d = new Date(ts);
        var date = d.toLocaleDateString(undefined, {month:'short', day:'numeric', year:'numeric'});
        var time = d.toLocaleTimeString(undefined, {hour:'2-digit', minute:'2-digit'});
        return date + ' ' + time;
    },
    drawMsg: function(m, box) {
        var wrap = document.createElement('div'); wrap.className = 'chat-msg';
        var pfp  = makePfpEl(m.sender, 'pfp-35');
        var bubble = document.createElement('div');
        bubble.className = 'msg-bubble' + (m.role === 'user' ? ' user-bubble' : '');
        var hdr = document.createElement('div');
        hdr.className = 'msg-header ' + (m.role === 'user' ? 'user-label' : 'ai-label');
        var lbl = document.createTextNode((m.role === 'user' ? 'USER' : 'AI') + ': ' + (m.sender ? m.sender.name : '?'));
        hdr.appendChild(lbl);
        if (m.ts) {
            var ts = document.createElement('span');
            ts.style.cssText = 'font-weight:normal;color:#999;margin-left:8px;font-size:9px;';
            ts.appendChild(document.createTextNode(CAI.UI.fmtDateTime(m.ts)));
            hdr.appendChild(ts);
        }
        var txt = document.createElement('div');
        txt.innerHTML = (m.text||'').replace(/\*(.*?)\*/g, '<em class="action-text">*$1*</em>');
        bubble.appendChild(hdr); bubble.appendChild(txt);
        wrap.appendChild(pfp); wrap.appendChild(bubble);
        box.appendChild(wrap); box.scrollTop = box.scrollHeight;
    }
};

// ---- NAV ----
var NAV_MAP = { home:0, messenger:1, browse:2, 'persona-mgr':3, 'create-char':4, settings:5, admin:6 };

function nav(id) {
    var views    = document.querySelectorAll('.view');
    var navLinks = document.querySelectorAll('.nav-link');
    for (var i = 0; i < views.length; i++)    views[i].className    = views[i].className.replace(' active','');
    for (var j = 0; j < navLinks.length; j++) navLinks[j].className = navLinks[j].className.replace(' active','');
    var view = document.getElementById(id);
    if (view) view.className += ' active';
    var idx = NAV_MAP[id];
    if (idx !== undefined && navLinks[idx]) navLinks[idx].className += ' active';

    if (id === 'home')        renderHome();
    if (id === 'messenger')   renderMessenger();
    if (id === 'persona-mgr') renderPersonaList();
    if (id === 'create-char') { if (!CAI.editingId) prepareNewChar(); else reloadEditForm(); }
    if (id === 'browse')      renderBrowse();
    if (id === 'settings')    loadSettingsPage();
    if (id === 'admin')       renderAdminPanel();
}

// ---- MESSENGER SUB-TABS ----
CAI._msgTab = 'ai';

function switchMsgTab(panel) {
    CAI._msgTab = panel;
    var tabs = document.querySelectorAll('.msg-subtab');
    for (var i = 0; i < tabs.length; i++)
        tabs[i].className = 'msg-subtab' + (tabs[i].getAttribute('data-panel') === panel ? ' active' : '');
    var panels = document.querySelectorAll('.msg-panel');
    for (var j = 0; j < panels.length; j++) {
        var p = panels[j];
        p.style.display = p.getAttribute('data-panel') === panel ? 'flex' : 'none';
    }
    if (panel === 'users') renderUserChat(false);
    if (panel === 'gc')    renderGroupChat(false);
}

// ---- HOME ----
function renderHome() {
    var recents = CAI.getRecents();
    var rEl = document.getElementById('recent-list');
    var aEl = document.getElementById('all-chars-list');
    clearEl(rEl); clearEl(aEl);

    rEl.appendChild(document.createTextNode('Loading...'));

    CAI.getUserChars(function(err, chars) {
        clearEl(rEl);
        if (err) {
            var e = document.createElement('div');
            e.style.cssText = 'color:#CC0000;padding:8px;';
            e.appendChild(document.createTextNode('Error loading characters: ' + err));
            rEl.appendChild(e);
            return;
        }
        // recents
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
            recChars.forEach(function(c) { rEl.appendChild(makeCharCard(c)); });
        }

        // all chars
        if (!chars.length) {
            aEl.innerHTML = '<div class="empty-state"><h3>No Characters Yet</h3><p>Create your first AI character.</p><button class="classic-btn primary" onclick="nav(\'create-char\')">+ Create AI</button></div>';
        } else {
            chars.forEach(function(c) { aEl.appendChild(makeCharCard(c)); });
        }
    });
}

function makeCharCard(c) {
    var div = document.createElement('div');
    div.className = 'char-card'; div.style.width = '240px';
    var inner = document.createElement('div'); inner.className = 'char-card-inner';
    inner.appendChild(makePfpEl(c, 'pfp-35'));
    var info = document.createElement('div'); info.className = 'char-card-info';
    var nm = document.createElement('strong'); nm.appendChild(document.createTextNode(c.name));
    var badge = document.createElement('span');
    badge.className = 'privacy-badge ' + (c.pub ? 'badge-public' : 'badge-private');
    badge.appendChild(document.createTextNode(c.pub ? 'Public' : 'Private'));
    var sm = document.createElement('small');
    sm.appendChild(document.createTextNode((c.desc||'').substring(0,45) + ((c.desc||'').length>45?'...':'')));
    // Creator tag
    if (c.ownedBy && c.ownedBy !== CAI.currentUser) {
        var cr = document.createElement('small');
        cr.style.cssText = 'display:block;color:#888;';
        cr.appendChild(document.createTextNode('by ' + c.ownedBy));
        info.appendChild(nm); info.appendChild(badge); info.appendChild(cr); info.appendChild(sm);
    } else {
        info.appendChild(nm); info.appendChild(badge); info.appendChild(document.createElement('br')); info.appendChild(sm);
    }
    inner.appendChild(info); div.appendChild(inner);

    // Delete only if owner
    if (!c.ownedBy || c.ownedBy === CAI.currentUser) {
        var del = document.createElement('button'); del.className = 'card-del';
        del.appendChild(document.createTextNode('X'));
        (function(cid, cname) {
            del.onclick = function(e) { e.stopPropagation(); if (confirm('Delete "'+cname+'"?')) deleteCharFull(cid); };
        })(c.id, c.name);
        div.appendChild(del);
    }
    (function(cid) { div.onclick = function() { nav('messenger'); selectChar(cid); }; })(c.id);
    return div;
}

// ---- MESSENGER ----
function renderMessenger() {
    var inner = document.getElementById('contact-list-inner');
    clearEl(inner);
    var loading = document.createElement('div');
    loading.style.cssText = 'padding:8px;color:#666;font-style:italic;font-size:11px;';
    loading.appendChild(document.createTextNode('Loading...'));
    inner.appendChild(loading);

    CAI.getUserChars(function(err, chars) {
        clearEl(inner);
        if (!chars || !chars.length) {
            var em = document.createElement('div');
            em.style.cssText = 'padding:10px;color:#666;font-style:italic;font-size:11px;';
            em.appendChild(document.createTextNode('No characters. Create one or find public ones in Discover.'));
            inner.appendChild(em);
            loadChatHistory(null, []);
            return;
        }
        chars.forEach(function(c) {
            var row = document.createElement('div');
            row.className = 'contact-row' + (c.id === CAI.selectedCharId ? ' active' : '');
            row.appendChild(makePfpEl(c, 'pfp-24'));
            var nm = document.createElement('span'); nm.className = 'contact-name';
            nm.appendChild(document.createTextNode(c.name));
            row.appendChild(nm);
            // show creator badge if not owned by current user
            if (c.ownedBy && c.ownedBy !== CAI.currentUser) {
                var cr = document.createElement('span');
                cr.style.cssText = 'font-size:9px;color:#888;';
                cr.appendChild(document.createTextNode(c.ownedBy));
                row.appendChild(cr);
            }
            if (!c.ownedBy || c.ownedBy === CAI.currentUser) {
                var del = document.createElement('button'); del.className = 'contact-del';
                del.appendChild(document.createTextNode('X'));
                (function(cid, cname) {
                    del.onclick = function(e) { e.stopPropagation(); if (confirm('Delete '+cname+'?')) deleteCharFull(cid); };
                })(c.id, c.name);
                row.appendChild(del);
            }
            (function(cid) { row.onclick = function() { selectChar(cid); }; })(c.id);
            inner.appendChild(row);
        });
        if (!CAI.selectedCharId && chars.length) selectChar(chars[0].id);
        else if (CAI.selectedCharId) {
            // find char and reload
            var found = null;
            for (var i = 0; i < chars.length; i++) if (chars[i].id === CAI.selectedCharId) { found = chars[i]; break; }
            if (found) updateChatHeader(found);
        }
        // Restore the active messenger sub-tab
        switchMsgTab(CAI._msgTab || 'ai');
    });
}

function selectChar(id) {
    CAI.getUserChars(function(err, chars) {
        var char = null;
        for (var i = 0; i < chars.length; i++) if (chars[i].id === id) { char = chars[i]; break; }
        if (!char) { loadChatHistory(null, []); return; }

        CAI.selectedCharId = id;
        var rec = CAI.getRecents();
        rec = [id].concat(rec.filter(function(r) { return r !== id; })).slice(0, 20);
        CAI.saveRecents(rec);

        // update active row
        var rows = document.querySelectorAll('.contact-row');
        for (var j = 0; j < rows.length; j++) {
            var nm = rows[j].querySelector('.contact-name');
            rows[j].className = (nm && nm.firstChild && nm.firstChild.nodeValue === char.name) ? 'contact-row active' : 'contact-row';
        }

        updateChatHeader(char);

        // visitor count
        if (char.pub || char.ownedBy !== CAI.currentUser) {
            CAI.recordVisitor(id, function(err, d) {
                var vcEl = document.getElementById('chat-visitor-count');
                if (vcEl && d) {
                    clearEl(vcEl);
                    vcEl.appendChild(document.createTextNode((d.count||0) + ' visitor' + ((d.count||0)!==1?'s':'')));
                    vcEl.style.display = 'inline-block';
                }
            });
        } else {
            var vcEl2 = document.getElementById('chat-visitor-count');
            if (vcEl2) vcEl2.style.display = 'none';
        }

        CAI.getChat(id, function(err, history) {
            CAI._chatHistory = history || [];
            loadChatHistory(char, CAI._chatHistory);
        });
    });
}

function updateChatHeader(char) {
    var hPfp = document.getElementById('chat-header-pfp'); clearEl(hPfp);
    if (char.pfp) { hPfp.style.backgroundImage = 'url('+char.pfp+')'; hPfp.style.backgroundSize='cover'; }
    else { hPfp.style.backgroundImage='none'; hPfp.style.backgroundColor=pfpHash(char.name); hPfp.appendChild(document.createTextNode(char.name[0].toUpperCase())); }

    var hn = document.getElementById('chat-header-name'); clearEl(hn); hn.appendChild(document.createTextNode(char.name));
    var hd = document.getElementById('chat-header-desc'); clearEl(hd); hd.appendChild(document.createTextNode((char.desc||'').substring(0,80)));

    // Edit AI button — only for creator
    var editBtn = document.getElementById('edit-ai-btn');
    if (editBtn) editBtn.style.display = (!char.ownedBy || char.ownedBy === CAI.currentUser) ? 'inline-block' : 'none';
}

function loadChatHistory(char, history) {
    var box = document.getElementById('chat-history'); clearEl(box);
    if (!char) { box.innerHTML = '<div class="empty-state"><p>Select a character to start chatting.</p></div>'; return; }
    if (!history || !history.length) {
        // show greeting
        var greetMsg = { sender: char, text: char.greet || 'Hello! I am ' + char.name + '. How can I help?', role: 'ai' };
        CAI.UI.drawMsg(greetMsg, box);
        // save greeting to history
        CAI._chatHistory = [greetMsg];
        CAI.saveChat(char.id, CAI._chatHistory);
    } else {
        for (var i = 0; i < history.length; i++) CAI.UI.drawMsg(history[i], box);
    }
}

function sendChatMessage() {
    if (CAI.isAITyping) return;
    var input = document.getElementById('chat-input');
    var text  = (input.value||'').replace(/^\s+|\s+$/g,'');
    if (!text || !CAI.selectedCharId) return;

    CAI.getUserPersonas(function(err, personas) {
        var user = null;
        for (var i = 0; i < personas.length; i++) if (personas[i].id === CAI.activePersonaId) { user = personas[i]; break; }
        if (!user && personas.length) user = personas[0];
        if (!user) user = { id:'u', name: CAI.currentUser, desc:'A user.', pfp:null };

        CAI.getUserChars(function(err2, chars) {
            var char = null;
            for (var i = 0; i < chars.length; i++) if (chars[i].id === CAI.selectedCharId) { char = chars[i]; break; }
            if (!char) return;

            var userMsg = { sender: user, text: text, role: 'user', ts: Date.now() };
            CAI._chatHistory.push(userMsg);
            CAI.saveChat(CAI.selectedCharId, CAI._chatHistory);
            var box = document.getElementById('chat-history');
            if (box) CAI.UI.drawMsg(userMsg, box);
            input.value = '';

            CAI.callAI(char, user, text, CAI.selectedCharId, CAI._chatHistory.slice(0,-1), function() {
                // reload chat from server to get AI reply in history
                CAI.getChat(CAI.selectedCharId, function(err3, h) { CAI._chatHistory = h || []; });
            });
        });
    });
}

function resetCurrentChat() {
    if (!CAI.selectedCharId) return;
    CAI.getUserChars(function(err, chars) {
        var char = null;
        for (var i = 0; i < chars.length; i++) if (chars[i].id === CAI.selectedCharId) { char = chars[i]; break; }
        if (!char) return;
        if (!confirm('Reset chat with ' + char.name + '?')) return;
        CAI.saveChat(CAI.selectedCharId, [], function() {
            CAI._chatHistory = [];
            loadChatHistory(char, []);
        });
    });
}

// ---- PERSONAS ----
function renderPersonaList() {
    var container = document.getElementById('persona-list-container');
    clearEl(container);
    var loading = document.createElement('div');
    loading.style.cssText = 'padding:8px;color:#666;';
    loading.appendChild(document.createTextNode('Loading...'));
    container.appendChild(loading);

    CAI.getUserPersonas(function(err, personas) {
        clearEl(container);
        if (!personas.length) {
            container.innerHTML = '<div class="empty-state"><p>No personas yet.</p></div>';
            return;
        }
        personas.forEach(function(p) {
            var div = document.createElement('div'); div.className = 'persona-card';
            div.appendChild(makePfpEl(p, 'pfp-50'));
            var info = document.createElement('div'); info.style.flex = '1';
            var nm = document.createElement('strong'); nm.appendChild(document.createTextNode(p.name));
            if (p.id === CAI.activePersonaId) {
                var act = document.createElement('span');
                act.style.cssText = 'color:#009900;font-size:10px;margin-left:6px;';
                act.appendChild(document.createTextNode('[Active]'));
                nm.appendChild(act);
            }
            var sm = document.createElement('small'); sm.style.color='#666'; sm.appendChild(document.createTextNode(p.desc||''));
            info.appendChild(nm); info.appendChild(document.createElement('br')); info.appendChild(sm);
            div.appendChild(info);

            var useBtn = document.createElement('button'); useBtn.className='classic-btn'; useBtn.appendChild(document.createTextNode('Use'));
            (function(pid) { useBtn.onclick = function() { CAI.activePersonaId = pid; CAI.lsSet('activePersona_' + CAI.currentUser, pid); renderPersonaList(); }; })(p.id);
            var editBtn = document.createElement('button'); editBtn.className='classic-btn'; editBtn.appendChild(document.createTextNode('Edit'));
            (function(pid) { editBtn.onclick = function() { openPersonaEditor(pid); }; })(p.id);
            var delBtn = document.createElement('button'); delBtn.className='classic-btn danger'; delBtn.appendChild(document.createTextNode('Del'));
            (function(pid) {
                delBtn.onclick = function() {
                    if (confirm('Delete persona?')) CAI.deletePersonaLocal(pid, function() { renderPersonaList(); });
                };
            })(p.id);
            div.appendChild(useBtn); div.appendChild(editBtn); div.appendChild(delBtn);
            container.appendChild(div);
        });
    });
}

function openPersonaEditor(id) {
    id = id || null; CAI.editingId = id; CAI.tempPfpData = null;
    document.getElementById('modal-persona').style.display = 'flex';
    var preview = document.getElementById('p-pfp-preview');
    if (id) {
        CAI.getUserPersonas(function(err, personas) {
            var p = null;
            for (var i = 0; i < personas.length; i++) if (personas[i].id === id) { p = personas[i]; break; }
            if (p) {
                document.getElementById('p-name-in').value = p.name||'';
                document.getElementById('p-desc-in').value = p.desc||'';
                if (p.pfp) { preview.style.backgroundImage='url('+p.pfp+')'; preview.style.backgroundSize='cover'; clearEl(preview); }
                else { preview.style.backgroundImage='none'; clearEl(preview); preview.appendChild(document.createTextNode('Click to Upload')); }
            }
        });
    } else {
        document.getElementById('p-name-in').value = '';
        document.getElementById('p-desc-in').value = '';
        preview.style.backgroundImage = 'none'; clearEl(preview); preview.appendChild(document.createTextNode('Click to Upload'));
    }
}

function savePersona() {
    var name = (document.getElementById('p-name-in').value||'').replace(/^\s+|\s+$/g,'');
    var desc = (document.getElementById('p-desc-in').value||'').replace(/^\s+|\s+$/g,'');
    if (!name) { alert('Please enter a name.'); return; }
    if (CAI.editingId) {
        CAI.getUserPersonas(function(err, personas) {
            for (var i = 0; i < personas.length; i++) {
                if (personas[i].id === CAI.editingId) {
                    personas[i].name = name; personas[i].desc = desc;
                    if (CAI.tempPfpData) personas[i].pfp = CAI.tempPfpData;
                    CAI.savePersonaItem(personas[i], function() { closeModals(); renderPersonaList(); });
                    return;
                }
            }
        });
    } else {
        var np = { id:'p'+Date.now(), name:name, desc:desc, pfp:CAI.tempPfpData };
        CAI.savePersonaItem(np, function() {
            if (!CAI.activePersonaId) { CAI.activePersonaId = np.id; CAI.lsSet('activePersona_' + CAI.currentUser, np.id); }
            closeModals(); renderPersonaList();
        });
    }
}

// ---- CREATE / EDIT CHARACTER ----
function prepareNewChar() {
    // If openCharEditor already populated the form, don't wipe it
    if (CAI.editingId) return;
    CAI.tempPfpData = null;
    var titleEl = document.getElementById('char-form-title');
    clearEl(titleEl); titleEl.appendChild(document.createTextNode('Create Character'));
    document.getElementById('c-name-in').value  = '';
    document.getElementById('c-greet-in').value = '';
    document.getElementById('c-desc-in').value  = '';
    document.getElementById('vis-private').checked = true;
    var visInfo = document.getElementById('vis-info'); clearEl(visInfo);
    visInfo.appendChild(document.createTextNode('Private - only visible to you.'));
    document.getElementById('publish-btn').style.display = 'none';
    // Reset save button label
    var saveBtn = document.getElementById('save-char-btn');
    if (saveBtn) { clearEl(saveBtn); saveBtn.appendChild(document.createTextNode('Save Character')); }
    var preview = document.getElementById('c-pfp-preview');
    preview.style.backgroundImage='none'; preview.style.backgroundSize=''; clearEl(preview);
    preview.appendChild(document.createTextNode('Click to Upload'));
}

function saveCharacter() {
    var name  = (document.getElementById('c-name-in').value||'').replace(/^\s+|\s+$/g,'');
    var greet = (document.getElementById('c-greet-in').value||'').replace(/^\s+|\s+$/g,'');
    var desc  = (document.getElementById('c-desc-in').value||'').replace(/^\s+|\s+$/g,'');
    var isPub = document.getElementById('vis-public').checked;
    if (!name) { alert('Please enter a character name.'); return; }

    if (CAI.editingId) {
        CAI.getUserChars(function(err, chars) {
            for (var i = 0; i < chars.length; i++) {
                if (chars[i].id === CAI.editingId) {
                    // Enforce creator-only edit
                    if (chars[i].ownedBy && chars[i].ownedBy !== CAI.currentUser) {
                        alert('You can only edit characters you created.');
                        return;
                    }
                    chars[i].name=name; chars[i].greet=greet; chars[i].desc=desc; chars[i].pub=isPub;
                    if (CAI.tempPfpData) chars[i].pfp = CAI.tempPfpData;
                    CAI.saveChar(chars[i], function() {
                        CAI.selectedCharId = CAI.editingId; CAI.editingId = null; CAI.tempPfpData = null;
                        var saveBtn = document.getElementById('save-char-btn');
                        if (saveBtn) { clearEl(saveBtn); saveBtn.appendChild(document.createTextNode('Save Character')); }
                        nav('messenger'); selectChar(CAI.selectedCharId);
                    });
                    return;
                }
            }
        });
    } else {
        var newId = 'c' + Date.now();
        var newC  = { id:newId, name:name, greet:greet, desc:desc, pfp:CAI.tempPfpData, pub:isPub, ownedBy:CAI.currentUser, created:Date.now() };
        CAI.saveChar(newC, function() {
            CAI.selectedCharId = newId; CAI.editingId = null; CAI.tempPfpData = null;
            nav('messenger'); selectChar(newId);
        });
    }
}

function publishCharacter() {
    if (!CAI.editingId) { saveCharacter(); return; }
    CAI.getUserChars(function(err, chars) {
        for (var i = 0; i < chars.length; i++) {
            if (chars[i].id === CAI.editingId) {
                if (chars[i].ownedBy && chars[i].ownedBy !== CAI.currentUser) { alert('Only the creator can publish this character.'); return; }
                chars[i].pub = true;
                CAI.saveChar(chars[i], function() {
                    alert(chars[i].name + ' is now public!');
                    document.getElementById('vis-public').checked = true;
                    CAI.UI.setStatus(chars[i].name + ' published.');
                });
                return;
            }
        }
    });
}

function openCharEditor() {
    if (!CAI.selectedCharId) return;
    CAI.getUserChars(function(err, chars) {
        var c = null;
        for (var i = 0; i < chars.length; i++) if (chars[i].id === CAI.selectedCharId) { c = chars[i]; break; }
        if (!c) return;
        if (c.ownedBy && c.ownedBy !== CAI.currentUser) { alert('Only ' + c.ownedBy + ' (the creator) can edit this character.'); return; }
        CAI.editingId = c.id;
        var titleEl = document.getElementById('char-form-title'); clearEl(titleEl); titleEl.appendChild(document.createTextNode('Edit AI: ' + c.name));
        document.getElementById('c-name-in').value  = c.name  || '';
        document.getElementById('c-greet-in').value = c.greet || '';
        document.getElementById('c-desc-in').value  = c.desc  || '';
        if (c.pub) document.getElementById('vis-public').checked = true;
        else document.getElementById('vis-private').checked = true;
        var visInfo = document.getElementById('vis-info'); clearEl(visInfo);
        visInfo.appendChild(document.createTextNode(c.pub ? 'Public - visible to everyone.' : 'Private - only visible to you.'));
        var preview = document.getElementById('c-pfp-preview');
        if (c.pfp) { preview.style.backgroundImage='url('+c.pfp+')'; preview.style.backgroundSize='cover'; clearEl(preview); }
        else { preview.style.backgroundImage='none'; preview.style.backgroundSize=''; clearEl(preview); preview.appendChild(document.createTextNode('Click to Upload')); }
        CAI.tempPfpData = null;
        // Change save button to say "Submit Edit"
        var saveBtn = document.getElementById('save-char-btn');
        if (saveBtn) { clearEl(saveBtn); saveBtn.appendChild(document.createTextNode('Submit Edit')); }
        document.getElementById('publish-btn').style.display = 'inline-block';
        nav('create-char');
    });
}

function reloadEditForm() {
    var savedId = CAI.editingId;
    CAI.selectedCharId = savedId;
    openCharEditor();
}

function deleteCharFull(id) {
    CAI.getUserChars(function(err, chars) {
        var c = null;
        for (var i = 0; i < chars.length; i++) if (chars[i].id === id) { c = chars[i]; break; }
        if (!c) return;
        if (c.ownedBy && c.ownedBy !== CAI.currentUser) { alert('Only ' + c.ownedBy + ' can delete this character.'); return; }
        if (!confirm('Delete "' + c.name + '"? All chat history will be lost.')) return;
        CAI.deleteCharLocal(id, function() {
            CAI.saveRecents(CAI.getRecents().filter(function(x){return x!==id;}));
            if (CAI.selectedCharId === id) CAI.selectedCharId = null;
            renderHome(); renderMessenger();
            CAI.UI.setStatus('"' + c.name + '" deleted.');
        });
    });
}

// ---- BROWSE ----
function renderBrowse() {
    var query  = (document.getElementById('browse-search-input') ? document.getElementById('browse-search-input').value : '').toLowerCase().replace(/^\s+|\s+$/g,'');
    var sortBy = document.getElementById('browse-sort') ? document.getElementById('browse-sort').value : 'newest';
    var browseEl = document.getElementById('browse-list'); clearEl(browseEl);
    var usersEl  = document.getElementById('users-list');  clearEl(usersEl);

    browseEl.appendChild(document.createTextNode('Loading...'));

    CAI.getPublicDB(function(err, db) {
        clearEl(browseEl);
        var allChars = [];
        for (var k in db) { if (db.hasOwnProperty(k)) allChars.push(db[k]); }
        if (query) {
            allChars = allChars.filter(function(c) {
                return (c.name||'').toLowerCase().indexOf(query)>=0 || (c.ownedBy||'').toLowerCase().indexOf(query)>=0 || (c.desc||'').toLowerCase().indexOf(query)>=0;
            });
        }
        if (sortBy==='newest')   allChars.sort(function(a,b){return(b.publishedAt||0)-(a.publishedAt||0);});
        else if (sortBy==='visitors') allChars.sort(function(a,b){return(b.visitorCount||0)-(a.visitorCount||0);});
        else if (sortBy==='az')  allChars.sort(function(a,b){return(a.name||'').localeCompare(b.name||'');});

        if (!allChars.length) {
            browseEl.innerHTML = '<div class="empty-state"><p>' + (query?'No characters match your search.':'No public characters yet.') + '</p></div>';
        } else {
            allChars.forEach(function(c) { browseEl.appendChild(makePubCharCard(c)); });
        }
    });

    CAI.getAllUsers(function(err, usersDB) {
        clearEl(usersEl);
        var unames = Object.keys(usersDB).filter(function(u){return u !== CAI.currentUser;});
        if (query) unames = unames.filter(function(u){return u.toLowerCase().indexOf(query)>=0;});
        if (!unames.length) {
            var em = document.createElement('div'); em.style.cssText='color:#888;padding:8px;font-style:italic;';
            em.appendChild(document.createTextNode('No other users yet.')); usersEl.appendChild(em); return;
        }
        unames.forEach(function(u) { makeUserRow(u, function(row){usersEl.appendChild(row);}); });
    });
}

function makePubCharCard(c) {
    var div = document.createElement('div'); div.className = 'pub-char-card';
    div.appendChild(makePfpEl(c, 'pfp-50'));
    var info = document.createElement('div'); info.className = 'pub-char-info';
    var h3 = document.createElement('h3'); h3.appendChild(document.createTextNode(c.name)); info.appendChild(h3);
    var auth = document.createElement('div'); auth.className='author';
    auth.appendChild(document.createTextNode('by '));
    var alink = document.createElement('span');
    alink.style.cssText='color:#0033AA;cursor:pointer;text-decoration:underline;';
    alink.appendChild(document.createTextNode(c.ownedBy||'unknown'));
    (function(u){alink.onclick=function(){viewProfile(u);};})(c.ownedBy||'');
    auth.appendChild(alink);
    auth.appendChild(document.createTextNode(' - '+new Date(c.publishedAt||0).toLocaleDateString()));
    info.appendChild(auth);
    var desc = document.createElement('div'); desc.className='desc';
    desc.appendChild(document.createTextNode((c.desc||'').substring(0,100))); info.appendChild(desc);
    var vc = c.visitorCount || 0;
    var vbadge = document.createElement('span'); vbadge.className='visitor-badge';
    vbadge.appendChild(document.createTextNode(vc+' visitor'+(vc!==1?'s':''))); info.appendChild(document.createElement('br')); info.appendChild(vbadge);
    div.appendChild(info);

    var actions = document.createElement('div'); actions.className='pub-char-actions';
    CAI.getUserChars(function(err, myChars) {
        var have = false;
        for (var i=0;i<myChars.length;i++) if (myChars[i].id===c.id){have=true;break;}
        var actionBtn = document.createElement('button');
        if (have) {
            actionBtn.className='classic-btn'; actionBtn.appendChild(document.createTextNode('Chat'));
            (function(cid){actionBtn.onclick=function(){nav('messenger');selectChar(cid);};})(c.id);
        } else {
            actionBtn.className='classic-btn success'; actionBtn.appendChild(document.createTextNode('Add + Chat'));
            (function(cid){actionBtn.onclick=function(){addPublicChar(cid);};})(c.id);
        }
        actions.appendChild(actionBtn);
    });
    var profBtn = document.createElement('button'); profBtn.className='classic-btn';
    profBtn.appendChild(document.createTextNode('Profile'));
    (function(u){profBtn.onclick=function(){viewProfile(u);};})(c.ownedBy||'');
    actions.appendChild(profBtn);
    div.appendChild(actions);
    return div;
}

function makeUserRow(u, cb) {
    CAI.getPublicDB(function(err, db) {
        var pubCount = 0;
        for (var k in db) if (db.hasOwnProperty(k)&&db[k].ownedBy===u) pubCount++;
        CAI.isFollowing(u, function(following) {
            CAI.getFollowers(u, function(err2, followers) {
                var div = document.createElement('div'); div.className='user-row';
                div.appendChild(makeUserAvatarEl(u, 32));
                var info = document.createElement('div'); info.style.flex='1';
                var nm = document.createElement('strong'); nm.style.cssText='cursor:pointer;color:#0033AA;text-decoration:underline;';
                nm.appendChild(document.createTextNode(u));
                (function(un){nm.onclick=function(){viewProfile(un);};})(u);
                var sm = document.createElement('small'); sm.style.cssText='display:block;font-size:10px;color:#666;';
                sm.appendChild(document.createTextNode(pubCount+' public char'+(pubCount!==1?'s':'')+' - '+(followers.length)+' followers'));
                info.appendChild(nm); info.appendChild(sm); div.appendChild(info);

                var fBtn = document.createElement('button');
                fBtn.className = 'classic-btn' + (following?' danger':'');
                fBtn.appendChild(document.createTextNode(following?'Unfollow':'Follow'));
                (function(un, btn) {
                    btn.onclick = function() {
                        CAI.isFollowing(un, function(isF) {
                            if (isF) { CAI.unfollowUser(un, function(){makeUserRow(un,function(r){if(btn.parentNode)btn.parentNode.parentNode.replaceChild(r,btn.parentNode);});});}
                            else     { CAI.followUser(un,   function(){makeUserRow(un,function(r){if(btn.parentNode)btn.parentNode.parentNode.replaceChild(r,btn.parentNode);});});}
                        });
                    };
                })(u, fBtn);
                div.appendChild(fBtn);
                var pBtn = document.createElement('button'); pBtn.className='classic-btn';
                pBtn.appendChild(document.createTextNode('Profile'));
                (function(un){pBtn.onclick=function(){viewProfile(un);};})(u);
                div.appendChild(pBtn);
                cb(div);
            });
        });
    });
}

function addPublicChar(charId) {
    CAI.getPublicDB(function(err, db) {
        var c = db[charId]; if (!c) return;
        // Save to user's chars — keep ownedBy intact (creator stays)
        var copy = {}; for (var k in c) if(c.hasOwnProperty(k)) copy[k]=c[k];
        CAI.saveChar(copy, function() {
            CAI.recordVisitor(charId, function(){});
            nav('messenger'); selectChar(charId);
        });
    });
}

// ---- USER PROFILES ----
function viewProfile(username) {
    if (!username) return;
    CAI.currentProfileUser = username;
    var content = document.getElementById('profile-content'); clearEl(content);
    var pad = document.createElement('div'); pad.style.padding='14px';

    CAI.getPublicDB(function(err, db) {
        var pubChars = []; for (var k in db) if(db.hasOwnProperty(k)&&db[k].ownedBy===username) pubChars.push(db[k]);
        CAI.getFollowers(username, function(err2, followers) {
            CAI.getFollowing(username, function(err3, following) {
                CAI.isFollowing(username, function(amFoll) {
                    var isMe = username === CAI.currentUser;
                    var hdr  = document.createElement('div'); hdr.className='profile-header';
                    hdr.appendChild(makeUserAvatarEl(username, 60));
                    var hdrInfo = document.createElement('div'); hdrInfo.style.flex='1';
                    var h2 = document.createElement('h2'); h2.style.cssText='font-size:16px;color:#0033AA;margin-bottom:4px;';
                    h2.appendChild(document.createTextNode(username)); hdrInfo.appendChild(h2);
                    var stats = document.createElement('div'); stats.className='profile-stats';
                    function makeStatBox(num, label, clickFn) {
                        var sb = document.createElement('div'); sb.className='stat-box';
                        if (clickFn) sb.style.cursor='pointer';
                        var sn = document.createElement('span'); sn.className='stat-num'; sn.appendChild(document.createTextNode(String(num)));
                        var sl = document.createElement('span'); sl.className='stat-label'; sl.appendChild(document.createTextNode(label));
                        sb.appendChild(sn); sb.appendChild(sl);
                        if (clickFn) sb.onclick=clickFn;
                        return sb;
                    }
                    stats.appendChild(makeStatBox(pubChars.length,'Characters'));
                    stats.appendChild(makeStatBox(followers.length,'Followers',function(){showFollowersList(username,'followers',followers);}));
                    stats.appendChild(makeStatBox(following.length,'Following',function(){showFollowersList(username,'following',following);}));
                    hdrInfo.appendChild(stats);

                    if (!isMe) {
                        var fBtnWrap = document.createElement('div'); fBtnWrap.style.marginTop='10px';
                        var fBtn = document.createElement('button');
                        fBtn.className='classic-btn'+(amFoll?' danger':'');
                        fBtn.appendChild(document.createTextNode(amFoll?'Unfollow':'Follow'));
                        (function(un) {
                            fBtn.onclick = function() {
                                CAI.isFollowing(un, function(isF) {
                                    if (isF) CAI.unfollowUser(un, function(){viewProfile(un);});
                                    else CAI.followUser(un, function(){viewProfile(un);});
                                });
                            };
                        })(username);
                        fBtnWrap.appendChild(fBtn); hdrInfo.appendChild(fBtnWrap);
                    } else {
                        var meBadge = document.createElement('div'); meBadge.style.marginTop='8px';
                        var meSpan = document.createElement('span');
                        meSpan.style.cssText='background:#CCFFCC;border:1px solid #009900;color:#006600;padding:3px 8px;font-size:10px;';
                        meSpan.appendChild(document.createTextNode('This is you')); meBadge.appendChild(meSpan);
                        hdrInfo.appendChild(meBadge);
                    }
                    hdr.appendChild(hdrInfo); pad.appendChild(hdr);

                    var ct = document.createElement('div'); ct.className='section-title';
                    ct.appendChild(document.createTextNode('Public Characters by '+username)); pad.appendChild(ct);
                    var grid = document.createElement('div'); grid.className='char-grid';
                    if (!pubChars.length) {
                        var em2 = document.createElement('div'); em2.style.cssText='color:#888;font-style:italic;padding:8px;';
                        em2.appendChild(document.createTextNode('No public characters.')); grid.appendChild(em2);
                    } else {
                        pubChars.forEach(function(c) {
                            var card = document.createElement('div'); card.className='char-card'; card.style.width='240px';
                            var ci = document.createElement('div'); ci.className='char-card-inner';
                            ci.appendChild(makePfpEl(c,'pfp-35'));
                            var cinf = document.createElement('div'); cinf.className='char-card-info';
                            var cnm = document.createElement('strong'); cnm.appendChild(document.createTextNode(c.name));
                            var csm = document.createElement('small'); csm.appendChild(document.createTextNode((c.desc||'').substring(0,50)));
                            var vc = c.visitorCount||0;
                            var cvb = document.createElement('span'); cvb.className='visitor-badge';
                            cvb.appendChild(document.createTextNode(vc+' visitor'+(vc!==1?'s':'')));
                            cinf.appendChild(cnm); cinf.appendChild(document.createElement('br')); cinf.appendChild(csm); cinf.appendChild(cvb);
                            ci.appendChild(cinf); card.appendChild(ci);
                            var ab = document.createElement('button'); ab.className='classic-btn success'; ab.style.marginTop='6px';
                            ab.appendChild(document.createTextNode('Add + Chat'));
                            (function(cid){ab.onclick=function(){addPublicChar(cid);};})(c.id);
                            card.appendChild(ab); grid.appendChild(card);
                        });
                    }
                    pad.appendChild(grid);
                    content.appendChild(pad);

                    var views = document.querySelectorAll('.view');
                    for (var i=0;i<views.length;i++) views[i].className=views[i].className.replace(' active','');
                    document.getElementById('profile-view').className += ' active';
                    var navLinks = document.querySelectorAll('.nav-link');
                    for (var j=0;j<navLinks.length;j++) navLinks[j].className=navLinks[j].className.replace(' active','');
                });
            });
        });
    });
}

function showFollowersList(username, type, list) {
    var titleEl = document.getElementById('followers-modal-title');
    clearEl(titleEl); titleEl.appendChild(document.createTextNode((type==='followers'?'Followers':'Following')+' - '+username));
    var el = document.getElementById('followers-list'); clearEl(el);
    if (!list||!list.length) {
        el.innerHTML='<div style="padding:8px;color:#888;font-style:italic;">Nobody here yet.</div>'; 
    } else {
        list.forEach(function(u) {
            var row=document.createElement('div'); row.className='user-row';
            row.appendChild(makeUserAvatarEl(u,28));
            var nm=document.createElement('span'); nm.style.cssText='flex:1;cursor:pointer;color:#0033AA;text-decoration:underline;';
            nm.appendChild(document.createTextNode(u));
            (function(un){nm.onclick=function(){closeModals();viewProfile(un);};})(u);
            row.appendChild(nm); el.appendChild(row);
        });
    }
    document.getElementById('modal-followers').style.display='flex';
}

// ---- GLOBAL SEARCH ----
function liveSearch(query) {
    var dd = document.getElementById('search-dropdown');
    query = (query||'').replace(/^\s+|\s+$/g,'').toLowerCase();
    if (!query) { closeSearch(); return; }

    CAI.getPublicDB(function(err, db) {
        CAI.getUserChars(function(err2, myChars) {
            CAI.getAllUsers(function(err3, usersDB) {
                clearEl(dd);
                var matchChars = [], myPrivate = [], matchUsers = [];
                for (var k in db) {
                    if (!db.hasOwnProperty(k)) continue;
                    var c = db[k];
                    if ((c.name||'').toLowerCase().indexOf(query)>=0 || (c.desc||'').toLowerCase().indexOf(query)>=0 || (c.ownedBy||'').toLowerCase().indexOf(query)>=0) matchChars.push(c);
                    if (matchChars.length >= 6) break;
                }
                myChars.filter(function(c){return !c.pub;}).forEach(function(c){
                    if ((c.name||'').toLowerCase().indexOf(query)>=0 || (c.desc||'').toLowerCase().indexOf(query)>=0) myPrivate.push(c);
                });
                Object.keys(usersDB).forEach(function(u){if(u.toLowerCase().indexOf(query)>=0) matchUsers.push(u);});

                var hasAny = false;
                function addSection(title) {
                    var sh = document.createElement('div'); sh.className='search-section-hdr';
                    sh.appendChild(document.createTextNode(title)); dd.appendChild(sh); hasAny = true;
                }

                if (matchChars.length) {
                    addSection('Public Characters');
                    matchChars.slice(0,6).forEach(function(c) {
                        var row = document.createElement('div'); row.className='search-row';
                        row.appendChild(makePfpEl(c,'pfp-24'));
                        var info = document.createElement('div'); info.className='search-row-info';
                        var snm = document.createElement('strong'); snm.appendChild(document.createTextNode(c.name));
                        var ssm = document.createElement('small'); ssm.appendChild(document.createTextNode('by '+(c.ownedBy||'?')));
                        info.appendChild(snm); info.appendChild(ssm); row.appendChild(info);
                        (function(cid){row.onclick=function(){closeSearch();addPublicChar(cid);};})(c.id);
                        dd.appendChild(row);
                    });
                }
                if (myPrivate.length) {
                    addSection('My Private Characters');
                    myPrivate.slice(0,4).forEach(function(c) {
                        var row = document.createElement('div'); row.className='search-row';
                        row.appendChild(makePfpEl(c,'pfp-24'));
                        var info = document.createElement('div'); info.className='search-row-info';
                        var snm = document.createElement('strong'); snm.appendChild(document.createTextNode(c.name));
                        var ssm = document.createElement('small'); ssm.appendChild(document.createTextNode('Private'));
                        info.appendChild(snm); info.appendChild(ssm); row.appendChild(info);
                        (function(cid){row.onclick=function(){closeSearch();nav('messenger');selectChar(cid);};})(c.id);
                        dd.appendChild(row);
                    });
                }
                if (matchUsers.length) {
                    addSection('Users');
                    matchUsers.slice(0,5).forEach(function(u) {
                        var row=document.createElement('div'); row.className='search-row';
                        row.appendChild(makeUserAvatarEl(u,24));
                        var info=document.createElement('div'); info.className='search-row-info';
                        var snm=document.createElement('strong'); snm.appendChild(document.createTextNode(u));
                        info.appendChild(snm); row.appendChild(info);
                        (function(un){row.onclick=function(){closeSearch();viewProfile(un);};})(u);
                        dd.appendChild(row);
                    });
                }
                if (!hasAny) {
                    var nm=document.createElement('div'); nm.className='search-no-results';
                    nm.appendChild(document.createTextNode('No results for "'+query+'"')); dd.appendChild(nm);
                }
                dd.style.display='block'; dd.className='open';
            });
        });
    });
}
function closeSearch() {
    var dd = document.getElementById('search-dropdown');
    if (dd) { dd.style.display='none'; dd.className=''; clearEl(dd); }
    var inp = document.getElementById('global-search-input');
    if (inp) inp.value='';
}

// ---- PFP UPLOAD ----
function triggerPfpUpload(prefix) { document.getElementById(prefix+'-pfp-input').click(); }
function handlePfpUpload(input, prefix) {
    if (input.files && input.files[0]) {
        var reader = new FileReader();
        reader.onload = function(e) {
            CAI.tempPfpData = e.target.result;
            var preview = document.getElementById(prefix+'-pfp-preview');
            preview.style.backgroundImage='url('+CAI.tempPfpData+')'; preview.style.backgroundSize='cover'; clearEl(preview);
        };
        reader.readAsDataURL(input.files[0]);
    }
}

// ---- VIS RADIO ----
function onVisChange() {
    var isPub = document.getElementById('vis-public').checked;
    var viInfo = document.getElementById('vis-info'); clearEl(viInfo);
    viInfo.appendChild(document.createTextNode(isPub?'Public - appears in Discover for everyone.':'Private - only visible to you.'));
    if (CAI.editingId) document.getElementById('publish-btn').style.display='inline-block';
}

// ---- SETTINGS PAGE ----
function loadSettingsPage() {
    var unEl = document.getElementById('settings-username');
    if (unEl) { clearEl(unEl); unEl.appendChild(document.createTextNode(CAI.currentUser||'')); }
    var s = CAI.puterSettings.load();
    // Populate model dropdown
    var mdSel = document.getElementById('s-puter-model');
    if (mdSel) {
        clearEl(mdSel);
        CAI.PUTER_MODELS.forEach(function(m) {
            var opt = document.createElement('option');
            opt.value = m.id;
            opt.appendChild(document.createTextNode(m.label + '  [' + m.id + ']'));
            if (m.id === s.model) opt.selected = true;
            mdSel.appendChild(opt);
        });
        // If saved model isn't in list, add it
        var found = CAI.PUTER_MODELS.some(function(m){ return m.id === s.model; });
        if (!found) {
            var opt2 = document.createElement('option');
            opt2.value = s.model; opt2.selected = true;
            opt2.appendChild(document.createTextNode(s.model));
            mdSel.insertBefore(opt2, mdSel.firstChild);
        }
    }
    var hint = document.getElementById('s-models-hint');
    var res  = document.getElementById('s-test-result');
    if (hint) clearEl(hint); if (res) clearEl(res);
    var adminTab = document.getElementById('admin-nav-tab');
    if (adminTab) adminTab.style.display = CAI.isCreator() ? 'block' : 'none';
    var aiBlock = document.getElementById('ai-settings-block');
    if (aiBlock) aiBlock.style.display = 'block'; // visible to all users
}
function saveSettingsPage() {
    var sel = document.getElementById('s-puter-model');
    var mdl = sel ? sel.value : '';
    if (!mdl) { alert('Please select a model.'); return; }
    CAI.puterSettings.save(mdl);
    CAI.UI.setAIStatus('AI: Ready ('+mdl+')', '#006600');
    CAI.UI.setStatus('AI settings saved.');
    var res = document.getElementById('s-test-result');
    if (res) { clearEl(res); res.style.color='#006600'; res.appendChild(document.createTextNode('Saved!')); }
}
function fetchModelsFromSettings() {
    var hint = document.getElementById('s-models-hint');
    var sel  = document.getElementById('s-puter-model');
    clearEl(hint); hint.appendChild(document.createTextNode('Fetching all models from Puter...'));
    CAI.fetchModels(function(err, names) {
        clearEl(hint);
        if (err) { hint.appendChild(document.createTextNode('Error: ' + err)); return; }
        hint.appendChild(document.createTextNode('Found ' + names.length + ' models.'));
        if (!sel) return;
        var cur = sel.value;
        clearEl(sel);
        names.forEach(function(id) {
            var opt = document.createElement('option');
            opt.value = id; opt.appendChild(document.createTextNode(id));
            if (id === cur) opt.selected = true;
            sel.appendChild(opt);
        });
    });
}
function testConnectionFromSettings() {
    var sel = document.getElementById('s-puter-model');
    var mdl = sel ? sel.value : CAI.puterSettings.load().model;
    var res = document.getElementById('s-test-result');
    clearEl(res); res.style.color='#664400'; res.appendChild(document.createTextNode('Testing...'));
    CAI.testPuter(mdl, function(err, msg) {
        clearEl(res);
        if (err) { res.style.color='#CC0000'; res.appendChild(document.createTextNode(err)); }
        else     { res.style.color='#006600'; res.appendChild(document.createTextNode(msg)); }
    });
}

// ---- DELETE ACCOUNT ----
function confirmDeleteAccount() {
    var username = CAI.currentUser;
    if (!username) return;
    if (!confirm('DELETE ACCOUNT: '+username+'\n\nThis permanently deletes your account, all characters, personas, and chat history.\n\nAre you sure?')) return;
    if (!confirm('FINAL WARNING — this cannot be undone.\n\nContinue?')) return;
    var typed = prompt('Type DELETE to confirm:');
    if (!typed || typed.replace(/^\s+|\s+$/g,'') !== 'DELETE') { alert('Cancelled.'); return; }
    var pw = prompt('Enter your password to confirm:');
    if (!pw) { alert('Cancelled.'); return; }
    CAI.deleteAccount(username, pw, function(err) {
        if (err) { alert('Error: ' + err); return; }
        alert('Account "'+username+'" deleted.');
        CAI.clearSession(); CAI.currentUser = null; location.reload();
    });
}

// ---- MODALS ----
function closeModals() {
    var overlays = document.querySelectorAll('.overlay');
    for (var i=0;i<overlays.length;i++) overlays[i].style.display='none';
}

// ============================================================
// USER CHAT (1-on-1 DM between real users)
// ============================================================
CAI._dmPollTimer   = null;
CAI._dmOtherUser   = null;
CAI._dmConvCache   = [];

// deliveryStatus: map of msgTs -> 'sent'|'delivered'|'seen'
// We approximate: 'sent'=just posted, 'delivered'=server has it, 'seen'=other user online
CAI._dmStatus      = {};

function fmtDT(ts) {
    if (!ts) return '';
    var d = new Date(ts);
    var today = new Date();
    var isToday = d.toDateString() === today.toDateString();
    var time = d.toLocaleTimeString(undefined, {hour:'2-digit', minute:'2-digit'});
    if (isToday) return time;
    return d.toLocaleDateString(undefined, {month:'short', day:'numeric'}) + ' ' + time;
}

// UC sidebar refresh timer
CAI._ucSidebarTimer = null;

function renderUserChat(reopen) {
    // Start periodic sidebar refresh (picks up new mutual follows)
    if (CAI._ucSidebarTimer) clearInterval(CAI._ucSidebarTimer);
    CAI._ucSidebarTimer = setInterval(function() {
        if (CAI._msgTab === 'users') {
            _rebuildUCSidebar();
        } else {
            clearInterval(CAI._ucSidebarTimer);
        }
    }, 6000);
    _rebuildUCSidebar(reopen);
}

function _rebuildUCSidebar(reopen) {
    var sidebar = document.getElementById('uc-sidebar');
    if (!sidebar) return;
    clearEl(sidebar);
    var hdr = document.createElement('div'); hdr.className = 'contact-header';
    hdr.appendChild(document.createTextNode('Users (mutual follows)')); sidebar.appendChild(hdr);

    CAI.getMutualFollowers(function(mutual) {
        CAI.getOnlineUsers(function(err2, online) {
            if (!mutual.length) {
                var em = document.createElement('div');
                em.style.cssText = 'padding:10px;color:#666;font-style:italic;font-size:11px;line-height:1.5;';
                em.appendChild(document.createTextNode('No mutual follows yet. Follow someone and have them follow you back to unlock User Chat.'));
                sidebar.appendChild(em); return;
            }
            mutual.forEach(function(u) {
                var row = document.createElement('div');
                row.className = 'contact-row' + (u === CAI._dmOtherUser ? ' active' : '');
                row.id = 'uc-row-' + u;
                row.appendChild(makeUserAvatarEl(u, 26));
                var nm = document.createElement('span'); nm.className = 'contact-name';
                nm.appendChild(document.createTextNode(u)); row.appendChild(nm);
                if (online.indexOf(u) >= 0) {
                    var dot = document.createElement('span');
                    dot.style.cssText = 'display:inline-block;width:7px;height:7px;background:#00CC00;border:1px solid #006600;margin-left:4px;flex-shrink:0;';
                    row.appendChild(dot);
                }
                (function(un) { row.onclick = function() { openDM(un); }; })(u);
                sidebar.appendChild(row);
            });
            if (CAI._dmOtherUser && mutual.indexOf(CAI._dmOtherUser) >= 0 && reopen !== false) {
                openDM(CAI._dmOtherUser);
            }
        });
    });
}

function openDM(other) {
    CAI._dmOtherUser = other;
    var rows = document.querySelectorAll('#uc-sidebar .contact-row');
    for (var i=0;i<rows.length;i++)
        rows[i].className = rows[i].id==='uc-row-'+other ? 'contact-row active' : 'contact-row';

    document.getElementById('uc-placeholder').style.display = 'none';
    document.getElementById('uc-chat-area').style.display   = 'flex';

    var hdrName = document.getElementById('uc-chat-name'); clearEl(hdrName);
    hdrName.appendChild(document.createTextNode(other));

    CAI.dmMarkRead(other, function(){});
    loadDMHistory(other);

    if (CAI._dmPollTimer) clearInterval(CAI._dmPollTimer);
    CAI._dmPollTimer = setInterval(function() {
        if (CAI._dmOtherUser !== other) { clearInterval(CAI._dmPollTimer); return; }
        CAI.dmGet(other, function(err, msgs) {
            if (!err && msgs.length !== CAI._dmConvCache.length) {
                CAI._dmConvCache = msgs;
                drawDMHistory(msgs, other);
                CAI.dmMarkRead(other, function(){});
                // refresh sidebar for unread badges
                renderUserChat(false);
            }
        });
    }, 3000);
}

function loadDMHistory(other) {
    CAI.dmGet(other, function(err, msgs) {
        CAI._dmConvCache = msgs;
        drawDMHistory(msgs, other);
    });
}

// Delivery status helpers
// last message sent by me: 'sent' -> after server confirms -> 'delivered' -> if other online -> 'seen'

function drawDMHistory(msgs, other) {
    var box = document.getElementById('uc-history');
    if (!box) return;
    var atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 40;
    clearEl(box);
    if (!msgs.length) {
        var em = document.createElement('div');
        em.style.cssText = 'color:#888;font-style:italic;padding:16px;text-align:center;font-size:11px;';
        em.appendChild(document.createTextNode('No messages yet. Say hello!')); box.appendChild(em); return;
    }
    CAI.getOnlineUsers(function(err, online) {
        var lastDate = '';
        msgs.forEach(function(m, idx) {
            var isMe = m.from === CAI.currentUser;
            // Date separator
            if (m.ts) {
                var dStr = new Date(m.ts).toLocaleDateString(undefined, {weekday:'short',month:'short',day:'numeric',year:'numeric'});
                if (dStr !== lastDate) {
                    lastDate = dStr;
                    var sep = document.createElement('div');
                    sep.style.cssText = 'text-align:center;font-size:10px;color:#888;padding:6px 0;margin:4px 0;border-top:1px dashed #DDD;';
                    sep.appendChild(document.createTextNode(dStr)); box.appendChild(sep);
                }
            }
            var wrap = document.createElement('div');
            wrap.style.cssText = 'display:flex;gap:6px;margin-bottom:8px;align-items:flex-end;' + (isMe ? 'flex-direction:row-reverse;' : '');
            var av = makeUserAvatarEl(m.from, 28);
            av.style.flexShrink = '0';
            var right = document.createElement('div');
            right.style.cssText = 'display:flex;flex-direction:column;max-width:72%;' + (isMe ? 'align-items:flex-end;' : 'align-items:flex-start;');
            var bubble = document.createElement('div');
            bubble.style.cssText = 'padding:7px 11px;border:1px solid '+(isMe?'#BBCCEE':'#DDD')+';background:'+(isMe?'#EEF4FF':'#FAFAF8')+';line-height:1.5;font-size:11px;word-break:break-word;';
            var hdr = document.createElement('div');
            hdr.style.cssText = 'font-weight:bold;font-size:10px;margin-bottom:2px;color:'+(isMe?'#0033CC':'#444');
            hdr.appendChild(document.createTextNode(m.from));
            if (m.ts) {
                var ts = document.createElement('span');
                ts.style.cssText = 'font-weight:normal;color:#AAA;margin-left:6px;font-size:9px;';
                ts.appendChild(document.createTextNode(fmtDT(m.ts)));
                hdr.appendChild(ts);
            }
            var txt = document.createElement('div');
            txt.appendChild(document.createTextNode(m.text));
            bubble.appendChild(hdr); bubble.appendChild(txt);
            right.appendChild(bubble);

            // ---- Seen / Delivered / Sent indicator — only on last message sent by me ----
            if (isMe && idx === msgs.length - 1) {
                // Determine status
                var hasReply = false;
                for (var k = idx + 1; k < msgs.length; k++) { if (msgs[k].from !== CAI.currentUser) { hasReply = true; break; } }
                var otherOnline = online && online.indexOf(other) >= 0;
                var status = hasReply ? 'seen' : (otherOnline ? 'delivered' : 'sent');

                var statusRow = document.createElement('div');
                statusRow.style.cssText = 'display:flex;align-items:center;gap:3px;margin-top:3px;' + (isMe ? 'justify-content:flex-end;' : '');

                if (status === 'seen') {
                    // Their pfp = they saw it
                    var seenAv = makeUserAvatarEl(other, 16); seenAv.title = 'Seen by ' + other;
                    var seenLbl = document.createElement('span'); seenLbl.style.cssText = 'font-size:9px;color:#009900;font-weight:bold;';
                    seenLbl.appendChild(document.createTextNode('Seen'));
                    statusRow.appendChild(seenAv); statusRow.appendChild(seenLbl);
                } else if (status === 'delivered') {
                    // My pfp = message reached server, other user is online
                    var delAv = makeUserAvatarEl(CAI.currentUser, 16); delAv.style.opacity = '0.6';
                    var delLbl = document.createElement('span'); delLbl.style.cssText = 'font-size:9px;color:#0055AA;';
                    delLbl.appendChild(document.createTextNode('Delivered'));
                    statusRow.appendChild(delAv); statusRow.appendChild(delLbl);
                } else {
                    // My pfp faded = sent but other not online yet
                    var sentAv = makeUserAvatarEl(CAI.currentUser, 14); sentAv.style.opacity = '0.35';
                    var sentLbl = document.createElement('span'); sentLbl.style.cssText = 'font-size:9px;color:#AAA;';
                    sentLbl.appendChild(document.createTextNode('Sent'));
                    statusRow.appendChild(sentAv); statusRow.appendChild(sentLbl);
                }
                right.appendChild(statusRow);
            }

            wrap.appendChild(av); wrap.appendChild(right);
            box.appendChild(wrap);
        });
        if (atBottom) box.scrollTop = box.scrollHeight;
    });
}

function sendDMMessage() {
    var input = document.getElementById('uc-input');
    var text  = (input.value||'').replace(/^\s+|\s+$/g,'');
    if (!text || !CAI._dmOtherUser) return;
    input.value = '';
    CAI.dmSend(CAI._dmOtherUser, text, function() {
        loadDMHistory(CAI._dmOtherUser);
    });
}

// ============================================================
// GROUP CHAT — 3 modes: users-only, bots-only, users+bots
// ============================================================
CAI._gcMode       = 'mixed';
CAI._gcPollTimer  = null;
CAI._gcBotIds     = [];
CAI._gcLastCounts = { users:0, bots:0, mixed:0 };
CAI._gcBotRunning = false;
CAI._gcBotQueue   = [];
CAI._gcInitDone   = { users:false, bots:false, mixed:false };

function renderGroupChat(forceReinit) {
    // Only switch sub-tab highlight + load history if not yet done
    switchGCMode(CAI._gcMode || 'mixed', forceReinit);
}

function switchGCMode(mode, forceReinit) {
    CAI._gcMode = mode;
    var tabs = document.querySelectorAll('.gc-subtab');
    for (var i=0;i<tabs.length;i++)
        tabs[i].className = 'gc-subtab' + (tabs[i].getAttribute('data-mode')===mode?' active':'');
    var panels = document.querySelectorAll('.gc-panel');
    for (var j=0;j<panels.length;j++)
        panels[j].style.display = panels[j].getAttribute('data-panel')===mode ? 'flex' : 'none';

    if (mode === 'users')  initGCUsers(forceReinit);
    if (mode === 'bots')   initGCBots(forceReinit);
    if (mode === 'mixed')  initGCMixed(forceReinit);
}

// helper: format msg date+time for GC
function gcFmtDT(ts) { return fmtDT(ts); }

// ---- GC: Users Only ----
function initGCUsers(force) {
    if (!force && CAI._gcInitDone.users) return;  // already loaded — don't wipe
    CAI._gcInitDone.users = true;
    loadGCHistory('users');
    if (CAI._gcPollTimer) clearInterval(CAI._gcPollTimer);
    CAI._gcPollTimer = setInterval(function() {
        if (CAI._gcMode !== 'users') { clearInterval(CAI._gcPollTimer); return; }
        CAI.gcGet('users', function(err, msgs) {
            if (!err && msgs.length !== CAI._gcLastCounts.users) {
                CAI._gcLastCounts.users = msgs.length;
                drawGCHistory('users', msgs);
            }
        });
    }, 3000);
}

function sendGCUserMsg() {
    var input = document.getElementById('gc-users-input');
    var text  = (input.value||'').replace(/^\s+|\s+$/g,'');
    if (!text) return;
    input.value = '';
    CAI.getUserPersonas(function(err, personas) {
        var user = null;
        for (var i=0;i<personas.length;i++) if (personas[i].id===CAI.activePersonaId){user=personas[i];break;}
        if (!user && personas.length) user=personas[0];
        var senderName = user ? user.name : CAI.currentUser;
        CAI.gcPost('users', senderName, text, 'user', function() { loadGCHistory('users'); });
    });
}

// ---- GC: Bots Only ----
function initGCBots(force) {
    if (!force && CAI._gcInitDone.bots) return;
    CAI._gcInitDone.bots = true;
    loadGCHistory('bots');
    renderGCBotList();
    refreshBotResponderDropdown('bots');
}

function renderGCBotList() {
    CAI.getUserChars(function(err, chars) {
        var list = document.getElementById('gc-bots-picker'); clearEl(list);
        if (!chars.length) { list.innerHTML='<div style="padding:6px;color:#888;font-size:10px;">No characters yet.</div>'; return; }
        chars.forEach(function(c) {
            var row=document.createElement('div'); row.style.cssText='display:flex;align-items:center;gap:6px;padding:5px 4px;border-bottom:1px solid #DDD;cursor:pointer;';
            var chk=document.createElement('input'); chk.type='checkbox'; chk.checked=CAI._gcBotIds.indexOf(c.id)>=0;
            (function(cid,cb){ cb.onchange=function(){
                var idx=CAI._gcBotIds.indexOf(cid);
                if(cb.checked&&idx<0) CAI._gcBotIds.push(cid);
                else if(!cb.checked&&idx>=0) CAI._gcBotIds.splice(idx,1);
            }; })(c.id,chk);
            var nm=document.createElement('span'); nm.style.fontSize='11px'; nm.appendChild(document.createTextNode(c.name));
            row.appendChild(chk); row.appendChild(makePfpEl(c,'pfp-24')); row.appendChild(nm);
            list.appendChild(row);
        });
    });
}

function startBotConversation() {
    var input=document.getElementById('gc-bots-topic');
    var topic=(input.value||'').replace(/^\s+|\s+$/g,'');
    if (!topic) { alert('Enter a starting topic or message.'); return; }
    if (CAI._gcBotRunning) { alert('Bots are still chatting. Wait or clear the chat.'); return; }
    var sel = document.getElementById('gc-bots-responder');
    var pickedBotId = sel ? sel.value : '';
    if (!pickedBotId && CAI._gcBotIds.length < 2) { alert('Select at least 2 bots.'); return; }
    input.value='';
    var savedIds = CAI._gcBotIds.slice();
    if (pickedBotId) CAI._gcBotIds = [pickedBotId];
    CAI.gcPost('bots', 'System', 'Topic: ' + topic, 'system', function() {
        loadGCHistory('bots', function(){
            runBotConversation(topic, 0);
            setTimeout(function(){ CAI._gcBotIds = savedIds; }, 200);
        });
    });
}

function runBotConversation(topic, turn) {
    if (turn >= CAI._gcBotIds.length * 2) return;
    CAI._gcBotRunning = true;
    CAI.getUserChars(function(err, chars) {
        var bots = CAI._gcBotIds.map(function(bid){
            for(var i=0;i<chars.length;i++) if(chars[i].id===bid) return chars[i]; return null;
        }).filter(Boolean);
        if (!bots.length) { CAI._gcBotRunning=false; return; }
        var bot = bots[turn % bots.length];
        var otherNames = bots.filter(function(b){return b.id!==bot.id;}).map(function(b){return b.name;});
        CAI.gcGet('bots', function(err2, msgs) {
            // Build history: alternate user/assistant without name labels in content
            // This prevents the AI from echoing "Name: ..." prefixes
            var history = [];
            msgs.slice(-10).forEach(function(m) {
                if (m.role === 'system') return;
                history.push({
                    role: (m.role === 'ai' && m.sender === bot.name) ? 'assistant' : 'user',
                    content: m.text
                });
            });
            history.unshift({ role:'system', content: CAI.buildGCBotSystem(bot, topic, otherNames) });
            history.push({ role:'user', content: 'Continue the group conversation.' });
            callGCBot(bot, history, 'bots', function(reply) {
                loadGCHistory('bots', function(){ CAI._gcBotRunning=false; runBotConversation(topic, turn+1); });
            });
        });
    });
}

// ---- GC: Users + Bots (mixed) ----
function initGCMixed(force) {
    var firstLoad = !CAI._gcInitDone.mixed;
    if (!force && !firstLoad) {
        // Just re-render bot list (checkboxes) without wiping history
        renderGCMixedBotList();
        renderGCMixedUsersList();
        refreshBotResponderDropdown('mixed');
        return;
    }
    CAI._gcInitDone.mixed = true;
    loadGCHistory('mixed');
    renderGCMixedBotList();
    renderGCMixedUsersList();
    refreshBotResponderDropdown('mixed');
    if (CAI._gcPollTimer) clearInterval(CAI._gcPollTimer);
    CAI._gcPollTimer = setInterval(function() {
        if (CAI._gcMode !== 'mixed') { clearInterval(CAI._gcPollTimer); return; }
        CAI.gcGet('mixed', function(err, msgs) {
            if (!err && msgs.length !== CAI._gcLastCounts.mixed) {
                CAI._gcLastCounts.mixed = msgs.length;
                drawGCHistory('mixed', msgs);
            }
        });
    }, 3000);
}

function renderGCMixedBotList() {
    CAI.getUserChars(function(err, chars) {
        var sel=document.getElementById('gc-mixed-bots-select'); clearEl(sel);
        chars.forEach(function(c) {
            var row=document.createElement('div'); row.style.cssText='display:flex;align-items:center;gap:5px;padding:4px;border-bottom:1px solid #DDD;font-size:11px;';
            var chk=document.createElement('input'); chk.type='checkbox'; chk.checked=CAI._gcBotIds.indexOf(c.id)>=0;
            (function(cid,cb){ cb.onchange=function(){
                var idx=CAI._gcBotIds.indexOf(cid);
                if(cb.checked&&idx<0) CAI._gcBotIds.push(cid);
                else if(!cb.checked&&idx>=0) CAI._gcBotIds.splice(idx,1);
            }; })(c.id,chk);
            var nm=document.createElement('span'); nm.appendChild(document.createTextNode(c.name));
            row.appendChild(chk); row.appendChild(nm); sel.appendChild(row);
        });
    });
}

function sendGCMixedMsg() {
    var input=document.getElementById('gc-mixed-input');
    var text=(input.value||'').replace(/^\s+|\s+$/g,'');
    if (!text) return;
    input.value='';
    var sel = document.getElementById('gc-mixed-responder');
    var pickedBotId = sel ? sel.value : '';
    var savedIds = CAI._gcBotIds.slice();
    if (pickedBotId) CAI._gcBotIds = [pickedBotId];
    CAI.getUserPersonas(function(err, personas) {
        var user=null;
        for(var i=0;i<personas.length;i++) if(personas[i].id===CAI.activePersonaId){user=personas[i];break;}
        if(!user&&personas.length) user=personas[0];
        var senderName = user ? user.name : CAI.currentUser;
        CAI.gcPost('mixed', senderName, text, 'user', function() {
            loadGCHistory('mixed', function(){
                if (!CAI._gcBotIds.length) { CAI._gcBotIds = savedIds; return; }
                runMixedBots(senderName, text);
                setTimeout(function(){ CAI._gcBotIds = savedIds; }, 200);
            });
        });
    });
}

function runMixedBots(senderName, userText) {
    if (CAI._gcBotRunning) return;
    CAI.getUserChars(function(err, chars) {
        var bots=CAI._gcBotIds.map(function(bid){
            for(var i=0;i<chars.length;i++) if(chars[i].id===bid) return chars[i]; return null;
        }).filter(Boolean);
        if (!bots.length) return;
        CAI._gcBotQueue = bots.slice();
        function nextBot() {
            if (!CAI._gcBotQueue.length) { CAI._gcBotRunning=false; return; }
            CAI._gcBotRunning=true;
            var bot=CAI._gcBotQueue.shift();
            CAI.gcGet('mixed', function(err2, msgs) {
                var history = [];
                msgs.slice(-10).forEach(function(m) {
                    if (m.role === 'system') return;
                    history.push({
                        role: (m.role === 'ai' && m.sender === bot.name) ? 'assistant' : 'user',
                        content: m.text
                    });
                });
                history.unshift({role:'system', content: CAI.buildGCBotSystem(bot, null, [senderName])});
                history.push({role:'user', content: userText});
                callGCBot(bot, history, 'mixed', function(){ CAI._gcBotRunning=false; nextBot(); });
            });
        }
        nextBot();
    });
}

// Shared GC bot caller — uses Puter.ai
function callGCBot(bot, messages, kind, cb) {
    CAI.callPuterGCBot(messages, function(reply) {
        if (!reply) reply = '...';
        // Strip any role label the model might add
        reply = reply.replace(new RegExp('^\\[?'+bot.name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\]?\\s*[:\\-]\\s*','i'),'');
        reply = reply.replace(/^\[?(AI|Character|Bot|Assistant)\]?\s*[:\-]\s*/i,'');
        CAI.gcPost(kind, bot.name, reply, 'ai', function(){
            loadGCHistory(kind, function(){ if(cb) cb(reply); });
        });
    });
}

// ---- Shared GC history loader ----
function loadGCHistory(kind, cb) {
    CAI.gcGet(kind, function(err, msgs) {
        CAI._gcLastCounts[kind] = msgs.length;
        drawGCHistory(kind, msgs);
        if (cb) cb();
    });
}

function drawGCHistory(kind, msgs) {
    var box=document.getElementById('gc-history-'+kind);
    if (!box) return;
    // Preserve scroll position if at bottom
    var atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 40;
    clearEl(box);
    if (!msgs.length) {
        var em=document.createElement('div'); em.style.cssText='color:#888;font-style:italic;padding:14px;text-align:center;font-size:11px;';
        em.appendChild(document.createTextNode(kind==='users'?'No messages yet.':kind==='bots'?'No bot conversation yet.':'No messages yet.'));
        box.appendChild(em);
        return;
    }
    // Group messages by date
    var lastDate='';
    msgs.forEach(function(m, idx) {
        // Date separator
        if (m.ts) {
            var dStr = new Date(m.ts).toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric',year:'numeric'});
            if (dStr !== lastDate) {
                lastDate=dStr;
                var sep=document.createElement('div'); sep.style.cssText='text-align:center;font-size:10px;color:#888;padding:6px 0;margin:4px 0;border-top:1px dashed #DDD;';
                sep.appendChild(document.createTextNode(dStr)); box.appendChild(sep);
            }
        }
        var isUser=m.role==='user', isSystem=m.role==='system';
        if (isSystem) {
            var sys=document.createElement('div'); sys.style.cssText='text-align:center;color:#888;font-size:10px;padding:4px 8px;border:1px dashed #CCC;margin:4px auto;max-width:60%;background:#F9F9F6;';
            sys.appendChild(document.createTextNode(m.text)); box.appendChild(sys); return;
        }
        var wrap=document.createElement('div'); wrap.style.cssText='display:flex;gap:7px;margin-bottom:10px;align-items:flex-end;';
        var av = isUser ? makeUserAvatarEl(m.sender, 28) : makePfpEl({name:m.sender,pfp:null},'pfp-28');
        av.style.flexShrink='0';
        var right=document.createElement('div'); right.style.cssText='flex:1;min-width:0;';
        var bubble=document.createElement('div'); bubble.style.cssText='display:inline-block;max-width:80%;padding:6px 10px;border:1px solid '+(isUser?'#BBCCEE':'#DDD')+';background:'+(isUser?'#EEF4FF':'#FAFAF8')+';line-height:1.5;vertical-align:top;';
        var hdr=document.createElement('div'); hdr.style.cssText='font-weight:bold;font-size:10px;margin-bottom:2px;color:'+(isUser?'#0033CC':'#CC0000');
        hdr.appendChild(document.createTextNode(m.sender));
        if (m.ts) {
            var ts=document.createElement('span'); ts.style.cssText='font-weight:normal;color:#AAA;margin-left:6px;font-size:9px;';
            ts.appendChild(document.createTextNode(fmtDT(m.ts))); hdr.appendChild(ts);
        }
        var txt=document.createElement('div'); txt.style.fontSize='11px';
        txt.innerHTML=(m.text||'').replace(/\*(.*?)\*/g,'<em style="color:#7755AA;font-style:italic;">*$1*</em>');
        bubble.appendChild(hdr); bubble.appendChild(txt);

        // Delivery status for user messages in users/mixed GC (last msg by me only)
        if ((kind==='users'||kind==='mixed') && isUser && m.sender===CAI.currentUser && idx===msgs.length-1) {
            var statusRow=document.createElement('div'); statusRow.style.cssText='display:flex;align-items:center;gap:3px;margin-top:4px;justify-content:flex-end;';
            // "Seen" = another user posted AFTER this message; "Delivered" = it's on server; "Sent" = just now
            var seenBy = [];
            for (var si = idx+1; si < msgs.length; si++) {
                if (msgs[si].role==='user' && msgs[si].sender !== CAI.currentUser && seenBy.indexOf(msgs[si].sender)<0) {
                    seenBy.push(msgs[si].sender);
                }
            }
            if (seenBy.length) {
                seenBy.forEach(function(who) {
                    var sAv = makeUserAvatarEl(who, 16); sAv.title = 'Seen by ' + who; sAv.style.marginLeft='1px';
                    statusRow.appendChild(sAv);
                });
                var sl=document.createElement('span'); sl.style.cssText='font-size:9px;color:#009900;margin-left:3px;';
                sl.appendChild(document.createTextNode('Seen')); statusRow.appendChild(sl);
            } else {
                var dl=document.createElement('span'); dl.style.cssText='font-size:9px;color:#0055AA;';
                dl.appendChild(document.createTextNode('Delivered')); statusRow.appendChild(dl);
            }
            bubble.appendChild(statusRow);
        }

        right.appendChild(bubble); wrap.appendChild(av); wrap.appendChild(right);
        box.appendChild(wrap);
    });
    if (atBottom) box.scrollTop=box.scrollHeight;
}

function clearGCRoom(kind) {
    if (!confirm('Clear this group chat?')) return;
    CAI.gcClear(kind, function(){
        CAI._gcInitDone[kind] = false;
        CAI._gcLastCounts[kind] = 0;
        loadGCHistory(kind);
    });
}


// ============================================================
// GC ADD USER / BOT PICKER MODAL + DICE
// ============================================================
CAI._gcPickerMode   = null;  // 'user' or 'bot'
CAI._gcPickerKind   = null;  // 'users' | 'bots' | 'mixed'
CAI._gcPickerChosen = [];

function gcOpenAddUser(kind) {
    CAI._gcPickerMode = 'user'; CAI._gcPickerKind = kind; CAI._gcPickerChosen = [];
    var titleEl = document.getElementById('gc-picker-title'); clearEl(titleEl);
    titleEl.appendChild(document.createTextNode('Add User to Group Chat'));
    var list = document.getElementById('gc-picker-list'); clearEl(list);
    // Show ALL registered users (private GC — no mutual-follow requirement)
    CAI.getAllUsers(function(err, db) {
        var users = Object.keys(db || {}).filter(function(u) { return u !== CAI.currentUser; });
        if (!users.length) {
            list.innerHTML='<div style="padding:10px;color:#888;font-style:italic;font-size:11px;">No other users found.</div>';
        } else {
            users.forEach(function(u) {
                var row=document.createElement('div'); row.style.cssText='display:flex;align-items:center;gap:8px;padding:7px;border-bottom:1px solid #DDD;cursor:pointer;';
                var chk=document.createElement('input'); chk.type='checkbox';
                (function(un,cb){ cb.onchange=function(){
                    var idx=CAI._gcPickerChosen.indexOf(un);
                    if(cb.checked&&idx<0) CAI._gcPickerChosen.push(un);
                    else if(!cb.checked&&idx>=0) CAI._gcPickerChosen.splice(idx,1);
                }; })(u,chk);
                var av=makeUserAvatarEl(u,22);
                var nm=document.createElement('span'); nm.style.fontSize='11px'; nm.appendChild(document.createTextNode(u));
                row.appendChild(chk); row.appendChild(av); row.appendChild(nm); list.appendChild(row);
            });
        }
        document.getElementById('gc-picker-overlay').style.display='flex';
    });
}

function gcOpenAddBot(kind) {
    CAI._gcPickerMode = 'bot'; CAI._gcPickerKind = kind; CAI._gcPickerChosen = [];
    var titleEl = document.getElementById('gc-picker-title'); clearEl(titleEl);
    titleEl.appendChild(document.createTextNode('Add Bot to Group Chat'));
    var list = document.getElementById('gc-picker-list'); clearEl(list);
    CAI.getUserChars(function(err, chars) {
        if (!chars.length) {
            list.innerHTML='<div style="padding:10px;color:#888;font-style:italic;font-size:11px;">No characters yet. Create one first!</div>';
        } else {
            chars.forEach(function(c) {
                var row=document.createElement('div'); row.style.cssText='display:flex;align-items:center;gap:8px;padding:7px;border-bottom:1px solid #DDD;cursor:pointer;';
                var chk=document.createElement('input'); chk.type='checkbox'; chk.checked=CAI._gcBotIds.indexOf(c.id)>=0;
                (function(cid,cb){ cb.onchange=function(){
                    var idx=CAI._gcPickerChosen.indexOf(cid);
                    if(cb.checked&&idx<0) CAI._gcPickerChosen.push(cid);
                    else if(!cb.checked&&idx>=0) CAI._gcPickerChosen.splice(idx,1);
                }; })(c.id,chk);
                var av=makePfpEl(c,'pfp-22');
                var nm=document.createElement('span'); nm.style.fontSize='11px'; nm.appendChild(document.createTextNode(c.name));
                row.appendChild(chk); row.appendChild(av); row.appendChild(nm); list.appendChild(row);
            });
        }
        document.getElementById('gc-picker-overlay').style.display='flex';
    });
}

function gcPickerConfirm() {
    document.getElementById('gc-picker-overlay').style.display = 'none';
    var kind    = CAI._gcPickerKind;
    var chosen  = CAI._gcPickerChosen.slice();
    if (!chosen.length) return;

    if (CAI._gcPickerMode === 'user') {
        // Invite all chosen users to BOTH 'users' and 'mixed' rooms so they appear in all GC options
        var rooms = ['users', 'mixed'];
        var total = chosen.length * rooms.length;
        var done = 0;
        chosen.forEach(function(u) {
            rooms.forEach(function(room) {
                CAI.gcInvite(room, u, function() {
                    done++;
                    if (done === total) {
                        renderGCMixedUsersList();
                        loadGCHistory('users');
                        loadGCHistory('mixed');
                    }
                });
            });
        });
    } else {
        // Bot: add chosen IDs to _gcBotIds then re-render
        chosen.forEach(function(cid) {
            if (CAI._gcBotIds.indexOf(cid) < 0) CAI._gcBotIds.push(cid);
        });
        if (kind === 'bots')  { renderGCBotList();      refreshBotResponderDropdown('bots'); }
        if (kind === 'mixed') { renderGCMixedBotList(); refreshBotResponderDropdown('mixed'); }
    }
}

// ---- Dice: random bot picker ----
function gcDicePick(kind) {
    var sel = document.getElementById('gc-'+(kind==='bots'?'bots':'mixed')+'-responder');
    if (!sel || sel.options.length <= 1) return;
    var idx = Math.floor(Math.random() * (sel.options.length - 1)) + 1;
    sel.selectedIndex = idx;
    sel.style.background='#FFFCE0';
    setTimeout(function(){ sel.style.background=''; }, 600);
}

// ---- Populate bot responder dropdown ----
function refreshBotResponderDropdown(kind) {
    var selId = kind==='bots' ? 'gc-bots-responder' : 'gc-mixed-responder';
    var sel = document.getElementById(selId); if (!sel) return;
    // save current
    var cur = sel.value;
    while (sel.options.length > 1) sel.remove(1);
    CAI.getUserChars(function(err, chars) {
        CAI._gcBotIds.forEach(function(bid) {
            var c=null; for(var i=0;i<chars.length;i++) if(chars[i].id===bid){c=chars[i];break;}
            if (!c) return;
            var opt=document.createElement('option'); opt.value=bid; opt.appendChild(document.createTextNode(c.name));
            sel.appendChild(opt);
        });
        if (cur) sel.value=cur;
    });
}

// ---- GC Mixed users list (invited users) ----
function renderGCMixedUsersList() {
    var el = document.getElementById('gc-mixed-users-list'); if (!el) return;
    CAI.gcGetMembers('mixed', function(err, members) {
        clearEl(el);
        // Always include current user
        var all = [CAI.currentUser];
        (members || []).forEach(function(u) { if (all.indexOf(u) < 0) all.push(u); });
        all.forEach(function(u) {
            var row = document.createElement('span');
            row.style.cssText = 'display:inline-flex;align-items:center;gap:3px;margin:2px 3px;background:#EEF2F9;border:1px solid #BBCCE0;padding:1px 5px;font-size:10px;';
            row.appendChild(makeUserAvatarEl(u, 14));
            row.appendChild(document.createTextNode(u));
            el.appendChild(row);
        });
        if (!all.length) el.appendChild(document.createTextNode('—'));
    });
}

// ============================================================
// ADMIN PANEL
// ============================================================
function renderAdminPanel() {
    if (!CAI.isCreator()) { nav('home'); return; }
    adminLoadBans();
    adminLoadAnnouncements();
    adminLoadFeedback();
}

function adminLoadBans() {
    CAI.getBannedUsers(function(err, banned) {
        var el = document.getElementById('admin-ban-list'); if (!el) return; clearEl(el);
        if (!banned.length) { el.appendChild(document.createTextNode('No banned users.')); return; }
        banned.forEach(function(u) {
            var row=document.createElement('div'); row.style.cssText='display:flex;align-items:center;gap:6px;padding:3px;border-bottom:1px solid #EEE;';
            var nm=document.createElement('span'); nm.style.flex='1'; nm.appendChild(document.createTextNode(u));
            var btn=document.createElement('button'); btn.className='classic-btn'; btn.style.cssText='padding:2px 8px;font-size:10px;';
            btn.appendChild(document.createTextNode('Unban'));
            (function(un){ btn.onclick=function(){ CAI.unbanUser(un, adminLoadBans); }; })(u);
            row.appendChild(nm); row.appendChild(btn); el.appendChild(row);
        });
    });
}

function adminBanUser() {
    var v=(document.getElementById('admin-ban-input').value||'').trim().toLowerCase();
    if (!v) { alert('Enter a username.'); return; }
    if (v===CAI.CREATOR) { alert('Cannot ban yourself!'); return; }
    CAI.banUser(v, function(err) {
        if (err) alert('Error: '+err);
        else { document.getElementById('admin-ban-input').value=''; adminLoadBans(); }
    });
}
function adminUnbanUser() {
    var v=(document.getElementById('admin-ban-input').value||'').trim().toLowerCase();
    if (!v) { alert('Enter a username.'); return; }
    CAI.unbanUser(v, function(err) {
        if (err) alert('Error: '+err);
        else { document.getElementById('admin-ban-input').value=''; adminLoadBans(); }
    });
}

function adminLoadAnnouncements() {
    CAI.getAnnouncements(function(err, arr) {
        var el=document.getElementById('admin-announce-list'); if (!el) return; clearEl(el);
        if (!arr.length) { el.innerHTML='<div style="color:#888;font-style:italic;font-size:11px;padding:4px;">No announcements.</div>'; return; }
        arr.forEach(function(a) {
            var row=document.createElement('div'); row.style.cssText='border:1px solid #DDD;padding:5px 8px;margin-bottom:4px;background:#FFF;display:flex;gap:6px;align-items:flex-start;';
            var txt=document.createElement('div'); txt.style.flex='1';
            var dStr=document.createElement('div'); dStr.style.cssText='font-size:9px;color:#999;'; dStr.appendChild(document.createTextNode(new Date(a.ts).toLocaleString()));
            var body=document.createElement('div'); body.style.fontSize='11px'; body.appendChild(document.createTextNode(a.text));
            txt.appendChild(dStr); txt.appendChild(body);
            var del=document.createElement('button'); del.className='classic-btn danger'; del.style.cssText='padding:2px 6px;font-size:10px;';
            del.appendChild(document.createTextNode('Del'));
            (function(aid){ del.onclick=function(){ CAI.deleteAnnouncement(aid, adminLoadAnnouncements); }; })(a.id);
            row.appendChild(txt); row.appendChild(del); el.appendChild(row);
        });
    });
}

function adminPostAnnouncement() {
    var txt=(document.getElementById('admin-announce-input').value||'').trim();
    if (!txt) { alert('Enter announcement text.'); return; }
    CAI.postAnnouncement(txt, function(err) {
        if (err) alert('Error: '+err);
        else {
            document.getElementById('admin-announce-input').value='';
            adminLoadAnnouncements();
            // Show banner to current user immediately
            showAnnouncementBanner(txt);
        }
    });
}

function adminLoadFeedback() {
    CAI.getFeedback(function(err, arr) {
        var el=document.getElementById('admin-feedback-list'); if (!el) return; clearEl(el);
        if (!arr.length) { el.innerHTML='<div style="color:#888;font-style:italic;font-size:11px;padding:4px;">No feedback yet.</div>'; return; }
        arr.forEach(function(f) {
            var row=document.createElement('div'); row.style.cssText='border:1px solid #DDD;padding:6px 8px;margin-bottom:5px;background:#FFF;';
            var meta=document.createElement('div'); meta.style.cssText='font-size:10px;color:#666;margin-bottom:3px;';
            meta.appendChild(document.createTextNode('['+f.type.toUpperCase()+'] '+f.username+' — '+new Date(f.ts).toLocaleString()));
            var body=document.createElement('div'); body.style.fontSize='11px'; body.appendChild(document.createTextNode(f.text));
            var del=document.createElement('button'); del.className='classic-btn danger'; del.style.cssText='padding:2px 6px;font-size:10px;margin-top:4px;';
            del.appendChild(document.createTextNode('Delete'));
            (function(fid){ del.onclick=function(){ CAI.deleteFeedback(fid, adminLoadFeedback); }; })(f.id);
            row.appendChild(meta); row.appendChild(body); row.appendChild(del); el.appendChild(row);
        });
    });
}

// ============================================================
// FEEDBACK SUBMISSION (all users)
// ============================================================
function submitFeedback() {
    var type=(document.getElementById('feedback-type').value||'feedback');
    var text=(document.getElementById('feedback-text').value||'').trim();
    var status=document.getElementById('feedback-status');
    if (!text) { if(status){clearEl(status);status.appendChild(document.createTextNode('Please write something first.'));}return; }
    CAI.submitFeedback(type, text, function(err) {
        clearEl(status);
        if (err) status.appendChild(document.createTextNode('Error: '+err));
        else {
            status.appendChild(document.createTextNode('Submitted! Thank you.'));
            document.getElementById('feedback-text').value='';
        }
    });
}

// ============================================================
// ANNOUNCEMENT BANNER
// ============================================================
function showAnnouncementBanner(text) {
    var banner = document.getElementById('announce-banner');
    var txt    = document.getElementById('announce-text');
    if (!banner || !txt) return;
    clearEl(txt);
    txt.appendChild(document.createTextNode('Announcement: ' + text));
    banner.style.display = 'block';
}

function checkAndShowAnnouncements() {
    CAI.getAnnouncements(function(err, arr) {
        if (!err && arr.length) showAnnouncementBanner(arr[0].text);
    });
}

// Override startApp (called from app.js after login) to show announcements
var _origStartAppPost = window.onStartAppPost;
window.onStartAppPost = function() {
    checkAndShowAnnouncements();
    // Show admin tab if creator
    var adminTab=document.getElementById('admin-nav-tab');
    if (adminTab) adminTab.style.display=CAI.isCreator()?'block':'none';
    if (_origStartAppPost) _origStartAppPost();
};
