// ============================================================
// detect.js — Character.ai Lite [UNOFFICIAL]
// Runs BEFORE DOM ready. Sets data-device on <html> so CSS
// can apply device-specific layout immediately on first paint.
//
// Detected classes:
//   desktop  — PC, laptop, non-touch wide screen
//   tablet   — touch device ~600-1024px (iPad, Android tablet)
//   phone    — touch device <600px or smartphone UA
//   feature  — tiny/old device: <240px wide or legacy UA
// ============================================================

(function() {
    var ua  = navigator.userAgent || navigator.vendor || window.opera || '';
    var sw  = screen.width;
    var sh  = screen.height;
    var touch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (navigator.msMaxTouchPoints > 0);
    var minDim = Math.min(sw, sh);
    var maxDim = Math.max(sw, sh);
    var device = 'desktop';

    // --- Feature / keypad phone ---
    // Very small screens OR classic Nokia/Symbian/MIDP feature phone UAs
    var isFeature = (
        minDim <= 240 || maxDim <= 320 ||
        /MIDP|CLDC|Symbian|Palm OS|BlackBerry(?! 10)|Nokia(?!.*Android)|Series60|Series40|J2ME|Obigo|NetFront|Openwave|Kindle(?!.*Fire)|DoCoMo|KDDI|SoftBank|Vodafone\/1|wap|WAP|i-mode/i.test(ua)
    );

    // --- Smartphone ---
    var isPhone = !isFeature && touch && (
        /iPhone|iPod|Android.*Mobile|Windows Phone|IEMobile|BB10|BlackBerry 10|Opera Mini|Opera Mobi|Mobile Safari/i.test(ua) ||
        (minDim < 600 && touch)
    );

    // --- Tablet ---
    var isTablet = !isFeature && !isPhone && touch && (
        /iPad|Android(?!.*Mobile)|Tablet|PlayBook|Kindle Fire|KFAPWI|KFTHWI|Silk/i.test(ua) ||
        (minDim >= 600 && minDim <= 1100 && touch)
    );

    if      (isFeature) device = 'feature';
    else if (isPhone)   device = 'phone';
    else if (isTablet)  device = 'tablet';
    else                device = 'desktop';

    // Apply before paint
    var html = document.documentElement;
    html.setAttribute('data-device', device);
    html.className = (html.className + ' dev-' + device).replace(/^\s+/, '');

    // Expose globally
    window.CAI_DEVICE = device;

    // Device label shown in status bar (set after DOM ready)
    var LABELS = {
        desktop: 'PC',
        tablet:  'Tablet',
        phone:   'Phone',
        feature: 'Feature Phone'
    };
    window.CAI_DEVICE_LABEL = LABELS[device] || 'PC';
})();
