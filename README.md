[README.md](https://github.com/user-attachments/files/32366232/README.md)
# Creating Bespoke Learning Activities

Static site, ready for GitHub Pages.

## Files
- `index.html` — main page markup
- `styles.css` — custom CSS (Tailwind itself still loads from CDN)
- `tailwind-config.js` — Tailwind theme config (fonts/colors)
- `vending-machine.js` — React/Babel component (the vending-machine simulator), loaded via `<script type="text/babel" src="...">`
- `app.js` — vanilla JS app logic (tabs, requirements table, prompt/sticky-notes builder, sequence compiler)

## Deploy to GitHub Pages
1. Create a new GitHub repo (or use an existing one).
2. Put these 5 files in the repo root (or in a `docs/` folder if you prefer).
3. Push to GitHub.
4. In the repo: **Settings → Pages → Source**, pick the branch (and `/docs` folder if used).
5. Wait a minute, then visit the URL GitHub gives you (e.g. `https://<username>.github.io/<repo>/`).

## Notes
- All external dependencies (Tailwind, React, Babel, Google Fonts) still load from their CDNs — no build step needed, no npm install required.
- Babel-in-browser (used for `vending-machine.js`) compiles JSX on page load; this is fine for a small static demo but is noticeably slower than a build step for larger apps.
