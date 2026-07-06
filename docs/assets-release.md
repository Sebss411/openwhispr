# Private Flow — GitHub Assets Release (`private-flow-assets-v1`)

How to publish, mirror, and rebuild Private Flow from **your own** GitHub Release
so a clean PC never depends on OpenWhispr keeping their releases alive.

This complements [`docs/forever-build.md`](./forever-build.md) (the asset system
and offline bundle). Here we focus on the **online mirror** path: creating the
`private-flow-assets-v1` release and installing from it.

> Nothing in this repo publishes a release or uploads assets for you. Every step
> that touches GitHub is manual and left to you.

---

## 1. Purpose of `private-flow-assets-v1`

The resolver (`scripts/lib/asset-source.js`) resolves each build-time download in
this priority order:

1. **Offline bundle** — `artifacts/private-flow-offline-bundle/**`
2. **Your private release** — `${PRIVATE_FLOW_ASSET_BASE_URL}/<releaseFileName>`
3. **Neutral upstream** — the original URL (llama.cpp, qdrant, sherpa, HF, nircmd)
4. **OpenWhispr upstream** — only if `ALLOW_UPSTREAM_ASSET_FALLBACK=true` (off by default)

`private-flow-assets-v1` is the release that fills step 2. Mirroring the
**OpenWhispr-owned** assets there (whisper-server + the Windows helpers) is what
removes the silent dependency on OpenWhispr — those are *gated off* upstream by
default, so without a mirror or the offline bundle they fail closed with
`PRIVATE_FLOW_ASSET_MISSING`.

**Critical naming rule:** the resolver fetches by the **basename of the original
upstream URL** (`assetNameFromUrl`). Upload every file under the exact
`releaseFileName` printed by `assets:print-upload-list`. Two assets have generic
upstream basenames and must be uploaded as such:

- MiniLM embedding model → **`model.onnx`** (not `all-MiniLM-...`)
- MiniLM tokenizer → **`tokenizer.json`**

Rename them and the resolver 404s, then silently falls back to HuggingFace.

---

## 2. Generate the upload folder

```bash
npm run assets:audit             # live present/size/required/owned status
npm run assets:print-upload-list # exact releaseFileName + where to obtain each
```

A staging helper produces a git-ignored folder with the directly-uploadable
files, `checksums.sha256`, `upload-manifest.json`, and `RELEASE_UPLOAD_CHECKLIST.md`:

```
artifacts/private-flow-release-upload/private-flow-assets-v1/
```

Of the 17 assets, 6 are the on-disk file itself (upload as-is); 10 exist only as
**extracted binaries** so you must re-obtain the original `.zip`/`.tar.bz2` from
upstream before uploading them; 1 (`windows-mic-listener`) is optional and absent.
The offline bundle needs none of the archives — see §7.

---

## 3. Create the release (manual)

1. `https://github.com/<owner>/<repo>/releases/new`
2. Tag: **`private-flow-assets-v1`**  ·  Title: **`Private Flow Assets v1`**
3. Attach every file, keeping the exact `releaseFileName` — do not rename or re-zip.
4. Publish.

## 4. Upload by UI

Drag the files from `artifacts/private-flow-release-upload/private-flow-assets-v1/`
(plus the re-obtained archives) into the release's "Attach binaries" box. Verify
each keeps its exact name.

## 5. Upload by `gh` CLI

`gh` may not be installed on the build machine (`winget install GitHub.cli`, then
`gh auth login`). The exact `gh release create` / `gh release upload` commands are
generated into `RELEASE_UPLOAD_CHECKLIST.md` inside the upload folder. Example:

```powershell
gh release create private-flow-assets-v1 --repo <owner>/<repo> `
  --title "Private Flow Assets v1" `
  artifacts/private-flow-release-upload/private-flow-assets-v1/ggml-base.bin `
  artifacts/private-flow-release-upload/private-flow-assets-v1/model.onnx `
  ...
```

---

## 6. Configure `PRIVATE_FLOW_ASSET_BASE_URL`

```bash
export PRIVATE_FLOW_ASSET_BASE_URL=https://github.com/<owner>/<repo>/releases/download/private-flow-assets-v1
# or: package.json → privateFlow.assetBaseUrl
```

Then `npm run assets:audit` / `npm run prebuild:win` resolve your release first.

### Verify the mirror actually serves (before trusting it)

The mirror path is validated against a local HTTPS stand-in (the same code path a
real release uses). Guarantees:

1. **Naming** — filename the resolver requests == upload-list name (all 17 assets).
2. **Serving** — byte-for-byte (sha256) identical; **owned assets come from your
   mirror, never OpenWhispr**.
3. **Fail-closed** — owned asset, no mirror, fallback off → `PRIVATE_FLOW_ASSET_MISSING`.
4. **Precedence** — the offline bundle always wins over the mirror.

---

## 7. Install on a clean PC

### Online, from your release
```bash
git clone <your-fork> && cd openwhispr
npm install
export PRIVATE_FLOW_ASSET_BASE_URL=https://github.com/<owner>/<repo>/releases/download/private-flow-assets-v1
export ALLOW_UPSTREAM_ASSET_FALLBACK=false     # keep OpenWhispr gated
npm run setup:local        # whisper-server + base model from YOUR release
npm run dev
```

### Offline, from the bundle (no release needed)
```bash
git clone <your-fork> && cd openwhispr
npm install
# copy artifacts/private-flow-offline-bundle/ into the repo
npm run setup:offline
npm run dev
```

Use a clean, throwaway cache for a true test so an existing
`~/.cache/openwhispr` doesn't mask a broken release:

```bash
export PRIVATE_FLOW_CACHE_DIR=/path/to/temp-cache
```

---

## 8. Confirm it does NOT use OpenWhispr (negative test)

With **no** `PRIVATE_FLOW_ASSET_BASE_URL`, **no** offline bundle, and
`ALLOW_UPSTREAM_ASSET_FALLBACK` unset, resolving an OpenWhispr-owned asset must
throw:

```
PRIVATE_FLOW_ASSET_MISSING
```

It must never silently download from `github.com/OpenWhispr/*`. Neutral upstreams
(llama.cpp, qdrant, sherpa, HuggingFace, nircmd) still resolve so `npm run dev` is
never bricked on a clean machine.

---

## 9. Publishing `private-flow-assets-v2` later

When you rev a binary (new whisper-server, new model), create a **new** tag
`private-flow-assets-v2`, upload the changed files (keep unchanged ones or re-upload
all), and point `PRIVATE_FLOW_ASSET_BASE_URL` at the v2 download base. Bump
`releaseFileName` in `scripts/lib/asset-manifest.js` only if the upstream basename
changes; then regenerate the snapshot with `npm run assets:audit -- --write`.

---

## 10. What NOT to commit

Never commit heavy assets or the staging/build output. All git-ignored:

- `artifacts/` (offline bundle **and** the release-upload folder)
- `out/`, `dist/`, `node_modules/`
- `*.exe`, `*.bin`, `*.onnx`, `*.zip`, `*.7z`
- any temp cache / clean-install test dir

Commit only source, docs, `package.json`, `.gitignore`, and the small resolved
`private-flow-assets.manifest.json`.

---

## 11. Known issues

- **SmartScreen** — the RC is an *unsigned* build; Windows SmartScreen warns on
  first run until you sign it. Not an asset-release problem.
- **Neutral upstreams** still point at their original hosts unless you mirror them
  into the release/bundle too. They are not OpenWhispr, but for a *true* forever
  build, mirror them.
- **`windows-mic-listener`** is optional and may be absent; meeting mic detection
  falls back to polling.
- **Legacy cache** — an existing `~/.cache/openwhispr` can satisfy assets locally
  and mask a broken release. Use `PRIVATE_FLOW_CACHE_DIR` for a clean test.
- **Archive assets** — whisper-server, llama-server, sherpa, qdrant, nircmd, the
  Windows helpers, and the diarization segmentation model live on a dev machine
  only as *extracted* binaries; re-obtain their original archives to populate the
  release (or just use the offline bundle, which ships the extracted binaries).
