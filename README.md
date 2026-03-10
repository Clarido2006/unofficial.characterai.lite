# Character.ai Lite [UNOFFICIAL]

A browser-based AI character chat app with Windows XP aesthetic.  
**100% static — runs on GitHub Pages with no server.**

---

## Live Demo
`https://<your-username>.github.io/<repo-name>/`

---

## How to Deploy (GitHub Pages)

1. Fork or push this folder to a GitHub repo.
2. Go to **Settings → Pages → Source → Deploy from a branch**.
3. Select `main` branch, `/ (root)` folder. Click **Save**.
4. Wait ~1 minute. Visit `https://<username>.github.io/<repo>/`.

That's it. No build step, no npm, no server needed.

---

## How AI Works (WebLLM)

The AI runs **entirely in your browser** using [WebLLM](https://github.com/mlc-ai/web-llm) + WebGPU.

- **No API key.** No subscription. No external service.
- **First load:** Downloads the model to your browser cache (1-3 GB, once).
- **Subsequent loads:** Instant — served from cache.
- **Privacy:** Your chat messages never leave your device.

### Requirements
| Browser | Min Version |
|---------|------------|
| Chrome / Chromium | 113+ |
| Edge | 113+ |
| Safari | 18+ (macOS 15 / iOS 18) |
| Firefox | ❌ WebGPU disabled by default |

If WebGPU is unavailable, the app loads but AI responses will fail with a clear error message.

---

## Data Storage
All user data (accounts, characters, personas, chat history) is stored in **localStorage** in the visitor's own browser. No data is shared between users or devices.

> **Note:** Because data is per-browser, there is no cross-device sync and no real-time multiplayer. User Chat DMs and Group Chat work as a single-browser experience.

---

## Running Locally (no server needed)
Open `index.html` directly in Chrome 113+. WebLLM loads the model from CDN.

Or serve with any static server:
```bash
npx serve .
python3 -m http.server 8080
```

---

## Models (selectable in Settings)
| Model | Size | Notes |
|-------|------|-------|
| Llama 3.2 3B | ~2 GB | **Recommended** — great balance |
| Llama 3.2 1B | ~1 GB | Fastest, lighter GPU |
| Phi 3.5 Mini | ~2.4 GB | High quality |
| Gemma 2 2B | ~1.7 GB | Google's model |
| SmolLM2 1.7B | ~1 GB | Compact |
| Mistral 7B | ~4 GB | Large GPU only |

---

## File Structure
```
index.html        — Main app (HTML + CSS)
data.js           — localStorage API (replaces server)
ai.js             — WebLLM engine integration
ui.js             — All rendering and navigation
app.js            — Auth, bootstrap
detect.js         — Device detection (phone/tablet/desktop)
webllm-init.js    — ES module: loads WebLLM from CDN
responsive.css    — Per-device layout overrides
responsive.js     — Phone-specific JS (bottom nav, back button)
```
