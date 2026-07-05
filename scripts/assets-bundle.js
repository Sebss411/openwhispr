#!/usr/bin/env node
// Private Flow — assets:bundle
// Builds a fully-offline, ready-to-run bundle under
// artifacts/private-flow-offline-bundle/ from binaries/models already on disk.
// The bundle is git-ignored (local artifact only). Nothing is uploaded.
//
// Layout:
//   windows-x64/bin/         <- entire resources/bin (binaries + all sibling DLLs)
//   models/whisper-models/   <- ggml-base.bin (+ ggml-small.bin if present)
//   models/embedding-models/ <- all-MiniLM-L6-v2
//   models/diarization-models/
//   manifest.json, checksums.sha256, README.md
//
// Usage: node scripts/assets-bundle.js [--force]

const fs = require("fs");
const os = require("os");
const path = require("path");
const { APP_NAME, REPO_ROOT, BUNDLE_DIR, sha256Of } = require("./lib/asset-manifest");

const RESOURCES_BIN = path.join(REPO_ROOT, "resources", "bin");
const CACHE_ROOT = path.join(os.homedir(), ".cache", "openwhispr");

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return 0;
  fs.mkdirSync(dest, { recursive: true });
  let count = 0;
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) count += copyDir(s, d);
    else if (entry.isFile()) {
      fs.copyFileSync(s, d);
      count++;
    }
  }
  return count;
}

function copyFileInto(srcFile, destDir) {
  if (!fs.existsSync(srcFile)) return false;
  fs.mkdirSync(destDir, { recursive: true });
  fs.copyFileSync(srcFile, path.join(destDir, path.basename(srcFile)));
  return true;
}

function walkFiles(dir, base = dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkFiles(full, base));
    else if (entry.isFile()) out.push(path.relative(base, full).split(path.sep).join("/"));
  }
  return out;
}

function main() {
  console.log(`\n[assets:bundle] Building ${APP_NAME} offline bundle at:\n  ${BUNDLE_DIR}\n`);
  fs.mkdirSync(BUNDLE_DIR, { recursive: true });

  // 1. Windows binaries (whole resources/bin so every sibling DLL travels with it)
  const binDest = path.join(BUNDLE_DIR, "windows-x64", "bin");
  const nBin = copyDir(RESOURCES_BIN, binDest);
  console.log(`  windows-x64/bin ......... ${nBin} files from resources/bin`);

  // 2. Whisper models (base required; small optional if present) — skip the huge ones
  const whisperSrc = path.join(CACHE_ROOT, "whisper-models");
  const whisperDest = path.join(BUNDLE_DIR, "models", "whisper-models");
  let nWhisper = 0;
  for (const m of ["ggml-base.bin", "ggml-small.bin"]) {
    if (copyFileInto(path.join(whisperSrc, m), whisperDest)) {
      nWhisper++;
      console.log(`  models/whisper-models ... ${m}`);
    }
  }
  if (nWhisper === 0) console.log(`  models/whisper-models ... (none found — run: npm run download:local-model)`);

  // 3. Embedding model
  const embSrc = path.join(CACHE_ROOT, "embedding-models");
  const nEmb = copyDir(embSrc, path.join(BUNDLE_DIR, "models", "embedding-models"));
  console.log(`  models/embedding-models . ${nEmb} files`);

  // 4. Diarization models (runtime cache path copy)
  const diarSrc = path.join(CACHE_ROOT, "diarization-models");
  const nDiar = copyDir(diarSrc, path.join(BUNDLE_DIR, "models", "diarization-models"));
  console.log(`  models/diarization-models ${nDiar} files`);

  // 5. Regenerate manifest with hashes and copy into the bundle
  const { execFileSync } = require("child_process");
  try {
    execFileSync(process.execPath, [path.join(__dirname, "assets-audit.js"), "--write"], {
      stdio: "ignore",
    });
    const rootManifest = path.join(REPO_ROOT, "private-flow-assets.manifest.json");
    if (fs.existsSync(rootManifest)) {
      fs.copyFileSync(rootManifest, path.join(BUNDLE_DIR, "manifest.json"));
    }
  } catch (e) {
    console.warn(`  [assets:bundle] manifest generation skipped: ${e.message}`);
  }

  // 6. checksums.sha256 over every bundled file (excluding the checksum file itself)
  console.log(`\n  Computing checksums…`);
  const files = walkFiles(BUNDLE_DIR).filter(
    (f) => f !== "checksums.sha256" && f !== "README.md"
  );
  const lines = files.map((rel) => `${sha256Of(path.join(BUNDLE_DIR, rel))}  ${rel}`);
  fs.writeFileSync(path.join(BUNDLE_DIR, "checksums.sha256"), lines.join("\n") + "\n");
  console.log(`  checksums.sha256 ........ ${lines.length} entries`);

  // 7. README
  const totalBytes = files.reduce((s, rel) => s + fs.statSync(path.join(BUNDLE_DIR, rel)).size, 0);
  fs.writeFileSync(path.join(BUNDLE_DIR, "README.md"), readme(totalBytes, files.length));

  console.log(
    `\n[assets:bundle] Done. ${files.length} files, ${(totalBytes / 1024 / 1024).toFixed(0)} MB.`
  );
  console.log(`  Verify with:  npm run assets:verify`);
  console.log(`  Install with: npm run setup:offline\n`);
}

function readme(totalBytes, fileCount) {
  return `# ${APP_NAME} — Offline Bundle

Local, git-ignored artifact. Ready-to-run binaries and models so ${APP_NAME}
can be rebuilt / reinstalled **without any internet access** and **without
depending on OpenWhispr releases**.

- Files: ${fileCount}
- Size: ${(totalBytes / 1024 / 1024).toFixed(0)} MB
- Generated: ${new Date().toISOString()}

## Layout

- \`windows-x64/bin/\` — entire \`resources/bin\` (whisper-server, llama-server,
  qdrant, sherpa-onnx, helper .exe files, and all sibling DLLs)
- \`models/whisper-models/\` — Whisper GGML model(s) (at least \`ggml-base.bin\`)
- \`models/embedding-models/\` — all-MiniLM-L6-v2 (semantic search)
- \`models/diarization-models/\` — speaker diarization models
- \`manifest.json\` — resolved asset manifest with sha256
- \`checksums.sha256\` — checksums for every file above

## Install on a clean machine (no internet)

1. Copy this whole folder to \`artifacts/private-flow-offline-bundle/\` in the repo.
2. \`npm install\`  (dependencies only)
3. \`npm run setup:offline\`
4. \`npm run dev\`

See \`docs/forever-build.md\` for full instructions and attribution.
`;
}

main();
