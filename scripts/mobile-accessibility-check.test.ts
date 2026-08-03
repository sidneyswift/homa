import assert from "node:assert/strict";
import { test } from "node:test";

import { nativeAccessibilityJourneys } from "../apps/mobile/src/lib/accessibility/acceptance-manifest";
import {
  findAccessibilityTestBoundaryViolations,
  findHandoffRegistryViolations,
  findJourneyManifestViolations,
  findSurfaceRegistryViolations,
  scanAccessibilitySource,
} from "./mobile-accessibility-check.mts";

function violationCodes(source: string, file = "apps/mobile/src/example.tsx"): string[] {
  return scanAccessibilitySource(file, source).violations.map((violation) => violation.code);
}

test("catches an aliased raw React Native modal", () => {
  const source = `
    import { Modal as NativeSheet } from "react-native";
    export function Example() { return <NativeSheet visible />; }
  `;
  assert.deepEqual(violationCodes(source), ["raw-modal"]);
});

test("catches a namespace spinner while allowing the shared loading primitive", () => {
  const source = `
    import * as RN from "react-native";
    export function Example() { return <RN.ActivityIndicator />; }
  `;
  assert.deepEqual(violationCodes(source), ["raw-spinner"]);
  assert.deepEqual(
    violationCodes(source, "apps/mobile/src/components/ui/loading-status.tsx"),
    [],
  );
});

test("catches direct and inline-spread text scaling constraints", () => {
  const source = `
    import { Text } from "react-native";
    export function Example() {
      return <Text maxFontSizeMultiplier={2} {...{ allowFontScaling: false }}>Full text</Text>;
    }
  `;
  assert.deepEqual(violationCodes(source), ["text-scale-cap", "text-scale-cap"]);
});

test("catches direct announcements and live-region bypasses", () => {
  const source = `
    import { AccessibilityInfo, Text } from "react-native";
    AccessibilityInfo.announceForAccessibility("Saved");
    export function Example() { return <Text accessibilityLiveRegion="polite">Saved</Text>; }
  `;
  assert.deepEqual(violationCodes(source), [
    "direct-announcement",
    "bypassed-accessibility-adapter",
  ]);
});

test("catches under-contrast semantic tokens in normal text styles", () => {
  const source = `
    import { Text } from "react-native";
    import { colors } from "./tokens";
    export function Example({ active }) {
      return <Text style={{ color: active ? colors.brand : colors.textSubtle }}>Read me</Text>;
    }
  `;
  assert.deepEqual(violationCodes(source), ["unsafe-normal-text-contrast"]);
});

test("catches an under-contrast bespoke input placeholder", () => {
  const source = `
    import { TextInput } from "react-native";
    import { colors } from "./tokens";
    export function Example() {
      return <TextInput placeholder="Your answer" placeholderTextColor={colors.textSubtle} />;
    }
  `;
  assert.deepEqual(violationCodes(source), ["unsafe-placeholder-contrast"]);
});

test("catches clamped essential Text while allowing editable input sizing", () => {
  const source = `
    import { Text, TextInput } from "react-native";
    export function Example() {
      return <><Text numberOfLines={1}>Outcome</Text><TextInput multiline numberOfLines={3} /></>;
    }
  `;
  assert.deepEqual(violationCodes(source), ["truncated-essential-text"]);
});

test("ignores lookalike text in comments and strings", () => {
  const source = `
    // <Modal maxFontSizeMultiplier={2} accessibilityLiveRegion="polite" />
    export const note = "AccessibilityInfo.announceForAccessibility";
  `;
  assert.deepEqual(violationCodes(source, "apps/mobile/src/example.ts"), []);
});

test("normalizes an aliased native handoff", () => {
  const source = `
    import { Linking as NativeLinking } from "react-native";
    void NativeLinking.openURL("https://thankshoma.com");
  `;
  const scan = scanAccessibilitySource("apps/mobile/src/lib/web-links.ts", source);
  assert.deepEqual(scan.handoffs.map((handoff) => handoff.callee), ["Linking.openURL"]);
});

test("route registry reports both new and stale surfaces", () => {
  assert.deepEqual(
    findSurfaceRegistryViolations(
      ["apps/mobile/src/app/new.tsx"],
      [{
        file: "apps/mobile/src/app/old.tsx",
        kind: "supporting",
        owner: "gh#299",
        reason: "Fixture",
      }],
    ),
    [
      "stale Expo surface entry: apps/mobile/src/app/old.tsx",
      "unregistered Expo surface: apps/mobile/src/app/new.tsx",
    ],
  );
});

test("handoff registry reports both unregistered and stale effects", () => {
  assert.deepEqual(
    findHandoffRegistryViolations(
      [{ file: "new.ts", callee: "Linking.openURL", line: 1 }],
      [{ file: "old.ts", callee: "Linking.openURL", outcome: "Fixture", owner: "gh#299" }],
    ),
    [
      "stale native handoff entry: old.ts|Linking.openURL",
      "unregistered native handoff: new.ts|Linking.openURL",
    ],
  );
});

test("the five priority journeys name every state and evidence dimension", () => {
  assert.deepEqual(findJourneyManifestViolations(nativeAccessibilityJourneys), []);
});

test("accepts a complete rendered runner outside the production package graph", () => {
  assert.deepEqual(
    findAccessibilityTestBoundaryViolations(
      {
        packageManager: "pnpm@10.12.1",
        scripts: {
          "check:mobile-accessibility":
            "corepack pnpm --dir tooling/mobile-accessibility-tests install --frozen-lockfile",
        },
      },
      { scripts: { typecheck: "tsc --noEmit" } },
      {
        packageManager: "pnpm@10.12.1",
        scripts: { test: "jest", typecheck: "tsc" },
        devDependencies: {
          "@testing-library/react-native": "14.0.1",
          "@types/jest": "29.5.14",
          "@types/react": "19.2.2",
          expo: "56.0.15",
          jest: "29.7.0",
          "jest-expo": "56.0.5",
          react: "19.2.3",
          "react-native": "0.85.3",
          "test-renderer": "1.2.0",
          typescript: "6.0.3",
        },
      },
    ),
    [],
  );
});

test("rejects test peers and scripts inside the production package graph", () => {
  assert.deepEqual(
    findAccessibilityTestBoundaryViolations(
      {
        packageManager: "pnpm@10.12.1",
        scripts: { "check:mobile-accessibility": "tsx check.ts" },
        devDependencies: { "jest-expo": "56.0.5" },
      },
      {
        scripts: { "test:accessibility": "jest" },
        devDependencies: { "@testing-library/react-native": "14.0.1" },
      },
      {
        packageManager: "pnpm@9.0.0",
        scripts: { test: "jest" },
        devDependencies: {},
      },
    ),
    [
      "apps/mobile cannot own accessibility test dependency: @testing-library/react-native",
      "apps/mobile cannot own accessibility test script: test:accessibility",
      "isolated accessibility runner is missing dependency: @testing-library/react-native",
      "isolated accessibility runner is missing dependency: @types/jest",
      "isolated accessibility runner is missing dependency: @types/react",
      "isolated accessibility runner is missing dependency: expo",
      "isolated accessibility runner is missing dependency: jest",
      "isolated accessibility runner is missing dependency: jest-expo",
      "isolated accessibility runner is missing dependency: react",
      "isolated accessibility runner is missing dependency: react-native",
      "isolated accessibility runner is missing dependency: test-renderer",
      "isolated accessibility runner is missing dependency: typescript",
      "isolated accessibility runner is missing script: typecheck",
      "isolated accessibility runner must use the root pnpm version",
      "root cannot own React Native test dependency: jest-expo",
      "root check:mobile-accessibility must frozen-install the isolated runner",
    ],
  );
});
