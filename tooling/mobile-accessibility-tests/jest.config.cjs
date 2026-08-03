const expoPreset = require("jest-expo/jest-preset");

/** @type {import("jest").Config} */
module.exports = {
  ...expoPreset,
  rootDir: "../../apps/mobile",
  clearMocks: true,
  restoreMocks: true,
  setupFilesAfterEnv: [
    "<rootDir>/../../tooling/mobile-accessibility-tests/jest.setup.js",
  ],
  testMatch: ["<rootDir>/__tests__/accessibility/**/*-test.ts?(x)"],
  moduleDirectories: [
    "node_modules",
    "<rootDir>/../../tooling/mobile-accessibility-tests/node_modules",
  ],
  moduleNameMapper: {
    ...expoPreset.moduleNameMapper,
    "^@testing\\-library/react\\-native$":
      "<rootDir>/../../tooling/mobile-accessibility-tests/node_modules/@testing-library/react-native",
    "^react$": "<rootDir>/node_modules/react",
    "^react/(.*)$": "<rootDir>/node_modules/react/$1",
    "^react-native($|/.*)": "<rootDir>/node_modules/react-native/$1",
    "^react-native-reanimated($|/.*)":
      "<rootDir>/node_modules/react-native-reanimated/$1",
    "^react-native-safe-area-context($|/.*)":
      "<rootDir>/node_modules/react-native-safe-area-context/$1",
    "^lucide-react-native$": "<rootDir>/node_modules/lucide-react-native",
  },
  transformIgnorePatterns: [
    "node_modules/(?!(.pnpm|(jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg))",
  ],
};
