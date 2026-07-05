#!/usr/bin/env node
// Private Flow — setup:offline
// Installs binaries + models from artifacts/private-flow-offline-bundle/ into the
// locations the app reads (resources/bin + ~/.cache/openwhispr). No internet.
// After this, `npm run dev` finds everything already present and downloads nothing.
//
// Usage: node scripts/setup-offline.js [--force]

const fs = require("fs");
const os = require("os");
const path = require("path");
const { APP_NAME, REPO_ROOT, BUNDLE_DIR } = require("./lib/asset-manifest");

const FORCE = process.argv.includes("--force");
const RESOURCES_BIN = path.join(REPO_ROOT, "resources", "bin");
const CACHE_ROOT = path.join(os.homedir(), ".cache", "openwhispr");

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return { copied: 0, skipped: 0 };
  fs.mkdirSync(dest, { recursive: true });
  let copied = 0;
  let skipped = 0;
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      const r = copyDir(s, d);
      copied += r.copied;
      skipped += r.skipped;
    } else if (entry.isFile()) {
      if (fs.existsSync(d) && !FORCE) {
        skipped++;
      } else {
        fs.copyFileSync(s, d);
        if (process.platform !== "win32") {
          try {
            fs.chmodSync(d, 0o755);
          } catch {
            /* best effort */
          }
        }
        copied++;
      }
    }
  }
  return { copied, skipped };
}

function step(label, src, dest) {
  if (!fs.existsSync(src)) {
    console.log(`  - ${label}: skipped (not in bundle)`);
    return;
  }
  const { copied, skipped } = copyDir(src, dest);
  console.log(`  - ${label}: ${copied} copied, ${skipped} already present`);
}

function main() {
  if (!fs.existsSync(BUNDLE_DIR)) {
    console.error(
      `[setup:offline] No offline bundle found at:\n  ${BUNDLE_DIR}\n\n` +
        `  Build it on a machine with the assets:  npm run assets:bundle\n` +
        `  then copy the folder here and re-run.`
    );
    process.exitCode = 1;
    return;
  }

  console.log(`\n[setup:offline] Installing ${APP_NAME} assets from offline bundle…`);
  console.log(`  (use --force to overwrite existing files)\n`);

  step("binaries → resources/bin", path.join(BUNDLE_DIR, "windows-x64", "bin"), RESOURCES_BIN);
  step(
    "whisper models → cache",
    path.join(BUNDLE_DIR, "models", "whisper-models"),
    path.join(CACHE_ROOT, "whisper-models")
  );
  step(
    "embedding model → cache",
    path.join(BUNDLE_DIR, "models", "embedding-models"),
    path.join(CACHE_ROOT, "embedding-models")
  );
  step(
    "diarization models → cache",
    path.join(BUNDLE_DIR, "models", "diarization-models"),
    path.join(CACHE_ROOT, "diarization-models")
  );

  console.log(`\n[setup:offline] Done. Now run:  npm run dev\n`);
}

main();
