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
  darkColors,
  fontSize,
  palette,
  pressScale,
  radius,
  shadows,
  space,
} from "../apps/mobile/src/theme/native-projection.ts";

const root = resolve(import.meta.dirname, "..");
const projectionSource = readFileSync(resolve(root, "apps/mobile/src/theme/native-projection.ts"), "utf8");
const compatibilitySource = readFileSync(resolve(root, "apps/mobile/src/theme/tokens.ts"), "utf8");
const primitivesSource = readFileSync(resolve(root, "apps/mobile/src/components/ui/semantic.tsx"), "utf8");
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

test("native contract names platform proof without claiming it", () => {
  assert.equal(NATIVE_PROJECTION_CONTRACT.verification.physicalDevice, "required");
  assert.equal(NATIVE_PROJECTION_CONTRACT.platform.reducedTransparency.proof, "manual-device-required");
  assert.equal(NATIVE_PROJECTION_CONTRACT.platform.dynamicType.maxFontSizeMultiplier, null);
  assert.equal(NATIVE_PROJECTION_CONTRACT.platform.target.minimumHitTargetPt, 44);
});
