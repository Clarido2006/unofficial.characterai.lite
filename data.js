// ============================================================
// data.js — Character.ai Lite [UNOFFICIAL]
// All storage, user accounts, characters, personas,
// followers, visitors. Uses localStorage as the "folder" layer.
// Each user's data is namespaced so multiple accounts work.
// ============================================================

var CAI = CAI || {};

CAI.STORE_PREFIX = 'cailite_';

// ---------- low-level storage ----------
CAI.lsGet = function(key) {
    try { return JSON.parse(localStorage.getItem(CAI.STORE_PREFIX + key) || 'null'); }
    catch(e) { return null; }
};
CAI.lsSet = function(key, val) {
    try { localStorage.setItem(CAI.STORE_PREFIX + key, JSON.stringify(val)); }
    catch(e) { CAI.UI && CAI.UI.setStatus('Storage error: ' + e.message); }
};
CAI.lsDel = function(key) {
    localStorage.removeItem(CAI.STORE_PREFIX + key);
};

// ---------- session ----------
CAI.getSession    = function() { return CAI.lsGet('session') || null; };
CAI.saveSession   = function(u) { CAI.lsSet('session', u); };
CAI.clearSession  = function() { CAI.lsDel('session'); };

// ---------- USERS DB — shared across all accounts ----------
// Structure: { username: { username, passwordHash, created } }
// Mirrors: users/user.json (downloadable per-user)
CAI.getUsersDB    = function() { return CAI.lsGet('users_db') || {}; };
CAI.saveUsersDB   = function(db) { CAI.lsSet('users_db', db); };

// Simple FNV-1a hash — no crypto needed, good enough for local use
CAI.hashPw = function(p) {
    var h = 0x811c9dc5;
    for (var i = 0; i < p.length; i++) {
        h ^= p.charCodeAt(i);
        h = (h * 0x01000193) >>> 0;
    }
    return h.toString(16);
};

CAI.userExists = function(username) {
    return !!CAI.getUsersDB()[username];
};

CAI.createUser = function(username, password) {
    var db = CAI.getUsersDB();
    var now = Date.now();
    db[username] = { username: username, passwordHash: CAI.hashPw(password), created: now };
    CAI.saveUsersDB(db);

    // Create default persona for new user
    var defPersona = { id: 'p_default', name: username, desc: 'A regular person.', pfp: null };
    var pd = {}; pd['p_default'] = defPersona;
    CAI.lsSet('u_' + username + '_personas', pd);

    // Generate and store user.json immediately on account creation
    CAI.saveUserJson(username);
    return db[username];
};

CAI.checkLogin = function(username, password) {
    var db = CAI.getUsersDB();
    if (!db[username]) return false;
    return db[username].passwordHash === CAI.hashPw(password);
};

// ---------- user.json — generated on create + updated on changes ----------
// This mirrors what would be on disk at users/<username>.json
CAI.buildUserJson = function(username) {
    var db = CAI.getUsersDB();
    var u  = db[username] || {};
    return {
        _note: "Character.ai Lite [UNOFFICIAL] — user data file",
        _folder: "users/",
        _file: username + ".json",
        username:   username,
        created:    u.created || 0,
        followers:  CAI.getFollowers(username),
        following:  CAI.getFollowing(username),
        characters: CAI.getCharsByUser(username).map(function(c) {
            return { id: c.id, name: c.name, public: !!c.pub, created: c.created || 0 };
        }),
        personas: (function() {
            var pd = CAI.lsGet('u_' + username + '_personas') || {};
            return Object.keys(pd).map(function(k) {
                return { id: pd[k].id, name: pd[k].name };
            });
        })()
    };
};
CAI.saveUserJson = function(username) {
    CAI.lsSet('userjson_' + username, CAI.buildUserJson(username));
};
CAI.getUserJson = function(username) {
    return CAI.lsGet('userjson_' + username) || CAI.buildUserJson(username);
};

// ---------- namespaced user helpers ----------
CAI.uk = function(username, folder) { return 'u_' + username + '_' + folder; };

// Characters — stored at users/<username>_chars
// Each char: { id, name, greet, desc, pfp, pub, ownedBy, created }
CAI.getCharsByUser = function(username) {
    return Object.values(CAI.lsGet(CAI.uk(username, 'chars')) || {});
};
CAI.getUserChars = function() { return CAI.getCharsByUser(CAI.currentUser); };
CAI.saveChar = function(c) {
    var d = CAI.lsGet(CAI.uk(CAI.currentUser, 'chars')) || {};
    d[c.id] = c;
    CAI.lsSet(CAI.uk(CAI.currentUser, 'chars'), d);
    CAI.saveUserJson(CAI.currentUser);
};
CAI.deleteCharLocal = function(id) {
    var d = CAI.lsGet(CAI.uk(CAI.currentUser, 'chars')) || {};
    delete d[id];
    CAI.lsSet(CAI.uk(CAI.currentUser, 'chars'), d);
    CAI.saveUserJson(CAI.currentUser);
};

// Personas — stored at users/<username>_personas
CAI.getUserPersonas = function() {
    return Object.values(CAI.lsGet(CAI.uk(CAI.currentUser, 'personas')) || {});
};
CAI.savePersonaItem = function(p) {
    var d = CAI.lsGet(CAI.uk(CAI.currentUser, 'personas')) || {};
    d[p.id] = p;
    CAI.lsSet(CAI.uk(CAI.currentUser, 'personas'), d);
    CAI.saveUserJson(CAI.currentUser);
};
CAI.deletePersonaLocal = function(id) {
    var d = CAI.lsGet(CAI.uk(CAI.currentUser, 'personas')) || {};
    delete d[id];
    CAI.lsSet(CAI.uk(CAI.currentUser, 'personas'), d);
    CAI.saveUserJson(CAI.currentUser);
};

// Chat history — stored at users/<username>_chats
CAI.getChat = function(charId) {
    return (CAI.lsGet(CAI.uk(CAI.currentUser, 'chats')) || {})[charId] || [];
};
CAI.saveChat = function(charId, msgs) {
    var d = CAI.lsGet(CAI.uk(CAI.currentUser, 'chats')) || {};
    d[charId] = msgs;
    CAI.lsSet(CAI.uk(CAI.currentUser, 'chats'), d);
};

// Recents
CAI.getRecents = function() { return CAI.lsGet(CAI.uk(CAI.currentUser, 'recents')) || []; };
CAI.saveRecents = function(a) { CAI.lsSet(CAI.uk(CAI.currentUser, 'recents'), a); };

// ---------- PUBLIC CHARACTERS DB — shared community layer ----------
// Mirrors: characters/<charId>.json on disk conceptually
CAI.getPublicDB  = function() { return CAI.lsGet('public_chars') || {}; };
CAI.savePublicDB = function(db) { CAI.lsSet('public_chars', db); };

CAI.syncToPublic = function(c) {
    var db = CAI.getPublicDB();
    db[c.id] = Object.assign({}, c, { ownedBy: c.ownedBy || CAI.currentUser, publishedAt: Date.now() });
    CAI.savePublicDB(db);
};
CAI.removeFromPublic = function(id) {
    var db = CAI.getPublicDB(); delete db[id]; CAI.savePublicDB(db);
};

// ---------- FOLLOW SYSTEM ----------
// following_<user>  = array of usernames this user follows
// followers_<user>  = array of usernames following this user
CAI.getFollowing = function(u) { return CAI.lsGet('following_' + (u || CAI.currentUser)) || []; };
CAI.getFollowers = function(u) { return CAI.lsGet('followers_' + (u || CAI.currentUser)) || []; };
CAI.saveFollowing = function(u, arr) { CAI.lsSet('following_' + u, arr); };
CAI.saveFollowers = function(u, arr) { CAI.lsSet('followers_' + u, arr); };

CAI.followUser = function(target) {
    var fing = CAI.getFollowing(CAI.currentUser);
    var fers = CAI.getFollowers(target);
    if (fing.indexOf(target) < 0) { fing.push(target); CAI.saveFollowing(CAI.currentUser, fing); }
    if (fers.indexOf(CAI.currentUser) < 0) { fers.push(CAI.currentUser); CAI.saveFollowers(target, fers); }
    CAI.saveUserJson(CAI.currentUser);
    CAI.saveUserJson(target);
};
CAI.unfollowUser = function(target) {
    CAI.saveFollowing(CAI.currentUser, CAI.getFollowing(CAI.currentUser).filter(function(u) { return u !== target; }));
    CAI.saveFollowers(target, CAI.getFollowers(target).filter(function(u) { return u !== CAI.currentUser; }));
    CAI.saveUserJson(CAI.currentUser);
    CAI.saveUserJson(target);
};
CAI.isFollowing = function(target) { return CAI.getFollowing(CAI.currentUser).indexOf(target) >= 0; };

// ---------- VISITOR COUNTER ----------
// Uses a Set (stored as array) per charId. Same user = no increment.
// Mirrors: characters/<charId>_visitors.json
CAI.getVisitorSet = function(charId) {
    try { return CAI.lsGet('vis_' + charId) || []; } catch(e) { return []; }
};
CAI.getVisitorCount = function(charId) { return CAI.getVisitorSet(charId).length; };
CAI.recordVisitor = function(charId) {
    if (!charId || !CAI.currentUser) return;
    var set = CAI.getVisitorSet(charId);
    if (set.indexOf(CAI.currentUser) < 0) {
        set.push(CAI.currentUser);
        CAI.lsSet('vis_' + charId, set);
        // Update count in public DB too
        var db = CAI.getPublicDB();
        if (db[charId]) { db[charId].visitorCount = set.length; CAI.savePublicDB(db); }
    }
};

// ---------- DOWNLOAD HELPERS ----------
// These simulate "saving to folder" by triggering a download
CAI.downloadJSON = function(filename, data) {
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var url  = URL.createObjectURL(blob);
    var a    = document.createElement('a');
    a.href   = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};
CAI.downloadUserJson = function(username) {
    var u = username || CAI.currentUser;
    CAI.downloadJSON(u + '.json', CAI.buildUserJson(u));
};
CAI.downloadCharacterList = function() {
    var chars = CAI.getUserChars();
    CAI.downloadJSON('characters_' + CAI.currentUser + '.json', {
        _note: "Character.ai Lite [UNOFFICIAL] — character list",
        _folder: "characters/",
        owner: CAI.currentUser,
        exported: new Date().toISOString(),
        characters: chars
    });
};
CAI.downloadPersonaList = function() {
    var personas = CAI.getUserPersonas();
    CAI.downloadJSON('personas_' + CAI.currentUser + '.json', {
        _note: "Character.ai Lite [UNOFFICIAL] — persona list",
        _folder: "personas/",
        owner: CAI.currentUser,
        exported: new Date().toISOString(),
        personas: personas
    });
};
