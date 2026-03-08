# Character.ai Lite [UNOFFICIAL]

An unofficial, browser-based AI character chat application with a retro Windows XP aesthetic.
Designed for GitHub Pages hosting. No server required — runs entirely in the browser.

## Files

```
index.html   - Main page (HTML + CSS only, no emojis, IE9+ compatible)
data.js      - All storage: users, characters, personas, followers, visitors
ai.js        - AI engine: HuggingFace Mistral + Pollinations.ai fallback
ui.js        - All rendering, navigation, search, modals
app.js       - Auth (login/signup), app bootstrap, keyboard shortcuts

users/       - Folder concept: user.json files downloaded here
characters/  - Folder concept: character list JSON downloaded here
personas/    - Folder concept: persona list JSON downloaded here
```

## Deploying to GitHub Pages

1. Upload all files to your GitHub repository root (or a `docs/` folder)
2. Go to Settings > Pages > select your branch
3. Visit `https://<your-username>.github.io/<repo-name>/`

## Features

- **Login / Sign In** - Username + password only. No email or phone.
  A `user.json` file is automatically generated when an account is created.
- **Multi-account** - All user data is namespaced in localStorage so
  multiple accounts on the same browser work independently.
- **Characters** - Create private or public AI characters with name,
  greeting, personality, and optional profile picture.
- **Publish System** - Publish characters to the community Discover page.
  Private characters are only visible to their creator.
- **Messenger** - 1-on-1 chat with any character.
- **Group Chat** - Multi-bot conversation with sequential AI responses.
- **Personas** - Create multiple user personas to use in chats.
- **Discover** - Browse all public characters. Sort by newest, most visited, or A-Z.
- **Follower System** - Follow other users, visit their profiles,
  see their public characters.
- **Visitor Counter** - Each character tracks unique visitors.
  Same user visiting again does not increment the count.
- **Global Search** - Search users and characters from the header bar.
- **Download Folders** - Download your character list, persona list,
  and user.json as JSON files from your profile page.

## AI Backend

Tries HuggingFace Inference API (Mistral-7B-Instruct) first.
Falls back to Pollinations.ai (free, no key needed) if unavailable.

## Storage

All data is stored in `localStorage` in the browser.
Data is scoped per user so multiple accounts do not conflict.
No data is sent to any server except AI API calls.

## Notes

- This is UNOFFICIAL and not affiliated with Character.AI in any way.
- Runs fully client-side. Works offline except for AI responses.
- Compatible with modern browsers and most older browsers (IE9+).
