// ============================================================
// app.js — Character.ai Lite [UNOFFICIAL]
// Authentication, app bootstrap, keyboard shortcuts
// ============================================================

var CAI = CAI || {};

// ---- AUTH ----
function doLogin() {
    var username = (document.getElementById('login-username').value || '').replace(/^\s+|\s+$/g, '').toLowerCase();
    var password  = document.getElementById('login-password').value || '';
    var errEl     = document.getElementById('login-error');
    var errMsg    = document.getElementById('login-error-msg');

    function showErr(msg) { errMsg.firstChild ? (errMsg.firstChild.nodeValue = msg) : errMsg.appendChild(document.createTextNode(msg)); errEl.style.display = 'block'; }

    if (!username || !password) { showErr('Please enter username and password.'); return; }
    if (!CAI.userExists(username)) { showErr('Username not found. Please create an account.'); return; }
    if (!CAI.checkLogin(username, password)) { showErr('Incorrect password.'); return; }

    errEl.style.display = 'none';
    CAI.currentUser = username;
    CAI.saveSession(username);
    startApp();
}

function doSignup() {
    var username = (document.getElementById('signup-username').value || '').replace(/^\s+|\s+$/g, '').toLowerCase();
    var password  = document.getElementById('signup-password').value || '';
    var confirm   = document.getElementById('signup-confirm').value || '';
    var errEl     = document.getElementById('signup-error');
    var errMsg    = document.getElementById('signup-error-msg');
    var succEl    = document.getElementById('signup-success');

    errEl.style.display = 'none'; succEl.style.display = 'none';

    function showErr(msg) { errMsg.firstChild ? (errMsg.firstChild.nodeValue = msg) : errMsg.appendChild(document.createTextNode(msg)); errEl.style.display = 'block'; }

    if (!username || !password)       { showErr('Please fill in all fields.'); return; }
    if (username.length < 3)           { showErr('Username must be at least 3 characters.'); return; }
    if (!/^[a-z0-9_]+$/.test(username)){ showErr('Only letters, numbers, and underscores allowed.'); return; }
    if (password.length < 4)           { showErr('Password must be at least 4 characters.'); return; }
    if (password !== confirm)           { showErr('Passwords do not match.'); return; }
    if (CAI.userExists(username))       { showErr('Username already taken.'); return; }

    // CREATE ACCOUNT — also generates user.json automatically
    CAI.createUser(username, password);

    succEl.style.display = 'block';
    document.getElementById('signup-username').value = '';
    document.getElementById('signup-password').value = '';
    document.getElementById('signup-confirm').value  = '';

    // Auto-switch to login after 1.5s
    setTimeout(function() { switchTab('login-tab'); }, 1500);
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
    for (var i = 0; i < contents.length; i++) contents[i].style.display = 'none';
    for (var j = 0; j < tabs.length; j++) tabs[j].className = tabs[j].className.replace(' active', '');
    document.getElementById(tabId).style.display = 'block';
    var idx = tabId === 'login-tab' ? 0 : 1;
    if (tabs[idx]) tabs[idx].className += ' active';
}

// ---- APP START ----
function startApp() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('main-app').style.display     = 'block';

    var unDisplay = document.getElementById('current-username-display');
    if (unDisplay) { clearEl(unDisplay); unDisplay.appendChild(document.createTextNode(CAI.currentUser)); }
    var wnDisplay = document.getElementById('welcome-name');
    if (wnDisplay) { clearEl(wnDisplay); wnDisplay.appendChild(document.createTextNode(CAI.currentUser)); }

    // Ensure active persona exists
    var personas = CAI.getUserPersonas();
    if (!personas.length) {
        var defP = { id: 'p_default', name: CAI.currentUser, desc: 'A regular person.', pfp: null };
        CAI.savePersonaItem(defP);
        CAI.activePersonaId = 'p_default';
    } else {
        CAI.activePersonaId = personas[0].id;
    }

    nav('home');
    CAI.UI.setStatus('Ready - Logged in as ' + CAI.currentUser);
    CAI.UI.setAIStatus('AI: Ready', '#006600');
}

// ---- KEYBOARD ----
function onKeyDown(e) {
    e = e || window.event;
    var key = e.key || e.keyCode;
    var isEnter = (key === 'Enter' || key === 13);
    if (!isEnter || e.shiftKey) return;
    if (document.activeElement === document.getElementById('chat-input')) {
        e.preventDefault ? e.preventDefault() : (e.returnValue = false);
        sendChatMessage();
    }
    if (document.activeElement === document.getElementById('gc-input')) {
        e.preventDefault ? e.preventDefault() : (e.returnValue = false);
        sendGroupMessage();
    }
}

// ---- INIT ----
function clearEl(el) {
    if (!el) return;
    while (el.firstChild) el.removeChild(el.firstChild);
}

window.onload = function() {
    // Wire up keyboard
    if (document.addEventListener) document.addEventListener('keydown', onKeyDown, false);
    else if (document.attachEvent)  document.attachEvent('onkeydown', onKeyDown);

    // Wire radio change
    var radios = document.querySelectorAll('input[name="char-visibility"]');
    for (var i = 0; i < radios.length; i++) {
        if (radios[i].addEventListener) radios[i].addEventListener('change', onVisChange, false);
        else if (radios[i].attachEvent) radios[i].attachEvent('onchange', onVisChange);
    }

    // Check saved session
    var saved = CAI.getSession();
    if (saved && CAI.userExists(saved)) {
        CAI.currentUser = saved;
        startApp();
    } else {
        document.getElementById('login-screen').style.display = 'flex';
    }
};
