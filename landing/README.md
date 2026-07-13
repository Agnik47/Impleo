# Impleo — Landing Page

Standalone marketing site for Impleo, built from `docs/LANDING_PAGE.md` and the
Impleo Design System v2. It is **separate** from the extension (`extension/`) and
the local server (`server/`) — its own Vite + React + Tailwind app that can be
deployed to any static host (GitHub Pages, Vercel, Netlify).

Design tokens (colors, radii, fonts) are mirrored from
`extension/tailwind.config.js` so the site and the product share one look.

## Run locally

```bash
cd landing
npm install
npm run dev        # dev server (usually http://localhost:5173)
```

## Build for production

```bash
npm run build      # outputs to landing/dist/
npm run preview    # preview the production build
```

## Structure

```
landing/
  index.html            entry, sets <title> + description
  public/
    chameleon.png       mascot (copied from extension/icons/icon-128.png)
    hero.png            side-panel screenshot (copied from extension icons)
  src/
    main.jsx            React root
    App.jsx             all 11 sections (nav → hero → … → footer)
    ui.jsx              shared primitives: Container, Section, buttons, Reveal, Icon
    ReviewCardMock.jsx  styled mock of the in-product review card
    index.css           Tailwind entry + chameleon-shift gradient + reduced-motion
  tailwind.config.js    design tokens (mirrors the extension)
```

## Before shipping — see `docs/LANDING_PAGE.md` §11

- Replace `CHROME_STORE_URL` and `GITHUB_URL` placeholders in `src/App.jsx`.
- Swap the styled `ReviewCardMock` for a real side-panel screenshot if desired.
