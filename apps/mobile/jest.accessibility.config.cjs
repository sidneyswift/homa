/** @type {import("jest").Config} */
module.exports = {
  preset: "jest-expo",
  rootDir: ".",
  clearMocks: true,
  restoreMocks: true,
  setupFilesAfterEnv: ["<rootDir>/jest.accessibility.setup.js"],
  testMatch: ["<rootDir>/__tests__/accessibility/**/*-test.ts?(x)"],
  transformIgnorePatterns: [
    "node_modules/(?!(.pnpm|(jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg))",
  ],
};
