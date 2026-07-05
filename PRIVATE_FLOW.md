# Private Flow

Private Flow is a **private, local-first desktop dictation app**. It runs fully offline on
this device: your voice is transcribed locally with `whisper.cpp` (whisper-server), cleaned
up with local rules, and pasted into whatever app you're using. **No account, no login, and
no cloud are required.**

Private Flow is a private hard-fork built on the open-source OpenWhispr codebase (MIT). See
[Attribution](#attribution). The visible product is Private Flow; it does not depend on, log
into, or route data through any OpenWhispr cloud service in local mode.

---

## What works locally (offline)

- Global dictation hotkey
- Local/offline transcription via bundled `whisper.cpp` + local `whisper-server`
- Local Whisper models (GGML)
- Local text cleanup + voice commands (rule-based, no LLM required)
- Auto-paste into the focused app
- Local transcription history (SQLite)
- Local semantic note search (Qdrant + MiniLM, all local)
- LAN mobile bridge + Android IME (optional)

Cloud providers (OpenAI/Anthropic/etc.) and account sign-in are **off by default** and only
appear if you deliberately opt in (see [Optional cloud](#optional-cloud-advanced)).

---

## Identity

| Field | Value |
|---|---|
| Product name | **Private Flow** |
| npm package name | `private-flow` |
| App ID | `local.privateflow.desktop` |
| userData (dev) | `%APPDATA%\PrivateFlow-development` |
| userData (prod) | `%APPDATA%\PrivateFlow` |
| Installer | `Private Flow Setup` |

---

## Run it in development (Windows)

```powershell
npm install          # use Node 24 (see .nvmrc)
npm run dev          # compiles native helpers, downloads local sidecars, launches Electron
```

On first launch it will:
- start `whisper-server` locally,
- start the Qdrant sidecar locally,
- auto-download the local embedding model if missing.

The window title bar and onboarding read **"Welcome to Private Flow"**, and onboarding shows a
single **"Start Private Flow"** button — no Google / Microsoft / email / SSO buttons.

### Test the dictation hotkey

1. Open the app; complete the local onboarding ("Start Private Flow").
2. Make sure a Whisper model is installed (the `base` model, ~141 MB, is the default).
3. Press the dictation hotkey (Windows default: **Ctrl + Super**, i.e. Ctrl + Windows key;
   falls back to **F8** if that combo is taken). Tap once to start, tap again to stop.
4. Speak, stop, and the transcript is pasted into the focused text field.

### Test that it works with no internet

1. Disconnect the network (airplane mode / unplug).
2. In Settings → Transcription, confirm **Local Whisper** is selected (local mode).
3. Dictate as above — transcription, cleanup, and paste all run locally with the network off.
4. There should be **no** "API URL not configured" errors and no cloud calls (local mode skips
   the cloud STT config IPC entirely).

---

## Where the models live

- Whisper models: `C:\Users\<you>\.cache\openwhispr\whisper-models\`
- Embedding model: `C:\Users\<you>\.cache\openwhispr\embedding-models\all-MiniLM-L6-v2\`
- Local sidecar binaries: `resources/bin/`

> Note: the on-disk cache folder is still named `.cache\openwhispr\` on purpose — renaming it
> would orphan models you've already downloaded. It is a local path only; nothing about it
> reaches the OpenWhispr service. An opt-in, non-destructive migration to
> `.cache\private-flow\` is available via `npm run assets:migrate-cache -- --apply`
> (see [docs/forever-build.md](docs/forever-build.md) §6).

---

## Optional cloud (advanced)

Everything cloud-related is opt-in and never blocks local mode:

- **Account / sign-in** is disabled unless you set `VITE_AUTH_URL` to your own auth backend.
  With it unset (default), `authClient` is `null` and no login UI is shown.
- **Cloud transcription / reasoning** requires `VITE_OPENWHISPR_API_URL` to be set (empty by
  default) — otherwise the app never calls a cloud API.
- BYOK providers (OpenAI, Anthropic, Gemini, Groq, etc.) work only if you paste your own API
  key in Settings.

---

## Auto-updates

Auto-update is **disabled** (`UPDATES_DISABLED = true` in `src/updater.js`). The upstream
release feed points at the public OpenWhispr GitHub releases, so leaving updates on would
replace this private fork with the original product. It stays off.

---

## What changed in this fork (summary)

- Cloud auth off by default → onboarding is a local "Start Private Flow" screen (no
  Google/Microsoft/email/SSO/terms as the primary path).
- Fixed the renderer crash `Cannot read properties of undefined (reading 'onToggleDictation')`
  by making the dictation-overlay IPC listeners degrade gracefully when the preload bridge is
  not yet ready.
- Identity set to Private Flow (`private-flow`, `local.privateflow.desktop`, `PrivateFlow`
  userData, "Private Flow" product/installer names).

## Forever build (self-hosted assets)

Private Flow can be rebuilt/reinstalled forever without depending on OpenWhispr releases.
See [docs/forever-build.md](docs/forever-build.md) and
[docs/third-party-assets.md](docs/third-party-assets.md).

- `npm run assets:audit` — list required/optional assets and local status
- `npm run assets:bundle` — build a fully-offline bundle under `artifacts/` (git-ignored)
- `npm run assets:verify` — checksum-verify the bundle
- `npm run assets:print-upload-list` — files to mirror to your own GitHub Release
- `npm run setup:offline` — install from the offline bundle (no internet)

Build-time downloads now prefer your offline bundle / `PRIVATE_FLOW_ASSET_BASE_URL` and
**never silently fall back to OpenWhispr-owned releases** (gated behind
`ALLOW_UPSTREAM_ASSET_FALLBACK=true`).

## Still pending (not required to run in dev)

These are build/attribution items, not runtime dependencies — see the delivery report:

- A few secondary/dormant identifiers remain internal-only (OAuth `openwhispr://` scheme,
  D-Bus `com.openwhispr.App`, `OPENWHISPR_*` env var names, cloud/CLI/MCP/share URLs that are
  only reachable if you opt into cloud).
- Non-English locale files still contain a couple of legacy brand strings; English is updated.
- Windows code-signing config still references the upstream publisher — irrelevant for
  unsigned private builds (`npm run pack`).

---

## Attribution

Built on [OpenWhispr](https://github.com/OpenWhispr/openwhispr) (MIT License) and
[whisper.cpp](https://github.com/ggml-org/whisper.cpp) (MIT). The original `LICENSE`
(`Copyright (c) 2024 OpenWhispr Team`) is retained as required by the MIT license.
