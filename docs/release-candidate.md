# Private Flow — Windows Release Candidate (RC)

Goal: **produce and verify a self-contained, unsigned Windows build of Private Flow
that installs and runs fully local/offline, carries the Private Flow identity (never
OpenWhispr), and can be rebuilt forever from your own assets — without publishing
anything.**

> Nothing in this document commits, pushes, uploads, deploys, or publishes. Creating
> the GitHub Release and distributing installers are manual steps you perform
> yourself. Build output (`dist/`, `out/`) and heavy assets are git-ignored.

Related: [`docs/forever-build.md`](forever-build.md) (asset system, offline bundle,
mirroring) and [`docs/third-party-assets.md`](third-party-assets.md) (licenses).

---

## 0. What "RC" means here

A Release Candidate is a build you could ship, verified against five gates:

1. The repo rebuilds from **your own / offline assets** (no silent OpenWhispr dependency).
2. Installer + portable come out named **Private Flow**, not OpenWhispr.
3. **Local/offline mode still works** (whisper-server, FFmpeg, Qdrant, base/small model).
4. **No heavy assets leaked into git.**
5. The packaged app **opens and dictates** (manual GUI check).

---

## 1. Prerequisites

- Node.js 24 (`.nvmrc`). Use `nvm exec 24 …` if your default differs.
- `npm install` already run (do **not** regenerate `package-lock.json` on a different Node major).
- Assets present locally. Verify with:

  ```bash
  npm run assets:audit      # expect: 0 required missing
  ```

  If anything required is missing, restore it from the offline bundle
  (`npm run setup:offline`) or your private release (see §3), or download neutral
  upstreams via the normal `npm run prebuild:win`.

---

## 2. Generate & verify the offline asset bundle (forever build)

On a machine that already has the assets:

```bash
npm run assets:bundle     # copies resources/bin + models → artifacts/private-flow-offline-bundle
npm run assets:verify     # recomputes every sha256, checks required-present
npm run assets:audit      # present/size/required/owned table
```

The bundle ships **both** `ggml-base.bin` (~142 MB) and `ggml-small.bin` (~466 MB),
the MiniLM embedding model, the Silero VAD model, diarization models, and the full
ready-to-run `resources/bin` (whisper-server, qdrant, sherpa-onnx, llama-server,
Windows helpers). A full Windows x64 bundle is ~900 MB. It lives under `artifacts/`
(git-ignored). **Copy it to a USB / backup drive for "forever" safekeeping.**

Larger Whisper models (`medium`, `large`, `turbo`) are deliberately **not** bundled —
pull them on demand: `npm run download:local-model -- --model <name>`.

---

## 3. Mirror assets to your own GitHub Release (manual) & configure the base URL

For an online rebuild from your own infrastructure instead of the offline bundle:

```bash
npm run assets:print-upload-list
```

Then, **manually**:

1. Download each listed file from its "obtain from" source. Mirror the
   **[OpenWhispr-owned]** ones first (whisper-server + Windows helpers) — upstream
   fallback for them is OFF by default.
2. Create a Release in **your** fork (`origin` = your fork) with tag
   **`private-flow-assets-v1`**. Upload each file under its exact release filename.
3. Configure the base URL (tried before any upstream):

   ```bash
   export PRIVATE_FLOW_ASSET_BASE_URL=https://github.com/<owner>/<repo>/releases/download/private-flow-assets-v1
   # or set package.json → privateFlow.assetBaseUrl
   ```

Resolution priority (see `scripts/lib/asset-source.js`):
**offline bundle → private release → neutral upstream → OpenWhispr upstream (only if
`ALLOW_UPSTREAM_ASSET_FALLBACK=true`)**. A missing OpenWhispr-owned asset with no
bundle and no private release fails with a clear `PRIVATE_FLOW_ASSET_MISSING` error —
it never silently reaches OpenWhispr.

---

## 4. Build the Windows installer (unsigned)

Signing uses OpenWhispr's Azure Trusted Signing account, which you do not have. Build
**unsigned** with the dedicated config `electron-builder.unsigned-win.json` (it extends
`electron-builder.json` and nulls `win.azureSignOptions`).

Canonical command (outputs to `dist/`):

```bash
# Git Bash
CSC_IDENTITY_AUTO_DISCOVERY=false npm run build:renderer && \
CSC_IDENTITY_AUTO_DISCOVERY=false npx electron-builder --win \
  --config electron-builder.unsigned-win.json --publish never
```

You do **not** need `prebuild:win` if `resources/bin/` is already populated (e.g. after
`npm run setup:offline`). Skipping it makes the build fully offline.

Expected artifacts in `dist/`:

- `Private Flow Setup 1.7.3.exe`  — NSIS installer
- `Private Flow 1.7.3.exe`        — portable
- `win-unpacked/Private Flow.exe` — unpacked app
- `latest.yml`, `*.blockmap`

**Output-directory note:** if `dist/` is locked (e.g. an editor is holding a stale
`app.asar`), redirect the output to a git-ignored dir instead of deleting the lock:

```bash
… npx electron-builder --win --config electron-builder.unsigned-win.json \
  -c.directories.output=out/rc-win --publish never
```

`out/` is git-ignored. To reclaim canonical `dist/`, close the file in your editor (or
restart it) and delete `dist/` — it is regenerable git-ignored output.

**Do not** run `npm run build:win` for an unsigned RC — that script uses the default
config with the Azure signing options.

---

## 5. Verify the packaged build

Automated (terminal) checks:

- Filenames in the output dir contain **Private Flow**, never **OpenWhispr**.
- `win-unpacked/resources/bin/` contains `whisper-server-win32-x64.exe` and
  `qdrant-win32-x64.exe` (sidecars bundled).
- App metadata: `appId = local.privateflow.desktop`, `productName = Private Flow`.

Manual GUI checklist (cannot be done headless — run on a Windows desktop):

- [ ] Run the installer → installs as **Private Flow** (Start Menu / desktop shortcut).
- [ ] Launch **Private Flow** (taskbar/app name is "Private Flow", not OpenWhispr).
- [ ] First run: you can **continue without an account** (no forced cloud login, no
      Google/Microsoft/email/SSO as the only path).
- [ ] AppData is `%APPDATA%\PrivateFlow` (prod) / `PrivateFlow-development` (dev).
- [ ] Press **Start Private Flow** → dashboard opens, no "OpenWhispr API URL not
      configured" error, no redirect to OpenWhispr.
- [ ] Open Notepad. Press the dictation hotkey (**Ctrl+Win** or **F8**). Speak ~5s. Stop.
- [ ] Transcribed text is **pasted** into Notepad.
- [ ] whisper-server / Qdrant start (check tray / logs); base or small model detected.

### Test without internet

- [ ] Disconnect the network. Repeat the dictate-and-paste check above. It must work
      (local Whisper, no cloud calls).

---

## 6. Git hygiene — what to keep vs never commit

**Keep as backup (outside git):**

- `artifacts/private-flow-offline-bundle/` (the ~900 MB offline bundle + checksums).
- The generated installer / portable (`dist/` or `out/rc-win/`).
- Your model cache `~/.cache/openwhispr/` (whisper + embedding + diarization models).

**Commit (source/docs/config only):**

- Source, docs, `package.json`, `.gitignore`, `private-flow-assets.manifest.json`.

**Never commit (all git-ignored; verify with `git status --short`):**

- `artifacts/`, `dist/`, `out/`, `build/`, `node_modules/`
- `*.exe`, `*.bin`, `*.onnx`, `*.zip`, `*.7z`, `*.dmg`, `*.AppImage`, `*.deb`, `*.rpm`
- user caches / models

---

## 7. Known issues / deferred

- **Unsigned build → Windows SmartScreen.** The installer/portable are unsigned, so
  SmartScreen will warn ("Windows protected your PC" → More info → Run anyway). Code
  signing requires provisioning your own certificate (the Azure config in
  `electron-builder.json` is OpenWhispr's and is nulled for unsigned builds).
- **Upstream fallback is gated, not automatic.** If you rely on OpenWhispr-owned assets
  and have neither the offline bundle nor a private release, the build fails by design.
  Mirror them (§3) or ship the bundle (§2).
- **Large Whisper models not bundled.** Only `base` + `small` ship in the offline
  bundle; `medium`/`large`/`turbo` are opt-in downloads.
- **iOS keyboard deferred.** Not part of this RC.
- **Android IME** (`apps/android-ime`, package `com.openwhispr.ime`) still needs a real
  on-device test in Android Studio; it is a separate companion app, out of the desktop
  RC scope.
- **Cross-platform identity items deferred (not Windows-relevant):**
  - `main.js` `app.setDesktopName("open-whispr.desktop")` — Linux Wayland only.
  - `resources/linux/after-install.sh` hardcodes `open-whispr` — Linux `.deb`/`.rpm` only.
  - `src/helpers/menuManager.js` Help → "Learn More" → OpenWhispr GitHub — macOS menu only.
  - `electron-builder.json` `protocols.schemes: ["openwhispr"]` deep-link scheme — kept
    to avoid breaking the mobile bridge / CLI; rename only after those consumers are
    re-verified.
  - `docs/network-allowlist.md` still describes the cloud hosts as "required by default";
    stale vs the actual local-first default — documentation-only, no runtime effect.
  These do not affect the Windows RC identity (installer, app name, appId, tray, titles
  are all Private Flow) and are tracked for their respective platform lotes.
