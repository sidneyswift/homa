import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import {
  NATIVE_PROJECTION_CONTRACT,
  nativePrimitiveRequirements,
  nativePrimitiveRoles,
} from "../packages/design/src/contract/native.ts";
import { nativePrimitiveRegistry } from "../apps/mobile/src/components/ui/semantic-registry.ts";
import {
  colors,
  darkQuietColors,
  darkColors,
  fontSize,
  palette,
  pressScale,
  quietColors,
  quietTypeRoles,
  radius,
  shadows,
  space,
} from "../apps/mobile/src/theme/native-projection.ts";

const root = resolve(import.meta.dirname, "..");
const projectionSource = readFileSync(resolve(root, "apps/mobile/src/theme/native-projection.ts"), "utf8");
const compatibilitySource = readFileSync(resolve(root, "apps/mobile/src/theme/tokens.ts"), "utf8");
const primitivesSource = readFileSync(resolve(root, "apps/mobile/src/components/ui/semantic.tsx"), "utf8");
const buttonSource = readFileSync(resolve(root, "apps/mobile/src/components/ui/button.tsx"), "utf8");
const textFieldSource = readFileSync(resolve(root, "apps/mobile/src/components/ui/text-field.tsx"), "utf8");
const signInSource = readFileSync(resolve(root, "apps/mobile/src/app/(auth)/signin.tsx"), "utf8");
const logoSource = readFileSync(resolve(root, "apps/mobile/src/components/brand/logo.tsx"), "utf8");
const generatedNative = JSON.parse(readFileSync(resolve(root, "packages/design/generated/native.json"), "utf8")) as {
  sourceChecksum?: string;
  projection?: typeof NATIVE_PROJECTION_CONTRACT;
};

test("native projection is sourced from the design contract", () => {
  assert.match(projectionSource, /@homa\/design\/contract/u);
  assert.match(projectionSource, /NATIVE_PROJECTION_CONTRACT/u);
  assert.doesNotMatch(compatibilitySource, /#[0-9A-F]{6}/iu);
  assert.deepEqual(generatedNative.projection?.primitiveRoles, [...nativePrimitiveRoles]);
  assert.equal(generatedNative.projection?.schemaVersion, NATIVE_PROJECTION_CONTRACT.schemaVersion);
  assert.equal(quietColors.brandText, "#A33F22");
  assert.equal(darkQuietColors.brandText, "#F0835A");
  assert.equal(darkQuietColors.action, "#FFFEFC");
  assert.equal(darkQuietColors.actionText, "#27374D");
  assert.deepEqual(quietTypeRoles.control, {
    familyRole: "interface",
    weights: [600],
    size: 15,
    lineHeight: 20,
    minimumSize: 14,
  });
  assert.notEqual(quietColors.brandText, quietColors.brand);
});

test("legacy native compatibility is frozen and cannot alias the live contract", () => {
  const compatibilityMarker = "/** Frozen compatibility snapshot.";
  const compatibilityOffset = projectionSource.indexOf(compatibilityMarker);
  assert.notEqual(compatibilityOffset, -1);
  const frozenSource = projectionSource.slice(compatibilityOffset);
  assert.doesNotMatch(frozenSource, /native(?:Elevation|ThemeColors|TonalScale|TypeScale)|quiet[A-Z]/u);

  const snapshot = { palette, colors, darkColors, space, radius, fontSize, shadows, pressScale };
  const checksum = createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
  assert.equal(checksum, "33b1d66a221e049b6aa45177b30639884f999ad468066d36f52ad2c53e85acb2");
});

test("every native primitive has a typed adapter implementation", () => {
  assert.deepEqual(Object.keys(nativePrimitiveRegistry).sort(), [...nativePrimitiveRoles].sort());
  assert.deepEqual(Object.keys(nativePrimitiveRequirements).sort(), [...nativePrimitiveRoles].sort());
  for (const role of nativePrimitiveRoles) {
    const implementation = nativePrimitiveRegistry[role];
    const requirement = nativePrimitiveRequirements[role];
    assert.match(implementation.source, /^apps\/mobile\/src\/components\/ui\/semantic\.tsx$/u);
    assert.ok(implementation.legacyComponents.length > 0, `${role} must name its migration source`);
    assert.ok(requirement.requiredStates.length > 0, `${role} must name required states`);
    assert.ok(requirement.accessibility.length > 0, `${role} must name accessibility obligations`);
    assert.match(primitivesSource, new RegExp(`export function ${implementation.component}\\b`, "u"));
  }
});

test("the legacy Button API delegates to NativeAction without its own visual system", () => {
  assert.match(buttonSource, /import\s*\{[\s\S]*NativeAction[\s\S]*\}\s*from "\.\/semantic"/u);
  assert.match(buttonSource, /<NativeAction\b/u);
  assert.doesNotMatch(buttonSource, /Pressable|theme\/tokens|fontFamilies|useReducedMotion/u);
});

test("icon actions reflow at accessibility text sizes without capping Dynamic Type", () => {
  assert.match(primitivesSource, /useWindowDimensions\(\)/u);
  assert.match(primitivesSource, /Boolean\(icon\)\s*&&\s*fontScale\s*>=\s*2/u);
  assert.match(primitivesSource, /stacksIconAboveLabel\s*\?\s*"column"\s*:\s*"row"/u);
  assert.doesNotMatch(primitivesSource, /maxFontSizeMultiplier|allowFontScaling|adjustsFontSizeToFit/u);
});

test("semantic text uses natural custom-font metrics at accessibility sizes", () => {
  assert.match(primitivesSource, /fontScale\s*>=\s*2\s*\?\s*\{\s*lineHeight:\s*undefined\s*\}\s*:\s*null/u);
  assert.doesNotMatch(primitivesSource, /fontSize:\s*[^,\n]*\*\s*fontScale/u);
});

test("the legacy TextField API delegates to NativeField without its own visual system", () => {
  assert.match(textFieldSource, /import\s*\{\s*NativeField\s*\}\s*from "\.\/semantic"/u);
  assert.match(textFieldSource, /<NativeField\b/u);
  assert.doesNotMatch(textFieldSource, /<TextInput\b|theme\/tokens|fontFamilies|useState/u);
});

test("the sign-in journey keeps oversized Dynamic Type content inside its scroll origin", () => {
  assert.match(signInSource, /useWindowDimensions\(\)/u);
  assert.match(signInSource, /justifyContent:\s*fontScale\s*>=\s*2\s*\?\s*"flex-start"\s*:\s*"center"/u);
  assert.doesNotMatch(signInSource, /maxFontSizeMultiplier|allowFontScaling|adjustsFontSizeToFit/u);
});

test("the image-based wordmark stays geometric under Dynamic Type", () => {
  assert.match(logoSource, /accessibilityRole="image"/u);
  assert.match(logoSource, /homa-lockup\.png/u);
  assert.match(logoSource, /homa-lockup-dark\.png/u);
  assert.doesNotMatch(logoSource, /allowFontScaling|maxFontSizeMultiplier|adjustsFontSizeToFit/u);
});

test("native contract names platform proof without claiming it", () => {
  assert.equal(NATIVE_PROJECTION_CONTRACT.verification.physicalDevice, "required");
  assert.equal(NATIVE_PROJECTION_CONTRACT.platform.reducedTransparency.proof, "manual-device-required");
  assert.equal(NATIVE_PROJECTION_CONTRACT.platform.dynamicType.maxFontSizeMultiplier, null);
  assert.equal(NATIVE_PROJECTION_CONTRACT.platform.target.minimumHitTargetPt, 44);
});
