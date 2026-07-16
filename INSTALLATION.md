# Impleo — Installation Guide

This document is written to be handed directly to an AI coding agent (Claude Code, Cursor, Copilot Workspace, etc.) so it can set up Impleo end-to-end with minimal supervision. A human can also follow it manually — every command is copy-pasteable.

> **Give this file to your AI agent** with a prompt like:
> *"Read INSTALLATION.md in the repo root and set up this project locally — install all dependencies, build the extension, and get the server running."*

<br />

## What gets installed

Impleo is two local pieces, not one app:

| Component | What it is | Needs a build step? |
|---|---|---|
| `extension/` | Chrome MV3 extension (React + Vite side panel) | Yes — builds to `extension/dist/` |
| `server/` | Local Express + SQLite API (owns your API key and data) | No — runs directly with Node |
| `landing/` | Marketing site (Vite + React) | Optional — not required to use Impleo |

There is no hosted backend and no `.env` file to configure — the server listens on `localhost` only, and your AI provider API key is entered once through the extension's onboarding/Settings UI, not through a config file.

<br />

## Prerequisites

Verify these before installing anything:

| Requirement | Minimum version | Check with |
|---|---|---|
| [Node.js](https://nodejs.org/) | 18.x or newer | `node -v` |
| npm | 9.x or newer (ships with Node) | `npm -v` |
| Git | any recent version | `git --version` |
| Chrome / Chromium browser | any recent version | Edge, Brave, and Arc also work |

If Node is missing or below v18, install it from [nodejs.org](https://nodejs.org/) (LTS release) before continuing. `better-sqlite3` in `server/` compiles a native module on install, so on Linux/macOS make sure standard build tools are present (`build-essential` / Xcode Command Line Tools); Windows users typically need nothing extra as npm ships prebuilt binaries for common platforms.

You will also need an **API key from at least one** of: [Anthropic](https://console.anthropic.com/), [Google Gemini](https://aistudio.google.com/), [OpenAI](https://platform.openai.com/), or [Groq](https://console.groq.com/). You don't need the key yet — it's entered later, inside the extension.

<br />

## Agent instructions — automated setup

If you are an AI agent executing this file, run the following steps in order. Stop and surface the exact error text if any step fails — do not skip a failing step and continue.

### Step 1 — Verify prerequisites

```bash
node -v   # must print v18.x.x or higher
npm -v
git --version
```

If any command is missing, stop and ask the human to install it — do not attempt to install Node/Git system packages yourself.

### Step 2 — Clone (skip if already in the repo)

```bash
git clone https://github.com/Agnik47/Impleo.git
cd Impleo
```

If you were invoked from inside an existing clone, skip this step and confirm you're at the repository root (a directory containing `extension/`, `server/`, and this file).

### Step 3 — Install server dependencies

```bash
cd server
npm install
```

Expected result: `node_modules/` created, no `npm error` output. `better-sqlite3` will compile a native binding during this step — this is normal and can take 10–30 seconds.

### Step 4 — Install extension dependencies

```bash
cd ../extension
npm install
```

Expected result: `node_modules/` created for the extension's Vite/React/Tailwind toolchain.

### Step 5 — Build the extension

```bash
npm run build
```

This runs Vite and produces `extension/dist/` — the folder Chrome loads as an unpacked extension. Confirm `extension/dist/manifest.json` exists after this step.

### Step 6 — Start the local server

```bash
cd ../server
npm start
```

Expected output:

```
Impleo server listening on http://localhost:3001
```

The server must **stay running** in this terminal (or as a background process) any time the extension is in use — it owns the API key, profile data, and all AI provider calls. If you started it as a background process, verify it's alive with:

```bash
curl -s http://localhost:3001/api/profile -o /dev/null -w "%{http_code}\n"
```

A `200` (or any HTTP response at all, including a 4xx) confirms the server is up and answering. A connection error means it isn't running.

> Server port is configurable via the `PORT` environment variable (defaults to `3001`) if `3001` is already in use on the host machine: `PORT=3002 npm start`.

### Step 7 — Load the unpacked extension (requires a human)

This step cannot be automated — Chrome's extension loading UI has no CLI equivalent. Hand these instructions back to the human:

1. Open `chrome://extensions` in Chrome (or Edge/Brave/Arc's equivalent settings page).
2. Enable **Developer mode** (toggle, top right).
3. Click **Load unpacked**.
4. Select the `extension/dist` folder produced in Step 5.
5. Pin the Impleo icon to the toolbar for easy access (optional).

### Step 8 — Configure an API key (requires a human)

Also not automatable — this is a one-time, human-entered secret, by design:

1. Click the Impleo icon to open the side panel.
2. Complete onboarding (name, resume/background info).
3. Open **Settings** and paste an API key for Anthropic, Gemini, OpenAI, or Groq.
4. Impleo runs a live test call before saving — a failure here means the key or model string is wrong, not that setup is broken.

### Step 9 — Verify the install

With the server running and the extension loaded:

1. Open any form (a Google Form works well for a first test).
2. Click the Impleo extension icon to open the side panel.
3. Click **Extract** — Impleo should detect the form's fields.
4. Click **Generate** — draft answers should appear as review cards.
5. Confirm nothing is written to the page until you explicitly click **Fill**.

If all five steps produce visible output with no console errors in `chrome://extensions` → Impleo → **Errors**, setup is complete.

<br />

## Manual quick reference

For a human running this by hand, the condensed command sequence:

```bash
git clone https://github.com/Agnik47/Impleo.git
cd Impleo

cd server && npm install && cd ..
cd extension && npm install && npm run build && cd ..

cd server && npm start
# leave this running — open a new terminal for anything else
```

Then load `extension/dist` as an unpacked extension via `chrome://extensions` and configure your API key through the side panel's Settings.

<br />

## Development workflow (after initial install)

| Task | Command | Notes |
|---|---|---|
| Rebuild extension after a code change | `cd extension && npm run build` | Then click the refresh icon on the extension card in `chrome://extensions` |
| Auto-rebuild on file change | `cd extension && npm run dev` | Runs `vite build --watch`; still needs a manual extension refresh in Chrome |
| Restart server with auto-reload on change | `cd server && npm run dev` | Uses `node --watch`, no extra tooling required |
| Run the landing page locally (optional) | `cd landing && npm install && npm run dev` | Unrelated to the extension/server — marketing site only |

<br />

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `npm install` fails on `better-sqlite3` with a compiler error | Missing native build tools | Install `build-essential` (Linux) or Xcode Command Line Tools (`xcode-select --install`, macOS); Windows usually needs nothing extra |
| Extension side panel shows a network/fetch error | Server isn't running, or is on a different port | Confirm `npm start` is running in `server/` and printed `listening on http://localhost:3001`; if you changed `PORT`, the extension still expects `3001` unless its API base URL is updated to match |
| `chrome://extensions` shows "Manifest file is missing or unreadable" | Selected the wrong folder | Point **Load unpacked** at `extension/dist`, not `extension/` |
| Changes to extension code don't appear in Chrome | Stale build or extension not reloaded | Re-run `npm run build` in `extension/`, then click the refresh icon on the Impleo card in `chrome://extensions` |
| API key test fails on save | Wrong key, wrong provider selected, or invalid model string | Re-check the key against the provider's own dashboard; try the provider's default model suggestion from the README's Configuration table |
| Port `3001` already in use | Another process is bound to it | Run the server with `PORT=3002 npm start` (or any free port) |

<br />

## Project structure reference

```
impleo/
├── extension/          Chrome MV3 extension (Vite + React + Tailwind) — build required
├── server/             Local Express + SQLite backend — run directly with Node
├── landing/            Marketing site (Vite + React) — optional, unrelated to core product
├── docs/               Product spec, architecture rationale, brand guide
├── IMages/             Product screenshots and brand assets
├── README.md           Product overview, features, architecture, privacy model
└── INSTALLATION.md      This file
```

See the [README](README.md) for the full product overview, architecture diagram, and privacy model. See `docs/` for deeper design rationale before proposing structural changes.

<br />

## License

Impleo is released under the [MIT License](LICENSE).
