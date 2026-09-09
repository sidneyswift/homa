const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

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
