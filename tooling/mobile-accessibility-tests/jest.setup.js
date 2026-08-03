/* global afterEach, jest */

jest.mock("react-native-safe-area-context", () => {
  const safeAreaMock = jest.requireActual(
    "react-native-safe-area-context/jest/mock",
  );
  return safeAreaMock.default ?? safeAreaMock;
});

jest.mock("react-native-reanimated", () => {
  return {
    useReducedMotion: jest.fn(() => false),
  };
});

jest.mock(
  "lucide-react-native",
  () =>
    new Proxy(
      { __esModule: true },
      {
        get(target, property) {
          if (property in target) return target[property];
          return function MockLucideIcon() {
            return null;
          };
        },
      },
    ),
);

afterEach(() => {
  const { useReducedMotion } = require("react-native-reanimated");
  useReducedMotion.mockReset();
  useReducedMotion.mockReturnValue(false);
  jest.useRealTimers();
});
