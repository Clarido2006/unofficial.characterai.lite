// ============================================================
// server.js — AiCharacters lite & ChatHangout!
// Render.com deployment (Node.js + Express)
// REST API: users, characters, personas, chats, DMs, GC rooms
// Data stored in JSON files on disk (Render persistent disk)
// ============================================================

const express    = require('express');
const fs         = require('fs');
const path       = require('path');
const crypto     = require('crypto');

const app  = express();
const PORT = process.env.PORT || 3000;

// ---- Directories ----
const BASE_DIR  = __dirname;
const DATA_DIR  = path.join(BASE_DIR, 'data');
const USERS_DIR = path.join(BASE_DIR, 'users');
const CHARS_DIR = path.join(BASE_DIR, 'characters');

[DATA_DIR, USERS_DIR, CHARS_DIR].forEach(d => {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

// ---- Path helpers (defined FIRST, used everywhere below) ----
const usersPath  = () => path.join(DATA_DIR, 'users_db.json');
const publicPath = () => path.join(DATA_DIR, 'public_chars.json');
const followPath = u  => path.join(DATA_DIR, `follow_${u}.json`);
const visPath    = id => path.join(DATA_DIR, `vis_${id}.json`);
const dmPath     = (a, b) => { const pair = [a, b].sort().join('_'); return path.join(DATA_DIR, `dm_${pair}.json`); };
const gcRoomPath = k  => path.join(DATA_DIR, `gcroom_${k}.json`);

// ---- JSON helpers ----
function readJSON(fp, def = {}) {
    try { return JSON.parse(fs.readFileSync(fp, 'utf8')); }
    catch { return typeof def === 'object' && !Array.isArray(def) ? {} : def; }
}
function writeJSON(fp, data) {
    fs.writeFileSync(fp, JSON.stringify(data, null, 2), 'utf8');
}

// ---- FNV-1a hash (matches client JS) ----
function fnv1a(s) {
    let h = 0x811c9dc5;
    for (const c of Buffer.from(s, 'utf8')) { h ^= c; h = Math.imul(h, 0x01000193) >>> 0; }
    return h.toString(16);
}

// ---- Middleware ----
app.use(express.json({ limit: '10mb' }));
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin',  '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});
// Serve static files from root
app.use(express.static(BASE_DIR));

// ---- HELPERS ----
const CREATOR = 'mjclarido_creatorofficial7897';
const GC_KINDS = ['users', 'bots', 'mixed'];

// ============================================================
// GET ROUTES
// ============================================================

// Users list (passwords stripped)
app.get('/api/users', (req, res) => {
    const db   = readJSON(usersPath());
    const safe = {};
    for (const [u, v] of Object.entries(db))
        safe[u] = { username: v.username, created: v.created || 0 };
    res.json(safe);
});

// User JSON file
app.get('/api/user/:username/json', (req, res) => {
    const data = readJSON(path.join(USERS_DIR, req.params.username + '.json'));
    res.json(data);
});

// Public chars
app.get('/api/public_chars', (req, res) => res.json(readJSON(publicPath())));

// Visitor count
app.get('/api/visitors/:cid', (req, res) => {
    const arr = readJSON(visPath(req.params.cid), []);
    res.json({ count: arr.length, visitors: arr });
});

// Follow data
app.get('/api/follow/:username/:kind', (req, res) => {
    const { username, kind } = req.params;
    const data = readJSON(followPath(username), { following: [], followers: [] });
    res.json(data[kind] || []);
});

// Online users
app.get('/api/online', (req, res) => {
    const hbFile = path.join(DATA_DIR, 'heartbeats.json');
    const now    = Date.now();
    const hb     = readJSON(hbFile, {});
    const online = Object.entries(hb).filter(([, t]) => now - t < 30000).map(([u]) => u);
    res.json({ online });
});

// GC members
app.get('/api/gcroom/members/:kind', (req, res) => {
    if (!GC_KINDS.includes(req.params.kind)) return res.status(400).json({ error: 'Invalid room' });
    const members = readJSON(path.join(DATA_DIR, `gcmembers_${req.params.kind}.json`), []);
    res.json({ members });
});

// GC messages
app.get('/api/gcroom/:kind', (req, res) => {
    if (!GC_KINDS.includes(req.params.kind)) return res.status(400).json({ error: 'Invalid room' });
    const msgs = readJSON(gcRoomPath(req.params.kind), []);
    res.json({ msgs: msgs.slice(-200) });
});

// DM conversation
app.get('/api/dm/:a/:b', (req, res) => {
    const conv = readJSON(dmPath(req.params.a, req.params.b), []);
    res.json({ msgs: conv });
});

// Admin routes (read)
app.get('/api/admin/announcements', (req, res) => {
    res.json({ announcements: readJSON(path.join(DATA_DIR, 'announcements.json'), []) });
});
app.get('/api/admin/feedback', (req, res) => {
    res.json({ feedback: readJSON(path.join(DATA_DIR, 'feedback.json'), []) });
});
app.get('/api/admin/bans', (req, res) => {
    res.json({ banned: readJSON(path.join(DATA_DIR, 'bans.json'), []) });
});

// ============================================================
// POST ROUTES
// ============================================================

// Signup
app.post('/api/signup', (req, res) => {
    const username = (req.body.username || '').trim().toLowerCase();
    const password = (req.body.password || '').trim();
    if (!username || !password) return res.status(400).json({ error: 'Missing fields' });

    const db = readJSON(usersPath());
    if (db[username]) return res.status(409).json({ error: 'Username taken' });

    const now = Date.now();
    db[username] = { username, passwordHash: fnv1a(password), created: now };
    writeJSON(usersPath(), db);

    // user.json in users/ folder
    writeJSON(path.join(USERS_DIR, username + '.json'), {
        _note: 'Character.ai Lite [UNOFFICIAL]',
        _folder: 'users/',
        username, created: now,
        followers: [], following: [], characters: [], personas: []
    });
    // default persona
    writeJSON(path.join(DATA_DIR, `personas_${username}.json`), {
        p_default: { id: 'p_default', name: username, desc: 'A regular person.', pfp: null }
    });
    res.json({ ok: true });
});

// Login
app.post('/api/login', (req, res) => {
    const username = (req.body.username || '').trim().toLowerCase();
    const password = (req.body.password || '').trim();
    const db = readJSON(usersPath());
    const u  = db[username];
    if (!u || u.passwordHash !== fnv1a(password))
        return res.status(401).json({ error: 'Invalid credentials' });
    const bans = readJSON(path.join(DATA_DIR, 'bans.json'), []);
    if (bans.includes(username))
        return res.status(403).json({ error: 'This account has been banned. Contact the admin.' });
    res.json({ ok: true, username });
});

// Save character
app.post('/api/char/save', (req, res) => {
    const { char, username } = req.body;
    if (!char || !username) return res.status(400).json({ error: 'Missing char or username' });

    const uf    = path.join(DATA_DIR, `chars_${username}.json`);
    const chars = readJSON(uf);
    chars[char.id] = char;
    writeJSON(uf, chars);
    writeJSON(path.join(CHARS_DIR, char.id + '.json'), char);

    const pub = readJSON(publicPath());
    if (char.pub) pub[char.id] = char;
    else delete pub[char.id];
    writeJSON(publicPath(), pub);
    res.json({ ok: true });
});

// Delete character
app.post('/api/char/delete', (req, res) => {
    const { id, username } = req.body;
    if (!id || !username) return res.status(400).json({ error: 'Missing id or username' });

    const uf    = path.join(DATA_DIR, `chars_${username}.json`);
    const chars = readJSON(uf);
    delete chars[id];
    writeJSON(uf, chars);

    const pub = readJSON(publicPath());
    delete pub[id];
    writeJSON(publicPath(), pub);

    const cf = path.join(CHARS_DIR, id + '.json');
    if (fs.existsSync(cf)) fs.unlinkSync(cf);
    res.json({ ok: true });
});

// Get user's chars
app.post('/api/chars', (req, res) => {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: 'Missing username' });
    res.json(readJSON(path.join(DATA_DIR, `chars_${username}.json`)));
});

// Save/delete/get personas
app.post('/api/persona/save', (req, res) => {
    const { persona, username } = req.body;
    if (!persona || !username) return res.status(400).json({ error: 'Missing fields' });
    const pf = path.join(DATA_DIR, `personas_${username}.json`);
    const p  = readJSON(pf);
    p[persona.id] = persona;
    writeJSON(pf, p);
    res.json({ ok: true });
});
app.post('/api/persona/delete', (req, res) => {
    const { id, username } = req.body;
    if (!id || !username) return res.status(400).json({ error: 'Missing fields' });
    const pf = path.join(DATA_DIR, `personas_${username}.json`);
    const p  = readJSON(pf);
    delete p[id];
    writeJSON(pf, p);
    res.json({ ok: true });
});
app.post('/api/personas', (req, res) => {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: 'Missing username' });
    res.json(readJSON(path.join(DATA_DIR, `personas_${username}.json`)));
});

// Chat save/get
app.post('/api/chat/save', (req, res) => {
    const { username, charId, msgs = [] } = req.body;
    if (!username || !charId) return res.status(400).json({ error: 'Missing fields' });
    const cf = path.join(DATA_DIR, `chats_${username}.json`);
    const c  = readJSON(cf);
    c[charId] = msgs;
    writeJSON(cf, c);
    res.json({ ok: true });
});
app.post('/api/chat/get', (req, res) => {
    const { username, charId } = req.body;
    if (!username || !charId) return res.status(400).json({ error: 'Missing fields' });
    const c = readJSON(path.join(DATA_DIR, `chats_${username}.json`));
    res.json({ msgs: c[charId] || [] });
});

// Follow / Unfollow
app.post('/api/follow', (req, res) => {
    const { actor, target } = req.body;
    if (!actor || !target) return res.status(400).json({ error: 'Missing fields' });
    const af = followPath(actor), tf = followPath(target);
    const ad = readJSON(af, { following: [], followers: [] });
    const td = readJSON(tf, { following: [], followers: [] });
    if (!ad.following.includes(target)) ad.following.push(target);
    if (!td.followers.includes(actor))  td.followers.push(actor);
    writeJSON(af, ad); writeJSON(tf, td);
    res.json({ ok: true });
});
app.post('/api/unfollow', (req, res) => {
    const { actor, target } = req.body;
    if (!actor || !target) return res.status(400).json({ error: 'Missing fields' });
    const af = followPath(actor), tf = followPath(target);
    const ad = readJSON(af, { following: [], followers: [] });
    const td = readJSON(tf, { following: [], followers: [] });
    ad.following = ad.following.filter(x => x !== target);
    td.followers = td.followers.filter(x => x !== actor);
    writeJSON(af, ad); writeJSON(tf, td);
    res.json({ ok: true });
});

// Visitor
app.post('/api/visitor', (req, res) => {
    const { charId, username } = req.body;
    if (!charId || !username) return res.status(400).json({ error: 'Missing fields' });
    const vf  = visPath(charId);
    const arr = readJSON(vf, []);
    if (!arr.includes(username)) {
        arr.push(username);
        writeJSON(vf, arr);
        const pub = readJSON(publicPath());
        if (pub[charId]) { pub[charId].visitorCount = arr.length; writeJSON(publicPath(), pub); }
    }
    res.json({ count: arr.length });
});

// Delete account
app.post('/api/account/delete', (req, res) => {
    const { username, passwordHash } = req.body;
    if (!username || !passwordHash) return res.status(400).json({ error: 'Missing fields' });
    const db = readJSON(usersPath());
    const u  = db[username];
    if (!u || u.passwordHash !== passwordHash) return res.status(403).json({ error: 'Invalid credentials' });

    const chars = readJSON(path.join(DATA_DIR, `chars_${username}.json`));
    const pub   = readJSON(publicPath());
    Object.keys(chars).forEach(cid => {
        delete pub[cid];
        const cf = path.join(CHARS_DIR, cid + '.json');
        if (fs.existsSync(cf)) fs.unlinkSync(cf);
    });
    writeJSON(publicPath(), pub);

    [`chars_${username}.json`, `personas_${username}.json`,
     `chats_${username}.json`, `follow_${username}.json`].forEach(f => {
        const fp = path.join(DATA_DIR, f);
        if (fs.existsSync(fp)) fs.unlinkSync(fp);
    });
    const ujf = path.join(USERS_DIR, username + '.json');
    if (fs.existsSync(ujf)) fs.unlinkSync(ujf);

    Object.keys(db).filter(o => o !== username).forEach(other => {
        const of2 = followPath(other);
        const od  = readJSON(of2, { following: [], followers: [] });
        od.following = od.following.filter(x => x !== username);
        od.followers = od.followers.filter(x => x !== username);
        writeJSON(of2, od);
    });
    delete db[username];
    writeJSON(usersPath(), db);
    res.json({ ok: true });
});

// GC room: post message
app.post('/api/gcroom/post', (req, res) => {
    const { kind, username, text = '', sender, role = 'user' } = req.body;
    if (!GC_KINDS.includes(kind) || !username) return res.status(400).json({ error: 'Missing fields' });
    const msg  = { sender: sender || username, text, role, ts: Date.now() };
    const msgs = readJSON(gcRoomPath(kind), []);
    msgs.push(msg);
    writeJSON(gcRoomPath(kind), msgs);
    res.json({ ok: true });
});

// GC room: clear
app.post('/api/gcroom/clear', (req, res) => {
    const { kind } = req.body;
    if (!GC_KINDS.includes(kind)) return res.status(400).json({ error: 'Invalid room' });
    writeJSON(gcRoomPath(kind), []);
    res.json({ ok: true });
});

// GC invite
app.post('/api/gcroom/invite', (req, res) => {
    const { kind, actor, target } = req.body;
    if (!GC_KINDS.includes(kind) || !actor || !target)
        return res.status(400).json({ error: 'Missing fields' });
    const mf      = path.join(DATA_DIR, `gcmembers_${kind}.json`);
    const members = readJSON(mf, []);
    if (!members.includes(target)) members.push(target);
    writeJSON(mf, members);
    res.json({ ok: true });
});

// DM: send
app.post('/api/dm/send', (req, res) => {
    const { from: sender, to: recvr, text = '' } = req.body;
    if (!sender || !recvr || !text) return res.status(400).json({ error: 'Missing fields' });
    const msg  = { from: sender, to: recvr, text, ts: Date.now(), read: false };
    const conv = readJSON(dmPath(sender, recvr), []);
    conv.push(msg);
    writeJSON(dmPath(sender, recvr), conv);
    res.json({ ok: true });
});

// DM: mark read
app.post('/api/dm/read', (req, res) => {
    const { me, other } = req.body;
    if (!me || !other) return res.status(400).json({ error: 'Missing fields' });
    const conv = readJSON(dmPath(me, other), []);
    conv.forEach(m => { if (m.to === me) m.read = true; });
    writeJSON(dmPath(me, other), conv);
    res.json({ ok: true });
});

// DM: list conversations
app.post('/api/dm/list', (req, res) => {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: 'Missing username' });
    const convos = [];
    fs.readdirSync(DATA_DIR).filter(f => f.startsWith('dm_') && f.endsWith('.json')).forEach(f => {
        const fname = f.slice(3, -5);
        const parts = fname.split('_');
        if (parts.length === 2 && parts.includes(username)) {
            const other = parts[0] === username ? parts[1] : parts[0];
            const msgs  = readJSON(path.join(DATA_DIR, f), []);
            if (msgs.length) {
                const unread = msgs.filter(m => m.to === username && !m.read).length;
                convos.push({ user: other, lastMsg: msgs[msgs.length - 1], unread });
            }
        }
    });
    convos.sort((a, b) => (b.lastMsg.ts || 0) - (a.lastMsg.ts || 0));
    res.json({ convos });
});

// Heartbeat
app.post('/api/heartbeat', (req, res) => {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: 'Missing username' });
    const hbFile = path.join(DATA_DIR, 'heartbeats.json');
    const hb     = readJSON(hbFile, {});
    hb[username] = Date.now();
    writeJSON(hbFile, hb);
    res.json({ ok: true });
});

// Admin: ban / unban
app.post('/api/admin/ban', (req, res) => {
    const { actor, target } = req.body;
    if (actor !== CREATOR) return res.status(403).json({ error: 'Forbidden' });
    const bans = readJSON(path.join(DATA_DIR, 'bans.json'), []);
    if (!bans.includes(target)) bans.push(target);
    writeJSON(path.join(DATA_DIR, 'bans.json'), bans);
    res.json({ ok: true });
});
app.post('/api/admin/unban', (req, res) => {
    const { actor, target } = req.body;
    if (actor !== CREATOR) return res.status(403).json({ error: 'Forbidden' });
    const bans = readJSON(path.join(DATA_DIR, 'bans.json'), []).filter(b => b !== target);
    writeJSON(path.join(DATA_DIR, 'bans.json'), bans);
    res.json({ ok: true });
});

// Admin: announcements
app.post('/api/admin/announce', (req, res) => {
    const { actor, text } = req.body;
    if (actor !== CREATOR || !text) return res.status(403).json({ error: 'Forbidden' });
    const afile = path.join(DATA_DIR, 'announcements.json');
    const arr   = readJSON(afile, []);
    arr.unshift({ id: Date.now(), text, ts: Date.now() });
    writeJSON(afile, arr.slice(0, 50));
    res.json({ ok: true });
});
app.post('/api/admin/announce/delete', (req, res) => {
    const { actor, id } = req.body;
    if (actor !== CREATOR) return res.status(403).json({ error: 'Forbidden' });
    const afile = path.join(DATA_DIR, 'announcements.json');
    writeJSON(afile, readJSON(afile, []).filter(a => a.id !== id));
    res.json({ ok: true });
});

// Feedback
app.post('/api/feedback', (req, res) => {
    const { username = '', type = 'feedback', text = '' } = req.body;
    if (!text) return res.status(400).json({ error: 'Empty feedback' });
    const ffile = path.join(DATA_DIR, 'feedback.json');
    const arr   = readJSON(ffile, []);
    arr.unshift({ id: Date.now(), username, type, text, ts: Date.now() });
    writeJSON(ffile, arr);
    res.json({ ok: true });
});
app.post('/api/admin/feedback/delete', (req, res) => {
    const { actor, id } = req.body;
    if (actor !== CREATOR) return res.status(403).json({ error: 'Forbidden' });
    const ffile = path.join(DATA_DIR, 'feedback.json');
    writeJSON(ffile, readJSON(ffile, []).filter(f => f.id !== id));
    res.json({ ok: true });
});

// ============================================================
// Fallback → serve index.html for SPA
// ============================================================
app.get('*', (req, res) => {
    res.sendFile(path.join(BASE_DIR, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`=== AiCharacters lite & ChatHangout! ===`);
    console.log(`Server running on port ${PORT}`);
    console.log(`Data directory: ${DATA_DIR}`);
});
