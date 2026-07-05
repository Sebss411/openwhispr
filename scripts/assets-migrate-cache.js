#!/usr/bin/env node
// Private Flow — assets:migrate-cache
// OPT-IN, non-destructive: COPIES ~/.cache/openwhispr → ~/.cache/private-flow.
// It never moves or deletes the old cache, so the current local mode keeps
// working. This only prepares the new default location; the runtime does not
// switch to it automatically (see src/helpers/modelDirUtils.js →
// resolvePrivateFlowCachePath, and docs/forever-build.md).
//
// Usage:
//   node scripts/assets-migrate-cache.js            # dry run (shows what would copy)
//   node scripts/assets-migrate-cache.js --apply    # perform the copy
//   node scripts/assets-migrate-cache.js --apply --force  # overwrite existing files

const fs = require("fs");
const os = require("os");
const path = require("path");

const OLD = path.join(os.homedir(), ".cache", "openwhispr");
const NEW = process.env.PRIVATE_FLOW_CACHE_DIR || path.join(os.homedir(), ".cache", "private-flow");
const APPLY = process.argv.includes("--apply");
const FORCE = process.argv.includes("--force");

function walk(dir, base = dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full, base));
    else if (entry.isFile()) out.push(path.relative(base, full));
  }
  return out;
}

function main() {
  console.log(`\n[assets:migrate-cache] Private Flow cache migration (copy-only)\n`);
  console.log(`  source: ${OLD}`);
  console.log(`  target: ${NEW}\n`);

  if (!fs.existsSync(OLD)) {
    console.log(`  Nothing to migrate — source cache does not exist.`);
    console.log(`  Private Flow will populate the cache normally on first run.\n`);
    return;
  }

  const files = walk(OLD);
  let toCopy = 0;
  let exists = 0;
  for (const rel of files) {
    const dest = path.join(NEW, rel);
    if (fs.existsSync(dest) && !FORCE) exists++;
    else toCopy++;
  }

  console.log(`  ${files.length} files found. ${toCopy} to copy, ${exists} already at target.`);

  if (!APPLY) {
    console.log(`\n  Dry run only. Re-run with --apply to copy (nothing was changed).\n`);
    return;
  }

  let copied = 0;
  for (const rel of files) {
    const src = path.join(OLD, rel);
    const dest = path.join(NEW, rel);
    if (fs.existsSync(dest) && !FORCE) continue;
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
    copied++;
  }
  console.log(`\n  Copied ${copied} files. Old cache left untouched at ${OLD}.\n`);
  console.log(
    `  To make the app use the new location this run, set PRIVATE_FLOW_CACHE_DIR=${NEW}\n`
  );
}

main();
