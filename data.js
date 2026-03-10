// ============================================================
// data.js — Character.ai Lite [UNOFFICIAL]
// ALL data stored in localStorage. Zero server required.
// Works on GitHub Pages and any static host.
//
// Key prefix: cailite_<key>
// All callbacks: cb(err, data) — same signatures as before
// so ui.js and app.js need no changes.
// ============================================================

var CAI = CAI || {};

// ---- tiny localStorage helpers ----
CAI.lsGet = function(k) {
    try { return JSON.parse(localStorage.getItem('cailite_' + k) || 'null'); } catch(e) { return null; }
};
CAI.lsSet = function(k, v) {
    try { localStorage.setItem('cailite_' + k, JSON.stringify(v)); } catch(e) {}
};
CAI.lsDel = function(k) { localStorage.removeItem('cailite_' + k); };

// ---- session (client only) ----
CAI.getSession   = function()  { return CAI.lsGet('session') || null; };
CAI.saveSession  = function(u) { CAI.lsSet('session', u); };
CAI.clearSession = function()  { CAI.lsDel('session'); };

// ---- FNV-1a hash (kept for password compatibility) ----
CAI.hashPw = function(p) {
    var h = 0x811c9dc5;
    for (var i = 0; i < p.length; i++) {
        h ^= p.charCodeAt(i);
        h = (h * 0x01000193) >>> 0;
    }
    return h.toString(16);
};

// ---- AUTH ----
CAI.signup = function(username, password, cb) {
    var db = CAI.lsGet('users_db') || {};
    if (db[username]) { cb('Username taken'); return; }
    db[username] = { username: username, passwordHash: CAI.hashPw(password), created: Date.now() };
    CAI.lsSet('users_db', db);
    var ps = {};
    ps['p_default'] = { id: 'p_default', name: username, desc: 'A regular person.', pfp: null };
    CAI.lsSet('personas_' + username, ps);
    cb(null, { ok: true });
};

CAI.login = function(username, password, cb) {
    var db = CAI.lsGet('users_db') || {};
    var u  = db[username];
    if (!u || u.passwordHash !== CAI.hashPw(password)) { cb('Invalid credentials'); return; }
    var bans = CAI.lsGet('bans') || [];
    if (bans.indexOf(username) >= 0) { cb('This account has been banned. Contact the admin.'); return; }
    cb(null, { ok: true, username: username });
};

CAI.deleteAccount = function(username, password, cb) {
    var db = CAI.lsGet('users_db') || {};
    var u  = db[username];
    if (!u || u.passwordHash !== CAI.hashPw(password)) { cb('Invalid credentials'); return; }
    var chars = CAI.lsGet('chars_' + username) || {};
    var pub   = CAI.lsGet('public_chars') || {};
    for (var cid in chars) { if (pub.hasOwnProperty(cid)) delete pub[cid]; }
    CAI.lsSet('public_chars', pub);
    CAI.lsDel('chars_'    + username);
    CAI.lsDel('personas_' + username);
    CAI.lsDel('chats_'    + username);
    CAI.lsDel('follow_'   + username);
    CAI.lsDel('dm_list_'  + username);
    var dbFresh = CAI.lsGet('users_db') || {};
    for (var other in dbFresh) {
        if (other === username) continue;
        var fd = CAI.lsGet('follow_' + other) || { following: [], followers: [] };
        fd.following = (fd.following || []).filter(function(x) { return x !== username; });
        fd.followers = (fd.followers || []).filter(function(x) { return x !== username; });
        CAI.lsSet('follow_' + other, fd);
    }
    delete db[username];
    CAI.lsSet('users_db', db);
    cb(null, { ok: true });
};

// ---- USERS ----
CAI.getAllUsers = function(cb) {
    cb(null, CAI.lsGet('users_db') || {});
};
CAI.userExists = function(username, cb) {
    CAI.getAllUsers(function(err, db) { cb(!err && !!db[username]); });
};

// ---- CHARACTERS ----
CAI.getUserChars = function(cb) {
    var chars = CAI.lsGet('chars_' + CAI.currentUser) || {};
    cb(null, Object.values ? Object.values(chars) : Object.keys(chars).map(function(k){ return chars[k]; }));
};
CAI.getCharsByUser = function(username, cb) {
    var chars = CAI.lsGet('chars_' + username) || {};
    cb(null, Object.values ? Object.values(chars) : Object.keys(chars).map(function(k){ return chars[k]; }));
};
CAI.saveChar = function(c, cb) {
    var chars = CAI.lsGet('chars_' + CAI.currentUser) || {};
    chars[c.id] = c;
    CAI.lsSet('chars_' + CAI.currentUser, chars);
    var pub = CAI.lsGet('public_chars') || {};
    if (c.pub) { pub[c.id] = c; } else { if (pub.hasOwnProperty(c.id)) delete pub[c.id]; }
    CAI.lsSet('public_chars', pub);
    if (cb) cb(null, { ok: true });
};
CAI.deleteCharLocal = function(id, cb) {
    var chars = CAI.lsGet('chars_' + CAI.currentUser) || {};
    if (chars.hasOwnProperty(id)) delete chars[id];
    CAI.lsSet('chars_' + CAI.currentUser, chars);
    var pub = CAI.lsGet('public_chars') || {};
    if (pub.hasOwnProperty(id)) delete pub[id];
    CAI.lsSet('public_chars', pub);
    if (cb) cb(null, { ok: true });
};

// ---- PUBLIC CHARS ----
CAI.getPublicDB = function(cb) {
    cb(null, CAI.lsGet('public_chars') || {});
};
CAI.syncToPublic     = function(c, cb) { if (cb) cb(null, { ok: true }); };
CAI.removeFromPublic = function(id, cb) { if (cb) cb(null, { ok: true }); };

// ---- PERSONAS ----
CAI.getUserPersonas = function(cb) {
    var ps = CAI.lsGet('personas_' + CAI.currentUser) || {};
    cb(null, Object.values ? Object.values(ps) : Object.keys(ps).map(function(k){ return ps[k]; }));
};
CAI.savePersonaItem = function(p, cb) {
    var ps = CAI.lsGet('personas_' + CAI.currentUser) || {};
    ps[p.id] = p;
    CAI.lsSet('personas_' + CAI.currentUser, ps);
    if (cb) cb(null, { ok: true });
};
CAI.deletePersonaLocal = function(id, cb) {
    var ps = CAI.lsGet('personas_' + CAI.currentUser) || {};
    if (ps.hasOwnProperty(id)) delete ps[id];
    CAI.lsSet('personas_' + CAI.currentUser, ps);
    if (cb) cb(null, { ok: true });
};

// ---- CHAT HISTORY ----
CAI.getChat = function(charId, cb) {
    var chats = CAI.lsGet('chats_' + CAI.currentUser) || {};
    cb(null, chats[charId] || []);
};
CAI.saveChat = function(charId, msgs, cb) {
    var chats = CAI.lsGet('chats_' + CAI.currentUser) || {};
    chats[charId] = msgs;
    CAI.lsSet('chats_' + CAI.currentUser, chats);
    if (cb) cb(null, { ok: true });
};

// ---- RECENTS (client-only) ----
CAI.getRecents  = function()  { return CAI.lsGet('recents_' + CAI.currentUser) || []; };
CAI.saveRecents = function(a) { CAI.lsSet('recents_' + CAI.currentUser, a); };

// ---- FOLLOWERS ----
CAI.getFollowing = function(username, cb) {
    var fd = CAI.lsGet('follow_' + (username || CAI.currentUser)) || { following: [], followers: [] };
    cb(null, fd.following || []);
};
CAI.getFollowers = function(username, cb) {
    var fd = CAI.lsGet('follow_' + (username || CAI.currentUser)) || { following: [], followers: [] };
    cb(null, fd.followers || []);
};
CAI.followUser = function(target, cb) {
    var afd = CAI.lsGet('follow_' + CAI.currentUser) || { following: [], followers: [] };
    var tfd = CAI.lsGet('follow_' + target)          || { following: [], followers: [] };
    if ((afd.following || []).indexOf(target)             < 0) afd.following.push(target);
    if ((tfd.followers || []).indexOf(CAI.currentUser)    < 0) tfd.followers.push(CAI.currentUser);
    CAI.lsSet('follow_' + CAI.currentUser, afd);
    CAI.lsSet('follow_' + target, tfd);
    if (cb) cb(null, { ok: true });
};
CAI.unfollowUser = function(target, cb) {
    var afd = CAI.lsGet('follow_' + CAI.currentUser) || { following: [], followers: [] };
    var tfd = CAI.lsGet('follow_' + target)          || { following: [], followers: [] };
    afd.following = (afd.following || []).filter(function(x) { return x !== target; });
    tfd.followers = (tfd.followers || []).filter(function(x) { return x !== CAI.currentUser; });
    CAI.lsSet('follow_' + CAI.currentUser, afd);
    CAI.lsSet('follow_' + target, tfd);
    if (cb) cb(null, { ok: true });
};
CAI.isFollowing = function(target, cb) {
    CAI.getFollowing(CAI.currentUser, function(err, arr) { cb(!err && arr.indexOf(target) >= 0); });
};

// ---- VISITORS ----
CAI.getVisitorCount = function(charId, cb) {
    cb(null, (CAI.lsGet('vis_' + charId) || []).length);
};
CAI.recordVisitor = function(charId, cb) {
    if (!charId || !CAI.currentUser) { if (cb) cb(null, {}); return; }
    var arr = CAI.lsGet('vis_' + charId) || [];
    if (arr.indexOf(CAI.currentUser) < 0) {
        arr.push(CAI.currentUser);
        CAI.lsSet('vis_' + charId, arr);
        var pub = CAI.lsGet('public_chars') || {};
        if (pub[charId]) { pub[charId].visitorCount = arr.length; CAI.lsSet('public_chars', pub); }
    }
    if (cb) cb(null, { count: arr.length });
};

// ---- WebLLM SETTINGS (same interface as old ollamaSettings) ----
CAI.ollamaSettings = {
    load: function() {
        return {
            model: CAI.lsGet('webllm_model') ||
                   CAI.lsGet('ollama_model')  ||
                   'Hermes-3-Llama-3.1-8B-q4f16_1-MLC'
        };
    },
    save: function(model) {
        CAI.lsSet('webllm_model', model);
    }
};

// ---- DOWNLOAD HELPERS ----
CAI.downloadJSON = function(filename, data) {
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var url  = URL.createObjectURL(blob);
    var a    = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
};
CAI.downloadCharacterList = function() {
    CAI.getUserChars(function(err, chars) {
        CAI.downloadJSON('characters_' + CAI.currentUser + '.json', {
            _note: 'Character.ai Lite [UNOFFICIAL] character list',
            owner: CAI.currentUser, characters: chars
        });
    });
};
CAI.downloadPersonaList = function() {
    CAI.getUserPersonas(function(err, personas) {
        CAI.downloadJSON('personas_' + CAI.currentUser + '.json', {
            _note: 'Character.ai Lite [UNOFFICIAL] persona list',
            owner: CAI.currentUser, personas: personas
        });
    });
};

// ---- ONLINE PRESENCE (localStorage; reflects tabs on same browser) ----
CAI.sendHeartbeat = function() {
    if (!CAI.currentUser) return;
    var hb = CAI.lsGet('heartbeats') || {};
    hb[CAI.currentUser] = Date.now();
    CAI.lsSet('heartbeats', hb);
};
CAI.getOnlineUsers = function(cb) {
    var hb  = CAI.lsGet('heartbeats') || {};
    var now = Date.now();
    var online = Object.keys(hb).filter(function(u) { return now - hb[u] < 30000; });
    cb(null, online);
};

// ---- USER DM ----
// Period '.' can't appear in usernames ([a-z0-9_]+) so it's a safe separator.
function _dmKey(a, b) {
    var pair = [a, b].sort();
    return 'dm_' + pair[0] + '.' + pair[1];
}
CAI.dmSend = function(to, text, cb) {
    var key  = _dmKey(CAI.currentUser, to);
    var msgs = CAI.lsGet(key) || [];
    msgs.push({ from: CAI.currentUser, to: to, text: text, ts: Date.now(), read: false });
    CAI.lsSet(key, msgs);
    // Track contacts so dmList() works without key-scanning
    var myList    = CAI.lsGet('dm_list_' + CAI.currentUser) || [];
    var theirList = CAI.lsGet('dm_list_' + to)              || [];
    if (myList.indexOf(to)                 < 0) { myList.push(to);                 CAI.lsSet('dm_list_' + CAI.currentUser, myList); }
    if (theirList.indexOf(CAI.currentUser) < 0) { theirList.push(CAI.currentUser); CAI.lsSet('dm_list_' + to, theirList); }
    if (cb) cb(null, { ok: true });
};
CAI.dmGet = function(other, cb) {
    cb(null, CAI.lsGet(_dmKey(CAI.currentUser, other)) || []);
};
CAI.dmMarkRead = function(other, cb) {
    var key  = _dmKey(CAI.currentUser, other);
    var msgs = CAI.lsGet(key) || [];
    msgs.forEach(function(m) { if (m.to === CAI.currentUser) m.read = true; });
    CAI.lsSet(key, msgs);
    if (cb) cb(null, { ok: true });
};
CAI.dmList = function(cb) {
    var contacts = CAI.lsGet('dm_list_' + CAI.currentUser) || [];
    var convos   = [];
    contacts.forEach(function(other) {
        var msgs = CAI.lsGet(_dmKey(CAI.currentUser, other)) || [];
        if (!msgs.length) return;
        var last   = msgs[msgs.length - 1];
        var unread = msgs.filter(function(m) { return m.to === CAI.currentUser && !m.read; }).length;
        convos.push({ user: other, lastMsg: last, unread: unread });
    });
    convos.sort(function(a, b) { return (b.lastMsg.ts || 0) - (a.lastMsg.ts || 0); });
    cb(null, convos);
};

// ---- GC ROOMS ----
CAI.gcGet = function(kind, cb) {
    cb(null, (CAI.lsGet('gcroom_' + kind) || []).slice(-200));
};
CAI.gcPost = function(kind, sender, text, role, cb) {
    var msgs = CAI.lsGet('gcroom_' + kind) || [];
    msgs.push({ sender: sender, text: text, role: role || 'user', ts: Date.now() });
    CAI.lsSet('gcroom_' + kind, msgs);
    if (cb) cb(null, { ok: true });
};
CAI.gcClear = function(kind, cb) {
    CAI.lsSet('gcroom_' + kind, []);
    if (cb) cb(null, { ok: true });
};

// ---- CREATOR GATE ----
CAI.CREATOR = 'mjclarido_creatorofficial7897';
CAI.isCreator = function() { return CAI.currentUser === CAI.CREATOR; };

// ---- MUTUAL FOLLOW ----
CAI.isMutualFollow = function(userA, userB, cb) {
    CAI.getFollowing(userA, function(err1, aFollows) {
        CAI.getFollowers(userA, function(err2, aFollowers) {
            var aFollowsB = !err1 && aFollows.indexOf(userB)   >= 0;
            var bFollowsA = !err2 && aFollowers.indexOf(userB) >= 0;
            cb(aFollowsB && bFollowsA);
        });
    });
};
CAI.getMutualFollowers = function(cb) {
    CAI.getFollowing(CAI.currentUser, function(err1, following) {
        CAI.getFollowers(CAI.currentUser, function(err2, followers) {
            var mutual = (following || []).filter(function(u) {
                return (followers || []).indexOf(u) >= 0;
            });
            cb(mutual);
        });
    });
};

// ---- ADMIN: BAN / UNBAN ----
CAI.banUser = function(target, cb) {
    var bans = CAI.lsGet('bans') || [];
    if (bans.indexOf(target) < 0) bans.push(target);
    CAI.lsSet('bans', bans);
    if (cb) cb(null, { ok: true });
};
CAI.unbanUser = function(target, cb) {
    CAI.lsSet('bans', (CAI.lsGet('bans') || []).filter(function(b) { return b !== target; }));
    if (cb) cb(null, { ok: true });
};
CAI.getBannedUsers = function(cb) {
    cb(null, CAI.lsGet('bans') || []);
};
CAI.isBanned = function(username, cb) {
    CAI.getBannedUsers(function(err, banned) { cb(!err && banned.indexOf(username) >= 0); });
};

// ---- ADMIN: ANNOUNCEMENTS ----
CAI.postAnnouncement = function(text, cb) {
    var arr = CAI.lsGet('announcements') || [];
    arr.unshift({ id: Date.now(), text: text, ts: Date.now() });
    arr = arr.slice(0, 50);
    CAI.lsSet('announcements', arr);
    if (cb) cb(null, { ok: true });
};
CAI.getAnnouncements = function(cb) {
    cb(null, CAI.lsGet('announcements') || []);
};
CAI.deleteAnnouncement = function(id, cb) {
    CAI.lsSet('announcements', (CAI.lsGet('announcements') || []).filter(function(a) { return a.id !== id; }));
    if (cb) cb(null, { ok: true });
};

// ---- FEEDBACK ----
CAI.submitFeedback = function(type, text, cb) {
    var arr = CAI.lsGet('feedback') || [];
    arr.unshift({ id: Date.now(), username: CAI.currentUser, type: type, text: text, ts: Date.now() });
    CAI.lsSet('feedback', arr);
    if (cb) cb(null, { ok: true });
};
CAI.getFeedback = function(cb) {
    cb(null, CAI.lsGet('feedback') || []);
};
CAI.deleteFeedback = function(id, cb) {
    CAI.lsSet('feedback', (CAI.lsGet('feedback') || []).filter(function(f) { return f.id !== id; }));
    if (cb) cb(null, { ok: true });
};

// ---- GC INVITES ----
CAI.gcInvite = function(kind, username, cb) {
    var members = CAI.lsGet('gcmembers_' + kind) || [];
    if (members.indexOf(username) < 0) members.push(username);
    CAI.lsSet('gcmembers_' + kind, members);
    if (cb) cb(null, { ok: true });
};
CAI.gcGetMembers = function(kind, cb) {
    cb(null, CAI.lsGet('gcmembers_' + kind) || []);
};
