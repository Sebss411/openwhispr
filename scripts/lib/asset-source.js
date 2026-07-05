// Private Flow — forever-build download redirector.
//
// Every build-time download funnels through downloadFile() in download-utils.js.
// This module decides WHERE each asset actually comes from, so Private Flow does
// not silently depend on OpenWhispr-owned GitHub releases.
//
// Priority chain (per asset):
//   1. Offline bundle       artifacts/private-flow-offline-bundle/**  (fully local)
//   2. Private release       ${PRIVATE_FLOW_ASSET_BASE_URL}/<assetName>
//   3. Neutral upstream      original URL, only if NOT OpenWhispr-owned
//   4. OpenWhispr upstream   original URL, ONLY if ALLOW_UPSTREAM_ASSET_FALLBACK=true
//
// If none apply (an OpenWhispr-owned asset with no private source and fallback
// disabled) it throws a clear, actionable error instead of reaching out to
// OpenWhispr behind your back.

const fs = require("fs");
const path = require("path");

const REPO_ROOT = path.join(__dirname, "..", "..");
const BUNDLE_DIR = path.join(REPO_ROOT, "artifacts", "private-flow-offline-bundle");

function getPrivateBaseUrl() {
  const env = (process.env.PRIVATE_FLOW_ASSET_BASE_URL || "").trim();
  if (env) return env.replace(/\/+$/, "");
  try {
    const pkg = require(path.join(REPO_ROOT, "package.json"));
    const cfg = pkg.privateFlow && pkg.privateFlow.assetBaseUrl;
    if (cfg && String(cfg).trim()) return String(cfg).trim().replace(/\/+$/, "");
  } catch {
    // no package.json config — fine
  }
  return "";
}

function upstreamFallbackAllowed() {
  return String(process.env.ALLOW_UPSTREAM_ASSET_FALLBACK || "").toLowerCase() === "true";
}

// Any github.com/OpenWhispr/* release (covers OpenWhispr/openwhispr AND
// OpenWhispr/whisper.cpp). Case-insensitive.
function isOpenWhisprOwnedUrl(url) {
  return /github\.com\/openwhispr\//i.test(String(url || ""));
}

function assetNameFromUrl(url) {
  try {
    const u = new URL(url);
    return decodeURIComponent(path.posix.basename(u.pathname));
  } catch {
    return path.basename(String(url).split("?")[0]);
  }
}

// Recursively look for a file named `assetName` inside the offline bundle.
function findInBundle(assetName) {
  if (!assetName || !fs.existsSync(BUNDLE_DIR)) return null;
  const stack = [BUNDLE_DIR];
  while (stack.length) {
    const dir = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.name === assetName) return full;
    }
  }
  return null;
}

/**
 * Decide how to satisfy a download of `originalUrl`.
 * @returns {{localPath: string} | {urls: Array<{url: string, source: string}>}}
 * @throws {Error} code PRIVATE_FLOW_ASSET_MISSING when blocked.
 */
function resolveDownloadPlan(originalUrl) {
  const assetName = assetNameFromUrl(originalUrl);
  const owned = isOpenWhisprOwnedUrl(originalUrl);

  // 1. Offline bundle wins — no network at all.
  const local = findInBundle(assetName);
  if (local) return { localPath: local, assetName };

  const urls = [];

  // 2. Private release mirror.
  const base = getPrivateBaseUrl();
  if (base) urls.push({ url: `${base}/${assetName}`, source: "private-release" });

  // 3./4. Upstream.
  if (!owned) {
    urls.push({ url: originalUrl, source: "upstream" });
  } else if (upstreamFallbackAllowed()) {
    urls.push({ url: originalUrl, source: "upstream-openwhispr" });
  }

  if (urls.length === 0) {
    const err = new Error(
      `Missing Private Flow asset "${assetName}".\n` +
        `  It comes from an OpenWhispr-owned release and upstream fallback is disabled by default.\n` +
        `  Do ONE of the following:\n` +
        `    • npm run setup:offline                 (install from artifacts/private-flow-offline-bundle)\n` +
        `    • set PRIVATE_FLOW_ASSET_BASE_URL=https://github.com/<you>/<fork>/releases/download/<tag>\n` +
        `    • set ALLOW_UPSTREAM_ASSET_FALLBACK=true (temporarily reuse the upstream OpenWhispr release)`
    );
    err.code = "PRIVATE_FLOW_ASSET_MISSING";
    throw err;
  }

  return { urls, assetName, owned };
}

module.exports = {
  BUNDLE_DIR,
  getPrivateBaseUrl,
  upstreamFallbackAllowed,
  isOpenWhisprOwnedUrl,
  assetNameFromUrl,
  findInBundle,
  resolveDownloadPlan,
};
