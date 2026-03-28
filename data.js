// ============================================================
// data.js — SUPER ULTRA-LITE
// Minimal API layer. No DMs, no GC rooms, no admin calls.
// localStorage fallback when server is unreachable.
// ============================================================
var CAI = CAI || {};

CAI.BASE = (typeof RENDER_SERVER_URL !== "undefined" && RENDER_SERVER_URL) ? RENDER_SERVER_URL : window.location.origin;

CAI.lsGet = function(k) { try { return JSON.parse(localStorage.getItem('caisu_' + k) || 'null'); } catch(e) { return null; } };
CAI.lsSet = function(k, v) { try { localStorage.setItem('caisu_' + k, JSON.stringify(v)); } catch(e) {} };
CAI.lsDel = function(k) { localStorage.removeItem('caisu_' + k); };

CAI.getSession   = function()  { return CAI.lsGet('session') || null; };
CAI.saveSession  = function(u) { CAI.lsSet('session', u); };
CAI.clearSession = function()  { CAI.lsDel('session'); };

CAI.hashPw = function(p) {
    var h = 0x811c9dc5;
    for (var i = 0; i < p.length; i++) { h ^= p.charCodeAt(i); h = (h * 0x01000193) >>> 0; }
    return h.toString(16);
};

// ---- Generic API call with localStorage fallback ----
CAI.api = function(method, path, body, cb) {
    var xhr = new XMLHttpRequest();
    xhr.open(method, CAI.BASE + path, true);
    if (body) xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.timeout = 8000;
    xhr.onreadystatechange = function() {
        if (xhr.readyState !== 4) return;
        try {
            var d = JSON.parse(xhr.responseText);
            cb(xhr.status < 400 ? null : (d.error || 'Error'), d);
        } catch(e) { cb('Parse error', null); }
    };
    xhr.ontimeout = function() { cb('Timeout', null); };
    xhr.onerror   = function() { cb('Network error', null); };
    xhr.send(body ? JSON.stringify(body) : null);
};

// ---- Auth ----
CAI.signup = function(u, p, cb) { CAI.api('POST', '/api/signup', { username: u, password: p }, cb); };
CAI.login  = function(u, p, cb) { CAI.api('POST', '/api/login',  { username: u, password: p }, cb); };
CAI.deleteAccount = function(u, p, cb) {
    CAI.api('POST', '/api/account/delete', { username: u, passwordHash: CAI.hashPw(p) }, cb);
};

// ---- Users ----
CAI.getAllUsers = function(cb) {
    CAI.api('GET', '/api/users', null, function(err, d) { cb(err, d || {}); });
};

// ---- Characters ----
CAI.getUserChars = function(cb) {
    CAI.api('POST', '/api/chars', { username: CAI.currentUser }, function(err, d) {
        if (err) {
            // Fallback to localStorage
            var local = CAI.lsGet('chars_' + CAI.currentUser) || {};
            return cb(null, Object.values(local));
        }
        cb(null, d ? Object.values(d) : []);
    });
};
CAI.getCharsByUser = function(username, cb) {
    CAI.api('POST', '/api/chars', { username: username }, function(err, d) {
        cb(err, d ? Object.values(d) : []);
    });
};
CAI.saveChar = function(c, cb) {
    // Always save to localStorage first (instant)
    var local = CAI.lsGet('chars_' + CAI.currentUser) || {};
    local[c.id] = c;
    CAI.lsSet('chars_' + CAI.currentUser, local);
    CAI.api('POST', '/api/char/save', { username: CAI.currentUser, char: c }, cb || function(){});
};
CAI.deleteCharLocal = function(id, cb) {
    var local = CAI.lsGet('chars_' + CAI.currentUser) || {};
    delete local[id];
    CAI.lsSet('chars_' + CAI.currentUser, local);
    CAI.api('POST', '/api/char/delete', { username: CAI.currentUser, id: id }, cb || function(){});
};

// ---- Public chars ----
CAI.getPublicDB = function(cb) {
    CAI.api('GET', '/api/public_chars', null, function(err, d) {
        if (err) return cb(null, CAI.lsGet('publicCharsCache') || {});
        if (d) CAI.lsSet('publicCharsCache', d);
        cb(null, d || {});
    });
};
CAI.syncToPublic    = function(c, cb) { if (cb) cb(null, {ok:true}); };
CAI.removeFromPublic = function(id, cb) { if (cb) cb(null, {ok:true}); };

// ---- Personas ----
CAI.getUserPersonas = function(cb) {
    CAI.api('POST', '/api/personas', { username: CAI.currentUser }, function(err, d) {
        if (err) {
            var local = CAI.lsGet('personas_' + CAI.currentUser) || {};
            return cb(null, Object.values(local));
        }
        cb(null, d ? Object.values(d) : []);
    });
};
CAI.savePersonaItem = function(p, cb) {
    var local = CAI.lsGet('personas_' + CAI.currentUser) || {};
    local[p.id] = p;
    CAI.lsSet('personas_' + CAI.currentUser, local);
    CAI.api('POST', '/api/persona/save', { username: CAI.currentUser, persona: p }, cb || function(){});
};
CAI.deletePersonaLocal = function(id, cb) {
    var local = CAI.lsGet('personas_' + CAI.currentUser) || {};
    delete local[id];
    CAI.lsSet('personas_' + CAI.currentUser, local);
    CAI.api('POST', '/api/persona/delete', { username: CAI.currentUser, id: id }, cb || function(){});
};

// ---- Chat history (localStorage primary, server backup) ----
CAI.getChat = function(charId, cb) {
    var localKey = 'chat_' + CAI.currentUser + '_' + charId;
    CAI.api('POST', '/api/chat/get', { username: CAI.currentUser, charId: charId }, function(err, d) {
        if (err) return cb(null, CAI.lsGet(localKey) || []);
        var msgs = (d && d.msgs) ? d.msgs : [];
        CAI.lsSet(localKey, msgs);
        cb(null, msgs);
    });
};
CAI.saveChat = function(charId, msgs, cb) {
    var localKey = 'chat_' + CAI.currentUser + '_' + charId;
    CAI.lsSet(localKey, msgs);
    CAI.api('POST', '/api/chat/save', { username: CAI.currentUser, charId: charId, msgs: msgs }, cb || function(){});
};

// ---- Recents ----
CAI.getRecents  = function()  { return CAI.lsGet('recents_' + CAI.currentUser) || []; };
CAI.saveRecents = function(a) { CAI.lsSet('recents_' + CAI.currentUser, a); };

// ---- Visitors ----
CAI.getVisitorCount = function(charId, cb) {
    CAI.api('GET', '/api/visitors/' + charId, null, function(err, d) { cb(err, d ? d.count : 0); });
};
CAI.recordVisitor = function(charId, cb) {
    if (!charId || !CAI.currentUser || CAI.isGuest) { if (cb) cb(null, {}); return; }
    CAI.api('POST', '/api/visitor', { charId: charId, username: CAI.currentUser }, cb || function(){});
};

// ---- Follow (read-only for ultra-lite) ----
CAI.getFollowing = function(u, cb) {
    CAI.api('GET', '/api/follow/' + (u || CAI.currentUser) + '/following', null,
        function(err, d) { cb(err, Array.isArray(d) ? d : []); });
};
CAI.getFollowers = function(u, cb) {
    CAI.api('GET', '/api/follow/' + (u || CAI.currentUser) + '/followers', null,
        function(err, d) { cb(err, Array.isArray(d) ? d : []); });
};
CAI.followUser   = function(t, cb) { CAI.api('POST', '/api/follow',   { actor: CAI.currentUser, target: t }, cb || function(){}); };
CAI.unfollowUser = function(t, cb) { CAI.api('POST', '/api/unfollow', { actor: CAI.currentUser, target: t }, cb || function(){}); };
CAI.isFollowing  = function(t, cb) { CAI.getFollowing(CAI.currentUser, function(err, a) { cb(!err && a.indexOf(t) >= 0); }); };

// ---- Puter AI settings ----
CAI.puterSettings = {
    load: function() { return { model: CAI.lsGet('puter_model') || 'meta-llama/llama-3.1-8b-instruct' }; },
    save: function(m) { CAI.lsSet('puter_model', m); }
};

// ---- Downloads ----
CAI.downloadJSON = function(filename, data) {
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a'); a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
};
CAI.downloadCharacterList = function() {
    CAI.getUserChars(function(err, chars) {
        CAI.downloadJSON('characters_' + CAI.currentUser + '.json', { owner: CAI.currentUser, characters: chars });
    });
};
CAI.downloadPersonaList = function() {
    CAI.getUserPersonas(function(err, personas) {
        CAI.downloadJSON('personas_' + CAI.currentUser + '.json', { owner: CAI.currentUser, personas: personas });
    });
};

// ---- Online / heartbeat (disabled in ultra-lite to save resources) ----
CAI.sendHeartbeat = function() {};
CAI.getOnlineUsers = function(cb) { cb(null, []); };

// ---- Stubs for DM / GC (not in ultra-lite) ----
CAI.dmSend   = function(t, m, cb) { if (cb) cb('Not available in Ultra-Lite', null); };
CAI.dmGet    = function(o, cb)    { cb(null, []); };
CAI.dmMarkRead = function(o, cb) {};
CAI.dmList   = function(cb)       { cb(null, []); };
CAI.gcGet    = function(k, cb)    { cb(null, []); };
CAI.gcPost   = function(k, s, t, r, cb) { if (cb) cb('Not available in Ultra-Lite', null); };
CAI.gcClear  = function(k, cb)    {};
CAI.gcInvite = function(k, u, cb) {};
CAI.gcGetMembers = function(k, cb) { cb(null, []); };

// ---- Creator gate ----
CAI.CREATOR  = 'mjclarido_creatorofficial7897';
CAI.isCreator = function() { return CAI.currentUser === CAI.CREATOR; };

// ---- Mutual follow ----
CAI.isMutualFollow = function(a, b, cb) {
    CAI.getFollowing(a, function(err1, aF) {
        CAI.getFollowers(a, function(err2, aFr) {
            cb(!err1 && !err2 && aF.indexOf(b) >= 0 && aFr.indexOf(b) >= 0);
        });
    });
};
CAI.getMutualFollowers = function(cb) {
    CAI.getFollowing(CAI.currentUser, function(err1, following) {
        CAI.getFollowers(CAI.currentUser, function(err2, followers) {
            cb((following || []).filter(function(u) { return (followers || []).indexOf(u) >= 0; }));
        });
    });
};

// ---- Admin stubs ----
CAI.banUser    = function(t, cb) { CAI.api('POST', '/api/admin/ban',    { actor: CAI.currentUser, target: t }, cb || function(){}); };
CAI.unbanUser  = function(t, cb) { CAI.api('POST', '/api/admin/unban',  { actor: CAI.currentUser, target: t }, cb || function(){}); };
CAI.getBannedUsers = function(cb) { CAI.api('GET', '/api/admin/bans', null, function(err, d) { cb(err, d ? d.banned : []); }); };
CAI.isBanned   = function(u, cb) { CAI.getBannedUsers(function(err, banned) { cb(!err && banned.indexOf(u) >= 0); }); };
CAI.postAnnouncement    = function(t, cb) { CAI.api('POST', '/api/admin/announce',       { actor: CAI.currentUser, text: t }, cb || function(){}); };
CAI.getAnnouncements    = function(cb)    { CAI.api('GET',  '/api/admin/announcements',  null, function(err, d) { cb(err, d ? d.announcements : []); }); };
CAI.deleteAnnouncement  = function(i, cb) { CAI.api('POST', '/api/admin/announce/delete', { actor: CAI.currentUser, id: i }, cb || function(){}); };
CAI.submitFeedback      = function(t, m, cb) { CAI.api('POST', '/api/feedback', { username: CAI.currentUser, type: t, text: m }, cb || function(){}); };
CAI.getFeedback         = function(cb)    { CAI.api('GET', '/api/admin/feedback', null, function(err, d) { cb(err, d ? d.feedback : []); }); };
CAI.deleteFeedback      = function(i, cb) { CAI.api('POST', '/api/admin/feedback/delete', { actor: CAI.currentUser, id: i }, cb || function(){}); };
