# The AI Briefing

A personal AI-news dashboard as an installable PWA. Two lanes — **Frontier & Global**
and **India & Governance** — with headlines refreshed automatically by a GitHub Action.
No server, no database, no third-party relay in normal operation.

## How it works
- A GitHub Action (`.github/workflows/update-feeds.yml`) runs every 3 hours, fetches the
  RSS/Atom feeds server-side (`scripts/fetch-feeds.js`), and commits `feeds.json`.
- `index.html` reads `feeds.json` from its own origin — fast, same-origin, no CORS.
- If `feeds.json` is missing or a source is empty, the app falls back to a public reader
  relay so it still works on day one.
- `sw.js` caches the app shell for offline use and keeps `feeds.json` network-first.

## Setup (about 10 minutes)
1. Create a new GitHub repo, e.g. `ai-briefing`.
2. Upload everything in this folder, keeping the structure
   (`index.html`, `manifest.webmanifest`, `sw.js`, `feeds.json`, `icons/`,
   `scripts/`, `.github/workflows/`).
3. **Settings → Pages →** Source: `Deploy from a branch`, Branch: `main` / `root`. Save.
4. **Settings → Actions → General →** Workflow permissions: select
   **Read and write permissions**. Save. (Lets the Action commit `feeds.json`.)
5. **Actions** tab → *Refresh feeds* → **Run workflow** once to populate `feeds.json`.
6. Open `https://<your-username>.github.io/ai-briefing/` on your iPhone →
   Share → **Add to Home Screen**.

## Customise
- Edit the `SOURCES` array in `index.html` to add/remove cards (name, tier, desc, url).
- For a source to show live headlines, also add it (same `name`) to `FEEDS` in
  `scripts/fetch-feeds.js`.
- Change the schedule via the `cron` line in the workflow.
- After editing `index.html`, bump `CACHE` in `sw.js` (e.g. `v1` → `v2`) so devices
  pick up the new version.
