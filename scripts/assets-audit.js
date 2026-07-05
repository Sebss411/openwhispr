#!/usr/bin/env node
// Private Flow — assets:audit
// Lists every required/optional asset and its local status (present, size,
// sha256). With --write, (re)generates private-flow-assets.manifest.json.
//
// Usage:
//   node scripts/assets-audit.js            # print table
//   node scripts/assets-audit.js --json     # print resolved manifest as JSON
//   node scripts/assets-audit.js --write    # write private-flow-assets.manifest.json

const fs = require("fs");
const path = require("path");
const {
  APP_NAME,
  REPO_ROOT,
  ASSETS,
  PRIVATE_RELEASE_PLACEHOLDER,
  fileExists,
  fileSize,
  sha256OfToken,
} = require("./lib/asset-manifest");

const MANIFEST_PATH = path.join(REPO_ROOT, "private-flow-assets.manifest.json");

function upstreamDisplay(asset) {
  if (asset.upstreamUrl) return asset.upstreamUrl;
  return `${asset.upstreamRepo}@${asset.upstreamTag} :: ${asset.releaseFileName}`;
}

function humanSize(bytes) {
  if (bytes == null) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function buildManifest({ withHashes = true } = {}) {
  const assets = ASSETS.map((a) => {
    const present = fileExists(a.localPath);
    return {
      name: a.name,
      category: a.category,
      platform: a.platform,
      arch: a.arch,
      required: a.required,
      openwhisprOwned: !!a.owned,
      localPath: a.localPath,
      bundleRelPath: a.bundleRelPath,
      releaseFileName: a.releaseFileName,
      upstreamUrl: upstreamDisplay(a),
      privateFlowReleaseUrl: `${PRIVATE_RELEASE_PLACEHOLDER}/${a.releaseFileName}`,
      present,
      sizeBytes: present ? fileSize(a.localPath) : null,
      sha256: present && withHashes ? sha256OfToken(a.localPath) : null,
      notes: a.notes,
    };
  });
  return {
    version: 1,
    appName: APP_NAME,
    generatedAt: new Date().toISOString(),
    assetBaseUrlPlaceholder: PRIVATE_RELEASE_PLACEHOLDER,
    assets,
  };
}

function printTable(manifest) {
  console.log(`\n${APP_NAME} — asset audit  (${manifest.assets.length} assets)\n`);
  const rows = manifest.assets.map((a) => ({
    status: a.present ? "OK " : a.required ? "MISS" : "opt ",
    req: a.required ? "req" : "opt",
    own: a.openwhisprOwned ? "OW" : "  ",
    name: a.name,
    size: humanSize(a.sizeBytes),
  }));
  const nameW = Math.max(...rows.map((r) => r.name.length), 4);
  for (const r of rows) {
    console.log(
      `  [${r.status}] ${r.req}  ${r.own}  ${r.name.padEnd(nameW)}  ${r.size}`
    );
  }
  const missingRequired = manifest.assets.filter((a) => a.required && !a.present);
  const missingOptional = manifest.assets.filter((a) => !a.required && !a.present);
  console.log("");
  console.log(`  Legend: OW = OpenWhispr-owned upstream (gated by default)`);
  console.log(
    `  Present: ${manifest.assets.filter((a) => a.present).length}/${manifest.assets.length}` +
      `  | missing required: ${missingRequired.length}  | missing optional: ${missingOptional.length}`
  );
  if (missingRequired.length) {
    console.log(`\n  Missing REQUIRED assets:`);
    for (const a of missingRequired) console.log(`    - ${a.name}  (${a.notes})`);
  }
  console.log("");
}

function main() {
  const withHashes = !process.argv.includes("--no-hash");
  const manifest = buildManifest({ withHashes });

  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(manifest, null, 2));
    return;
  }

  if (process.argv.includes("--write")) {
    fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + "\n");
    console.log(`[assets:audit] Wrote ${path.relative(REPO_ROOT, MANIFEST_PATH)}`);
  }

  printTable(manifest);
}

main();
