// ============================================================
// responsive.js — Character.ai Lite [UNOFFICIAL]
// Phone-specific behaviour:
//   - Bottom nav active state sync
//   - Messenger two-step: contact list -> chat
//   - Back button to return to contact list
//   - Device label in status bar
// ============================================================

(function() {

// ---- Wait for DOM ----
function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else if (document.addEventListener) document.addEventListener('DOMContentLoaded', fn);
    else document.attachEvent('onreadystatechange', function() { if (document.readyState !== 'loading') fn(); });
}

// ---- Phone: show chat panel, hide contact list ----
function phoneOpenChat() {
    if (window.CAI_DEVICE !== 'phone') return;
    var cl = document.getElementById('contact-list');
    var cm = document.getElementById('chat-main');
    if (cl) cl.className = cl.className.replace('phone-list-hidden','') + ' phone-list-hidden';
    if (cm) cm.className = cm.className.replace('phone-chat-open','') + ' phone-chat-open';
}

// ---- Phone: back to contact list from chat ----
window.phoneBackToList = function() {
    if (window.CAI_DEVICE !== 'phone') return;
    var cl = document.getElementById('contact-list');
    var cm = document.getElementById('chat-main');
    if (cl) cl.className = cl.className.replace('phone-list-hidden','');
    if (cm) cm.className = cm.className.replace('phone-chat-open','');
};

// ---- Override nav() to update phone bottom nav active state ----
ready(function() {
    // Device label in status bar
    var st = document.getElementById('status-text');
    if (st && window.CAI_DEVICE_LABEL) {
        var cur = st.firstChild ? st.firstChild.nodeValue : '';
        if (cur.indexOf('[') === -1) {
            st.firstChild && (st.firstChild.nodeValue = cur + ' [' + window.CAI_DEVICE_LABEL + ']');
        }
    }

    // Patch nav() to update phone bottom nav highlight + phone messenger toggle
    if (typeof window.nav === 'function') {
        var origNav = window.nav;
        window.nav = function(id) {
            origNav(id);
            updatePhoneNav(id);
            // When entering messenger on phone, show contact list
            if (id === 'messenger' && window.CAI_DEVICE === 'phone') {
                window.phoneBackToList();
            }
        };
    }

    // Patch selectChar() to open chat panel on phone
    if (typeof window.selectChar === 'function') {
        var origSelectChar = window.selectChar;
        window.selectChar = function(id) {
            origSelectChar(id);
            if (window.CAI_DEVICE === 'phone') {
                // small delay so rendering finishes first
                setTimeout(phoneOpenChat, 50);
            }
        };
    }
});

// ---- Sync phone nav active button ----
function updatePhoneNav(id) {
    var MAP = {
        home:        0,
        messenger:   1,
        'user-chat': 2,
        'group-chat':3,
        settings:    4
    };
    var btns = document.querySelectorAll('.pnav-btn');
    for (var i = 0; i < btns.length; i++) {
        btns[i].className = btns[i].className.replace(' active','');
        if (MAP[id] === i) btns[i].className += ' active';
    }
}

})();
