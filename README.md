# Orante — orante.net

Static site. No build step.

- `index.html` — the nave (landing + free-guide sheet)
- `app/index.html` — the day-by-day Ordo 1962 app (PWA)
- `feeds/*.ics` — calendar layers; regenerate each year with `node build-feeds.js 2027 --out feeds` from the source repo
- `plates/` — images

Hosted on GitHub Pages; `CNAME` points the custom domain.
