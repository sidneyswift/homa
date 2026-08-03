// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  ...expoConfig,
  {
    ignores: ["dist/*", ".expo/*"],
  },
  {
    files: ["__tests__/accessibility/**/*.{ts,tsx}"],
    rules: {
      // The rendered runner is isolated so its React Native test peers cannot
      // change the production OTA fingerprint. TypeScript resolves this exact
      // import through the runner's dedicated config.
      "import/no-unresolved": [
        "error",
        { ignore: ["^@testing-library/react-native$"] },
      ],
    },
  },
]);
