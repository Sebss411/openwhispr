#!/usr/bin/env node
// Private Flow — assets:print-upload-list
// Prints the list of files you must upload MANUALLY to your own GitHub Release
// (tag: private-flow-assets-v1) so PRIVATE_FLOW_ASSET_BASE_URL can serve them.
// It does NOT upload anything.
//
// The redirect resolver (scripts/lib/asset-source.js) fetches each asset by its
// upstream filename, so upload every file under the exact releaseFileName shown.
//
// Usage: node scripts/assets-print-upload-list.js

const { APP_NAME, ASSETS, PRIVATE_RELEASE_PLACEHOLDER } = require("./lib/asset-manifest");

function main() {
  console.log(`\n${APP_NAME} — GitHub Release upload list (tag: private-flow-assets-v1)\n`);
  console.log(
    `Upload each file below to your fork's release, keeping the exact "release filename".\n` +
      `Then set:  PRIVATE_FLOW_ASSET_BASE_URL=${PRIVATE_RELEASE_PLACEHOLDER}\n`
  );

  const groups = { required: [], optional: [] };
  for (const a of ASSETS) (a.required ? groups.required : groups.optional).push(a);

  for (const [label, list] of [
    ["REQUIRED", groups.required],
    ["OPTIONAL (graceful fallback if absent)", groups.optional],
  ]) {
    console.log(`\n=== ${label} ===`);
    for (const a of list) {
      const owned = a.owned ? "  [OpenWhispr-owned — mirror this!]" : "";
      const src = a.upstreamUrl || `${a.upstreamRepo}@${a.upstreamTag}`;
      console.log(`\n  • release filename: ${a.releaseFileName}${owned}`);
      console.log(`    obtain from:      ${src}`);
      console.log(`    used as:          ${a.localPath}`);
    }
  }

  console.log(
    `\nNotes:`
  );
  console.log(
    `  - "OpenWhispr-owned" assets are the ones to mirror first — upstream fallback for them is`
  );
  console.log(`    OFF by default. Neutral upstreams still work without a private release.`);
  console.log(
    `  - Binaries extracted from archives (whisper-server, llama-server, qdrant, sherpa) are shipped`
  );
  console.log(
    `    ready-to-run in the offline bundle instead; the release mirror hosts the original archives.`
  );
  console.log(
    `  - The offline bundle (npm run assets:bundle) is the simplest zero-internet path — no upload needed.\n`
  );
}

main();
