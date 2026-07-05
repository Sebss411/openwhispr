#!/usr/bin/env node
// Private Flow — assets:verify
// Verifies the offline bundle against its checksums.sha256, and reports whether
// all REQUIRED manifest assets are present in the bundle.
//
// Usage: node scripts/assets-verify.js

const fs = require("fs");
const path = require("path");
const { APP_NAME, BUNDLE_DIR, ASSETS, sha256Of } = require("./lib/asset-manifest");

function main() {
  const checksumFile = path.join(BUNDLE_DIR, "checksums.sha256");
  if (!fs.existsSync(BUNDLE_DIR) || !fs.existsSync(checksumFile)) {
    console.error(
      `[assets:verify] No bundle/checksums found at ${BUNDLE_DIR}\n` +
        `  Build it first:  npm run assets:bundle`
    );
    process.exitCode = 1;
    return;
  }

  console.log(`\n[assets:verify] Verifying ${APP_NAME} offline bundle…\n`);
  const lines = fs
    .readFileSync(checksumFile, "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  let ok = 0;
  let bad = 0;
  let missing = 0;
  for (const line of lines) {
    const sep = line.indexOf("  ");
    const expected = line.slice(0, sep);
    const rel = line.slice(sep + 2);
    const abs = path.join(BUNDLE_DIR, rel);
    if (!fs.existsSync(abs)) {
      console.log(`  MISSING  ${rel}`);
      missing++;
      continue;
    }
    const actual = sha256Of(abs);
    if (actual === expected) {
      ok++;
    } else {
      console.log(`  MISMATCH ${rel}`);
      bad++;
    }
  }

  // Cross-check required assets exist somewhere in the bundle (by basename).
  const bundleBasenames = new Set(lines.map((l) => path.basename(l.slice(l.indexOf("  ") + 2))));
  const missingRequired = ASSETS.filter(
    (a) => a.required && !bundleBasenames.has(path.basename(a.localPath))
  );

  console.log(
    `\n  Checksums: ${ok} ok, ${bad} mismatched, ${missing} missing (of ${lines.length}).`
  );
  if (missingRequired.length) {
    console.log(`  Required assets NOT in bundle:`);
    for (const a of missingRequired) console.log(`    - ${a.name} (${path.basename(a.localPath)})`);
  } else {
    console.log(`  All required assets present in bundle.`);
  }
  console.log("");

  if (bad > 0 || missing > 0 || missingRequired.length > 0) process.exitCode = 1;
}

main();
