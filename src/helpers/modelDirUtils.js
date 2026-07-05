const { app } = require("electron");
const fs = require("fs");
const os = require("os");
const path = require("path");

function getCacheRoot() {
  const homeDir = app?.getPath?.("home") || os.homedir();
  return path.join(homeDir, ".cache", "openwhispr");
}

function getModelsDirForService(service) {
  return path.join(getCacheRoot(), `${service}-models`);
}

// Private Flow forever-build cache resolver (opt-in, non-breaking).
//
// Preference order:
//   1. PRIVATE_FLOW_CACHE_DIR env var (explicit override)
//   2. ~/.cache/private-flow  — the new Private Flow default, IF it already
//      exists (created by `npm run assets:migrate-cache --apply`)
//   3. ~/.cache/openwhispr    — legacy fallback, so existing installs (with
//      models already downloaded there) keep working with zero migration.
//
// NOTE: the app's active default is still getCacheRoot() (openwhispr) to avoid
// orphaning already-downloaded models. This resolver is provided for a future
// switch and for tooling; wiring it into every runtime call site is a separate,
// deliberate step documented in docs/forever-build.md.
function resolvePrivateFlowCachePath() {
  const homeDir = app?.getPath?.("home") || os.homedir();
  const override = (process.env.PRIVATE_FLOW_CACHE_DIR || "").trim();
  if (override) return override;
  const privateFlow = path.join(homeDir, ".cache", "private-flow");
  const legacy = path.join(homeDir, ".cache", "openwhispr");
  try {
    if (fs.existsSync(privateFlow)) return privateFlow;
  } catch {
    /* ignore */
  }
  try {
    if (fs.existsSync(legacy)) return legacy;
  } catch {
    /* ignore */
  }
  // Neither exists yet — prefer the new Private Flow location for fresh installs.
  return privateFlow;
}

module.exports = { getCacheRoot, getModelsDirForService, resolvePrivateFlowCachePath };
