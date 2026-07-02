// Metro config for in-repo consumption of the shared core. The app imports
// "@openwhispr/core", which resolves to packages/core (a re-export of
// src/services/localtext). watchFolders lets Metro see files outside
// apps/mobile without converting the repo to npm workspaces.
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const repoRoot = path.resolve(projectRoot, "..", "..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [path.join(repoRoot, "packages"), path.join(repoRoot, "src", "services")];
config.resolver.extraNodeModules = {
  "@openwhispr/core": path.join(repoRoot, "packages", "core"),
};

module.exports = config;
