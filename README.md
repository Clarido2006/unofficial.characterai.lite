# AiCharacters lite & ChatHangout! [UNOFFICIAL]

Browser-based AI character chat with a retro Windows XP look.
Frontend on GitHub Pages. Backend (REST API) on Render.com.

## Quick Setup

### 1. Deploy backend to Render.com
- Create a new **Web Service** on https://render.com
- Connect your GitHub repo containing `server.js` + `package.json`
- Build command: `npm install`
- Start command: `node server.js`
- Copy your Render URL e.g. `https://your-app.onrender.com`

### 2. Set your Render URL
Edit `config.js`:
```js
var RENDER_SERVER_URL = "https://your-app.onrender.com";
```

### 3. Host frontend on GitHub Pages
- Push all files to a GitHub repo
- Settings → Pages → select branch
- Visit `https://<username>.github.io/<repo>/`

## Files

| File | Purpose |
|---|---|
| `index.html` | Entire UI |
| `config.js` | **Edit this** — set your Render URL |
| `data.js` | API layer (talks to Render server) |
| `ai.js` | Puter.ai engine (all models) |
| `ui.js` | All rendering |
| `app.js` | Auth + Guest mode |
| `server.js` | Node.js/Express backend for Render |
| `package.json` | Render/Node dependencies |

## AI Backend
Powered entirely by **Puter.ai** (free, no API key needed).
On first use a Puter sign-in popup appears — users pay from their own Puter account.

Available models:
- Llama 3.3 70B (Meta) — default
- Llama 3.1 8B (Meta, fast)
- Mistral 7B
- Mixtral 8x7B
- Qwen3 30B / 235B
- Gemini 2.5 Flash (Google)
- GPT-4o Mini / GPT-4o (OpenAI)

## User Modes
- **Account User** — full access (create characters, follow, DM, group chat)
- **Guest User** — browse and chat with public characters, no account needed

## Data storage on Render
Render creates JSON files in `data/`:
- `users_db.json` — all registered accounts
- `public_chars.json` — published characters (only visible to their creator + public)
- `chars_<username>.json` — each user's characters
- `chats_<username>.json` — chat history per user
- `personas_<username>.json` — personas per user
- `follow_<username>.json` — following/followers

> **Tip:** Render free tier sleeps after inactivity. Use UptimeRobot (free) to ping your
> server URL every 5 minutes to keep it awake.
