/* global afterEach, jest */

jest.mock("react-native-safe-area-context", () => {
  const safeAreaMock = jest.requireActual(
    "react-native-safe-area-context/jest/mock",
  );
  return safeAreaMock.default ?? safeAreaMock;
});

jest.mock("react-native-reanimated", () => {
  // A hand-rolled stub with only useReducedMotion worked fine while no
  // accessibility test imported anything using more of Reanimated than
  // that, until entry-and-share-test.tsx started rendering signin.tsx,
  // which pulls in HomaCharacter's ambient animation rig and crashed on
  // `Easing.bezier` being undefined (2026-09-03). The library's own
  // "official" mock (react-native-reanimated/mock) is NOT a safe
  // drop-in on this installed version (4.x): it transitively requires
  // the real react-native-worklets native module and throws
  // WorkletsErrorConstructor outside a real native runtime, tried and
  // reverted the same session. These tests only render trees for
  // accessibility properties, never assert on animated values, so a
  // minimal, non-reactive stub is enough: shared values are plain
  // mutable objects, style/props functions run once eagerly, and
  // with*/cancelAnimation are no-ops or pass the target straight
  // through instead of actually easing.
  const { Text, View } = jest.requireActual("react-native");
  const useSharedValue = (initial) => ({ value: initial });
  const identity = (toValue) => toValue;
  return {
    // Without this, Babel's CJS interop for `import Animated from
    // "react-native-reanimated"` treats the whole mock object as the
    // default export (Animated === this whole object, not the nested
    // `default` below), so Animated.createAnimatedComponent resolved to
    // undefined even though it was right there one level down.
    __esModule: true,
    useReducedMotion: jest.fn(() => false),
    useSharedValue,
    useDerivedValue: (fn) => ({ value: fn() }),
    useAnimatedStyle: (fn) => fn(),
    useAnimatedProps: (fn) => fn(),
    withTiming: identity,
    withSpring: identity,
    withRepeat: (animation) => animation,
    withSequence: (...animations) => animations[animations.length - 1],
    cancelAnimation: () => {},
    Easing: {
      bezier: () => identity,
      inOut: identity,
      in: identity,
      out: identity,
      sin: identity,
      quad: identity,
      linear: identity,
    },
    default: {
      View,
      Text,
      createAnimatedComponent: (Component) => Component,
    },
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
