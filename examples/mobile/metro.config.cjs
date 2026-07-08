const path = require("node:path")
const { getDefaultConfig } = require("expo/metro-config")

const workspaceRoot = path.resolve(__dirname, "../..")
const config = getDefaultConfig(__dirname)

config.watchFolders = [workspaceRoot]
config.resolver.extraNodeModules = {
  "@effect-native/core": path.join(workspaceRoot, "packages/core"),
  "@effect-native/render-rn": path.join(workspaceRoot, "packages/render-rn"),
  "@effect-native/tokens": path.join(workspaceRoot, "packages/tokens"),
  effect: path.join(workspaceRoot, "node_modules/effect")
}

module.exports = config
