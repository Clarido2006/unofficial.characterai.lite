// ============================================================
// app.js — Character.ai Lite [UNOFFICIAL]
// Auth, bootstrap. All data stored in localStorage.
// No server needed — works on GitHub Pages.
// ============================================================

var CAI = CAI || {};

// ---- AUTH ----
function doLogin() {
    var username = (document.getElementById('login-username').value || '').replace(/^\s+|\s+$/g, '').toLowerCase();
    var password  = document.getElementById('login-password').value || '';
    var errEl     = document.getElementById('login-error');
    var errMsg    = document.getElementById('login-error-msg');

    function showErr(msg) {
        while(errMsg.firstChild) errMsg.removeChild(errMsg.firstChild);
        errMsg.appendChild(document.createTextNode(msg));
        errEl.style.display = 'block';
    }

    if (!username || !password) { showErr('Please enter username and password.'); return; }

    var btn = document.querySelector('#login-tab .classic-btn.primary');
    if (btn) { btn.disabled = true; btn.firstChild.nodeValue = 'Signing in...'; }

    CAI.login(username, password, function(err) {
        if (btn) { btn.disabled = false; btn.firstChild.nodeValue = 'Sign In'; }
        if (err) { showErr(err === 'Invalid credentials' ? 'Incorrect username or password.' : err); return; }
        errEl.style.display = 'none';
        CAI.currentUser = username;
        CAI.saveSession(username);
        startApp();
    });
}

function doSignup() {
    var username = (document.getElementById('signup-username').value || '').replace(/^\s+|\s+$/g, '').toLowerCase();
    var password  = document.getElementById('signup-password').value || '';
    var confirm   = document.getElementById('signup-confirm').value  || '';
    var errEl     = document.getElementById('signup-error');
    var errMsg    = document.getElementById('signup-error-msg');
    var succEl    = document.getElementById('signup-success');

    errEl.style.display = 'none'; succEl.style.display = 'none';

    function showErr(msg) {
        while(errMsg.firstChild) errMsg.removeChild(errMsg.firstChild);
        errMsg.appendChild(document.createTextNode(msg));
        errEl.style.display = 'block';
    }

    if (!username || !password)        { showErr('Please fill in all fields.'); return; }
    if (username.length < 3)            { showErr('Username must be at least 3 characters.'); return; }
    if (!/^[a-z0-9_]+$/.test(username)) { showErr('Only letters, numbers, and underscores allowed.'); return; }
    if (password.length < 4)            { showErr('Password must be at least 4 characters.'); return; }
    if (password !== confirm)            { showErr('Passwords do not match.'); return; }

    var btn = document.querySelector('#signup-tab .classic-btn.primary');
    if (btn) { btn.disabled = true; btn.firstChild.nodeValue = 'Creating...'; }

    CAI.signup(username, password, function(err) {
        if (btn) { btn.disabled = false; btn.firstChild.nodeValue = 'Create Account'; }
        if (err) { showErr(err === 'Username taken' ? 'That username is already taken.' : err); return; }
        succEl.style.display = 'block';
        document.getElementById('signup-username').value = '';
        document.getElementById('signup-password').value = '';
        document.getElementById('signup-confirm').value  = '';
        setTimeout(function() { switchTab('login-tab'); }, 1500);
    });
}

function doLogout() {
    if (!confirm('Sign out of ' + CAI.currentUser + '?')) return;
    CAI.currentUser = null;
    CAI.clearSession();
    location.reload();
}

function switchTab(tabId) {
    var contents = document.querySelectorAll('.tab-content');
    var tabs     = document.querySelectorAll('.tab');
    for (var i = 0; i < contents.length; i++) {
        contents[i].style.display = contents[i].id === tabId ? 'block' : 'none';
        contents[i].className = contents[i].className.replace(' active','');
        if (contents[i].id === tabId) contents[i].className += ' active';
    }
    for (var j = 0; j < tabs.length; j++) {
        tabs[j].className = tabs[j].className.replace(' active','');
        if (tabs[j].getAttribute('data-tab') === tabId) tabs[j].className += ' active';
    }
}

// ---- APP START ----
function startApp() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('main-app').style.display     = 'block';

    var unDisplay = document.getElementById('current-username-display');
    if (unDisplay) { while(unDisplay.firstChild) unDisplay.removeChild(unDisplay.firstChild); unDisplay.appendChild(document.createTextNode(CAI.currentUser)); }
    var wnDisplay = document.getElementById('welcome-name');
    if (wnDisplay) { while(wnDisplay.firstChild) wnDisplay.removeChild(wnDisplay.firstChild); wnDisplay.appendChild(document.createTextNode(CAI.currentUser)); }

    // Load personas, set active
    CAI.getUserPersonas(function(err, personas) {
        if (!err && personas.length) {
            CAI.activePersonaId = personas[0].id;
        } else if (!err && !personas.length) {
            var defP = { id: 'p_default', name: CAI.currentUser, desc: 'A regular person.', pfp: null };
            CAI.savePersonaItem(defP, function() {});
            CAI.activePersonaId = 'p_default';
        }
    });

    nav('home');
    CAI.UI.setStatus('Ready — Logged in as ' + CAI.currentUser);
    CAI.UI.setAIStatus('AI: Ready', '#006600');

    // Heartbeat (online presence within same browser)
    CAI.sendHeartbeat();
    setInterval(function() { if (CAI.currentUser) CAI.sendHeartbeat(); }, 20000);

    // Post-start hooks (announcements, admin tab)
    if (typeof window.onStartAppPost === 'function') window.onStartAppPost();

    var adminTab = document.getElementById('admin-nav-tab');
    if (adminTab) adminTab.style.display = CAI.isCreator() ? 'block' : 'none';
}

// ---- KEYBOARD ----
function onKeyDown(e) {
    e = e || window.event;
    var key = e.key || e.keyCode;
    var isEnter = (key === 'Enter' || key === 13);
    if (!isEnter || e.shiftKey) return;
    var active = document.activeElement;
    if (active === document.getElementById('chat-input'))      { e.preventDefault ? e.preventDefault() : (e.returnValue = false); sendChatMessage(); }
    if (active === document.getElementById('uc-input'))        { e.preventDefault ? e.preventDefault() : (e.returnValue = false); sendDMMessage(); }
    if (active === document.getElementById('gc-users-input'))  { e.preventDefault ? e.preventDefault() : (e.returnValue = false); sendGCUserMsg(); }
    if (active === document.getElementById('gc-mixed-input'))  { e.preventDefault ? e.preventDefault() : (e.returnValue = false); sendGCMixedMsg(); }
}

// ---- INIT ----
window.onload = function() {
    if (document.addEventListener) document.addEventListener('keydown', onKeyDown, false);
    else if (document.attachEvent)  document.attachEvent('onkeydown', onKeyDown);

    var radios = document.querySelectorAll('input[name="char-visibility"]');
    for (var i = 0; i < radios.length; i++) {
        if (radios[i].addEventListener) radios[i].addEventListener('change', onVisChange, false);
        else if (radios[i].attachEvent) radios[i].attachEvent('onchange', onVisChange);
    }

    var saved = CAI.getSession();
    if (saved) {
        CAI.getAllUsers(function(err, db) {
            if (!err && db[saved]) {
                CAI.currentUser = saved;
                startApp();
            } else {
                CAI.clearSession();
                document.getElementById('login-screen').style.display = 'flex';
            }
        });
    } else {
        document.getElementById('login-screen').style.display = 'flex';
    }
};
