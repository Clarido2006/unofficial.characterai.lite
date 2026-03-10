// ============================================================
// webllm-init.js — Character.ai Lite [UNOFFICIAL]
// ES Module shim: loads @mlc-ai/web-llm from CDN and exposes
// it on window._webllm so non-module scripts can access it.
// This must be loaded as <script type="module">.
// ============================================================

import * as webllm from "https://esm.run/@mlc-ai/web-llm";

window._webllm = webllm;

// Signal to ai.js that the library is available
window.dispatchEvent(new CustomEvent('webllm-library-ready'));
