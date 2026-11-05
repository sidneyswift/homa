const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// three 0.186 ships its CommonJS entry as a Node-only shim
// (process.emitWarning, require(esm)), and Metro resolves every import
// through `require`, so App 2's 3D Homa crashed on load (gh#1236). Keep the
// normal resolution, then swap in the ES module build beside it so every
// importer shares one three instance.
const resolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolved = (resolveRequest ?? context.resolveRequest)(context, moduleName, platform);
  if (moduleName === "three" && resolved.type === "sourceFile" && path.basename(resolved.filePath) === "three.cjs") {
    return { ...resolved, filePath: path.join(path.dirname(resolved.filePath), "three.module.js") };
  }
  return resolved;
};

// Expo Router discovers every file under src/app. Keep local prototypes out
// of release route discovery; the exported-source guard verifies the result.
if (process.env.NODE_ENV === "production") {
  const existing = config.resolver.blockList;
  config.resolver.blockList = [
    ...(Array.isArray(existing) ? existing : existing ? [existing] : []),
    /[/\\]src[/\\]app[/\\]labs[/\\].*/,
  ];
}

module.exports = config;
