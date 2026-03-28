// config.js — SUPER ULTRA-LITE
// Set your Render.com server URL here.
var RENDER_SERVER_URL = "https://YOUR-APP-NAME.onrender.com";
if (
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1" ||
  window.location.hostname.startsWith("192.168.") ||
  window.location.hostname.startsWith("10.")
) { RENDER_SERVER_URL = ""; }
