# Private Flow — Forever Build

Goal: **Private Flow can be rebuilt and reinstalled forever from your own assets or
a local offline bundle — with no dependency on OpenWhispr keeping their GitHub
releases alive.**

This document explains the asset system, how to build the offline bundle, how to
mirror assets to your own GitHub Release, and how to install on a clean machine
(with or without internet).

> Nothing here uploads, publishes, commits, or deploys anything. The offline
> bundle lives under `artifacts/` (git-ignored). Publishing a GitHub Release is a
> manual step you perform yourself.

---

## 1. How downloads are routed

Every build-time download funnels through `downloadFile()` in
`scripts/lib/download-utils.js`, which now consults the Private Flow resolver
(`scripts/lib/asset-source.js`). Priority per asset:

1. **Offline bundle** — `artifacts/private-flow-offline-bundle/**` (fully local, no network)
2. **Private release** — `${PRIVATE_FLOW_ASSET_BASE_URL}/<assetName>`
3. **Neutral upstream** — the original URL, only if it is **not** an OpenWhispr-owned release
4. **OpenWhispr upstream** — the original URL, only if `ALLOW_UPSTREAM_ASSET_FALLBACK=true`

If an **OpenWhispr-owned** asset (`github.com/OpenWhispr/*`) is missing and no
private source is configured and fallback is disabled, the download **fails with a
clear message** instead of silently reaching out to OpenWhispr. That is the whole
point: Private Flow never *silently* depends on OpenWhispr releases.

Neutral upstreams (llama.cpp, qdrant, sherpa-onnx, HuggingFace models, nircmd)
still work out of the box so `npm run dev` is never broken on a clean machine —
but you can (and should) mirror them too for a true forever build.

### Environment variables

| Variable | Effect |
|---|---|
| `PRIVATE_FLOW_ASSET_BASE_URL` | Base URL of your own release; tried before upstream. Also settable via `package.json` → `privateFlow.assetBaseUrl`. |
| `ALLOW_UPSTREAM_ASSET_FALLBACK` | `true` re-enables OpenWhispr-owned upstream fallback (off by default). |
| `PRIVATE_FLOW_CACHE_DIR` | Overrides the model cache directory (see §6). |

---

## 2. Which assets Private Flow needs

Run the audit to see live status (present / size / required / owned):

```bash
npm run assets:audit
```

The authoritative descriptor is `scripts/lib/asset-manifest.js`; a resolved
snapshot with sha256 is written to `private-flow-assets.manifest.json` by
`assets:audit --write`.

**Required for a Windows x64 build:** whisper-server, llama-server, sherpa-onnx,
qdrant, whisper-vad model, a Whisper GGML model (`ggml-base.bin`), and the
all-MiniLM-L6-v2 embedding model. **Optional (graceful fallback):**
meeting-aec-helper, windows-key-listener, windows-fast-paste,
windows-mic-listener, windows-text-monitor, nircmd, `ggml-small.bin` (and larger)
Whisper models, diarization models.

**Recommended minimum bundle:** the offline bundle ships **both** `ggml-base.bin`
(~142 MB, the default) and `ggml-small.bin` (~466 MB, higher accuracy) so a clean
install can pick either without any download. Larger models (`medium`, `large`,
`turbo`) are deliberately **not** bundled — pull them on demand with
`npm run download:local-model -- --model <name>` if you want them.

**OpenWhispr-owned (mirror these first):** `whisper-server` (from
`OpenWhispr/whisper.cpp`) and all the Windows helper binaries (from
`OpenWhispr/openwhispr`).

---

## 3. Build the offline bundle

On a machine that already has the assets downloaded (i.e. after a normal
`npm run dev` / `npm run prebuild:win`):

```bash
npm run assets:bundle     # copies binaries + models into artifacts/private-flow-offline-bundle
npm run assets:verify     # recomputes and checks every sha256
```

The bundle contains the **extracted, ready-to-run** `resources/bin` (with every
sibling DLL) plus the model files (`ggml-base.bin` **and** `ggml-small.bin`, the
MiniLM embedding model, diarization models), `manifest.json`, `checksums.sha256`,
and a `README.md`. It is git-ignored. Copy the folder to a USB drive / backup for
"forever" safekeeping. A full Windows x64 bundle with both Whisper models is
~900 MB.

> **Never commit the bundle or any heavy asset.** `artifacts/` and `resources/bin/`
> are git-ignored directories, and `.gitignore` also blocks `*.exe`, `*.bin`,
> `*.onnx`, `*.zip`, `*.7z` as defense-in-depth. Commit only source, docs,
> `package.json`, `.gitignore`, and `private-flow-assets.manifest.json` (the
> resolved manifest is small text and safe to track).

---

## 4. Mirror assets to your own GitHub Release (manual)

For an online rebuild from your own infrastructure (instead of the offline
bundle):

```bash
npm run assets:print-upload-list
```

This prints, for each asset, the exact **release filename** and where to obtain
it. Then, **manually**:

1. Download each listed file from its "obtain from" source (for OpenWhispr-owned
   ones, grab them from the current `OpenWhispr/*` release **while it still
   exists**, or rebuild them from source).
2. Create a Release in **your** fork with tag **`private-flow-assets-v1`**.
3. Upload every file, keeping the exact release filename.
4. Configure the base URL:

   ```bash
   export PRIVATE_FLOW_ASSET_BASE_URL=https://github.com/<owner>/<repo>/releases/download/private-flow-assets-v1
   # or set package.json → privateFlow.assetBaseUrl
   ```

Now `npm run prebuild:win` pulls from your release first.

> This repo does **not** publish the release for you. Steps 2–3 are manual and
> intentionally left to you.

---

## 5. Install scenarios

### Case A — online, your own release
```bash
export PRIVATE_FLOW_ASSET_BASE_URL=https://github.com/<owner>/<repo>/releases/download/private-flow-assets-v1
npm run setup:local     # whisper-server + base model
npm run dev
```

### Case B — no internet (offline bundle)
```bash
# copy artifacts/private-flow-offline-bundle/ into the repo first
npm run setup:offline
npm run dev
```

### Case C — clean PC
```bash
git clone <your-fork>
npm install
# then either Case A (set PRIVATE_FLOW_ASSET_BASE_URL) or Case B (copy the bundle)
npm run setup:local   # or: npm run setup:offline
npm run dev
```

---

## 6. Cache location (`~/.cache/openwhispr` → `~/.cache/private-flow`)

The app currently reads models from `~/.cache/openwhispr` (a purely local path —
**not** a cloud dependency). Renaming it touches ~7 runtime files and would
orphan already-downloaded models, so the switch is **opt-in and non-destructive**:

```bash
npm run assets:migrate-cache            # dry run — shows what would copy
npm run assets:migrate-cache -- --apply # COPIES (never moves/deletes) to ~/.cache/private-flow
```

A resolver `resolvePrivateFlowCachePath()` exists in
`src/helpers/modelDirUtils.js` with preference order
`PRIVATE_FLOW_CACHE_DIR` → `~/.cache/private-flow` (if present) → `~/.cache/openwhispr`.
It is provided for a future, deliberate switch of every runtime call site; until
that wiring lands, the active default remains `~/.cache/openwhispr` so existing
installs keep working with zero migration.

---

## 7. What still depends on third parties

- **Neutral upstreams** (llama.cpp, qdrant, sherpa-onnx, HuggingFace models,
  NirSoft nircmd) remain the *original* source unless you mirror them. They are
  not OpenWhispr, but for a true forever build, mirror them into your release
  and/or the offline bundle too.
- **OpenWhispr-owned** assets are gated by default; mirror them (§4) or ship them
  in the offline bundle (§3).

See `docs/third-party-assets.md` for licenses and attribution.
