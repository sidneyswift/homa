import assert from "node:assert/strict";
import test from "node:test";
import { approvedColorPairs, colorTokens } from "./colors.ts";
import { BRAND_CONTRACT } from "./brand.ts";
import { CHANNELS_CONTRACT, brandChannels, channelProfiles, channelProjections } from "./channels.ts";
import { CONTENT_CONTRACT } from "./content.ts";
import { assertDesignContract, DOCTRINE_CONTRACT } from "./doctrine.ts";
import { MOTION_CONTRACT } from "./motion.ts";
import { STATES_CONTRACT } from "./states.ts";
import { fontRoles, typeRoles } from "./typography.ts";
import {
  NATIVE_PROJECTION_CONTRACT,
  nativeHapticRoles,
  nativePlatformContract,
  nativePrimitiveAdapters,
  nativePrimitiveRoles,
} from "./native.ts";
import {
  FONT_SYSTEM_CONTRACT,
  approvedFontFamilies,
  channelTypography,
  checkedInFontAssets,
} from "./fonts.ts";
import {
  createSemanticIconRegistry,
  getSemanticIcon,
  iconContract,
  isSemanticIconName,
  semanticIconAdapterContract,
  semanticIconAdapters,
  semanticIconAliases,
  semanticIcons,
} from "./icons.ts";

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255).map((value) => value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
}

function contrast(foreground: string, background: string): number {
  const light = Math.max(luminance(foreground), luminance(background));
  const dark = Math.min(luminance(foreground), luminance(background));
  return (light + 0.05) / (dark + 0.05);
}

test("every approved semantic pair meets its stated contrast floor", () => {
  for (const pair of approvedColorPairs) {
    const ratio = contrast(colorTokens[pair.foreground], colorTokens[pair.background]);
    assert.ok(ratio >= pair.minimumRatio, `${pair.foreground} on ${pair.background}: ${ratio.toFixed(2)}`);
  }
});

test("font roles have one meaning and the display floor is enforced", () => {
  assert.equal(fontRoles.display.family, "EB Garamond");
  assert.ok(fontRoles.display.minimumPx >= 20);
  assert.equal(fontRoles.interface.family, "DM Sans");
  assert.equal(fontRoles.wordmark.purpose, "real Logo component only");
  for (const role of Object.values(typeRoles)) assert.ok(role.familyRole in fontRoles);
});

test("font registry records licensed sources and checked-in binary identity", () => {
  assert.deepEqual(Object.keys(approvedFontFamilies).sort(), ["display", "interface", "wordmark"]);
  assert.equal(FONT_SYSTEM_CONTRACT.version, "quiet-authority-v1");
  assert.equal(FONT_SYSTEM_CONTRACT.schemaVersion, 1);
  assert.equal(checkedInFontAssets.length, 3);
  for (const family of Object.values(approvedFontFamilies)) {
    assert.equal(family.source.license.identifier, "OFL-1.1");
    assert.match(family.source.license.url, /^https:\/\//u);
    assert.match(family.source.specimenUrl, /^https:\/\//u);
    assert.ok(family.allowedWeights.length > 0);
    assert.ok(family.allowedStyles.length > 0);
    assert.ok(family.subsets.includes("latin"));
  }
  for (const asset of checkedInFontAssets) {
    assert.match(asset.sha256, /^[0-9a-f]{64}$/u);
    assert.equal(asset.family, approvedFontFamilies[asset.role].family);
    assert.ok(approvedFontFamilies[asset.role].allowedWeights.includes(asset.weight));
    assert.ok(approvedFontFamilies[asset.role].allowedStyles.includes(asset.style));
    assert.ok(asset.binaryInspection.glyphCoverage.length > 0);
  }
});

test("every channel declares each semantic role and an honest delivery mode", () => {
  const roles = ["display", "interface", "wordmark"] as const;
  for (const [channel, mapping] of Object.entries(channelTypography)) {
    for (const role of roles) {
      const stack = mapping[role];
      assert.ok(stack.preferred, `${channel}.${role} has no preferred face`);
      if (stack.delivery !== "plain-text") assert.ok(stack.fallback.length > 0, `${channel}.${role} has no fallback`);
      if (stack.delivery === "embedded") assert.ok(/EB Garamond|DM Sans|Fredoka|rasterized/u.test(stack.preferred));
    }
  }
});

test("state and motion contracts cannot imply a child verdict", () => {
  assert.ok(STATES_CONTRACT.interactionStates.includes("error"));
  assert.ok(STATES_CONTRACT.interactionStates.includes("offline"));
  assert.equal(MOTION_CONTRACT.totalMaximum, 900);
  assert.equal(MOTION_CONTRACT.reducedMotionEndpoint, "final-still-immediately");
  assert.equal(CONTENT_CONTRACT.childFraming, "no-verdict-no-behind-no-sibling-comparison");
  assert.equal(BRAND_CONTRACT.roofThread.maximumTurns, 2);
});

test("the active contract has no retired font or shape authority", () => {
  const serialized = JSON.stringify({ colorTokens, fontRoles, typeRoles, FONT_SYSTEM_CONTRACT, BRAND_CONTRACT, CONTENT_CONTRACT });
  for (const retired of ["Schibsted", "Hanken", "Caveat", "blob", "squiggle", "wavy"]) assert.equal(serialized.includes(retired), false, retired);
});

test("semantic icon vocabulary has a concrete platform alias for every name", () => {
  assert.deepEqual(Object.keys(semanticIconAliases).sort(), [...semanticIcons].sort());
  assert.equal(iconContract.source, "semantic-adapter-only");
  assert.deepEqual(iconContract.sizes, [16, 20, 24]);
  assert.equal(iconContract.strokePx, 1.75);
});

test("semantic icon adapters are complete and fail closed", () => {
  assert.deepEqual(semanticIconAdapterContract.platforms, ["web", "native"]);
  assert.equal(semanticIconAdapterContract.sourcePolicy, "registry-only");
  for (const platform of semanticIconAdapterContract.platforms) {
    assert.deepEqual(Object.keys(semanticIconAdapters[platform]).sort(), [...semanticIcons].sort());
  }
  assert.equal(isSemanticIconName("back"), true);
  assert.equal(isSemanticIconName("not-a-role"), false);
  const registry = createSemanticIconRegistry("web", Object.fromEntries(semanticIcons.map((name) => [name, name])) as Record<typeof semanticIcons[number], string>);
  assert.equal(getSemanticIcon("web", registry, "back"), "back");
  assert.throws(() => getSemanticIcon("web", registry, "not-a-role"), /Unknown web semantic icon role/);
  assert.throws(() => createSemanticIconRegistry("native", { back: "ArrowLeft" } as never), /missing=/);
});

test("the Quiet authority doctrine is exhaustive and version-aligned", () => {
  assert.doesNotThrow(() => assertDesignContract());
  assert.equal(DOCTRINE_CONTRACT.name, "quiet-authority");
  assert.deepEqual([...DOCTRINE_CONTRACT.domains].sort(), [
    "appearance",
    "brand-geometry",
    "channels",
    "colors",
    "content",
    "icons",
    "layout",
    "motion",
    "states",
    "surface-profiles",
    "typography",
    "versioning",
  ]);
  assert.deepEqual(Object.keys(CHANNELS_CONTRACT.channelProfiles).sort(), [...brandChannels].sort());
  for (const channel of brandChannels) {
    assert.ok(channelProfiles[channel].targetProfiles.length > 0);
    assert.ok(channelProfiles[channel].allowedAppearance.length > 0);
    assert.ok(channelProfiles[channel].preservedElements.length > 0);
  }
});

test("channel reductions preserve meaning without importing product motion", () => {
  assert.equal(channelProfiles.web.motion, "truthful-interruptible");
  assert.equal(channelProfiles.native.motion, "truthful-interruptible");
  assert.equal(channelProfiles.marketing.motion, "static-or-reduced-to-still");
  for (const channel of ["email", "sms", "print", "provider", "metadata"] as const) {
    assert.equal(channelProfiles[channel].motion === "none" || channelProfiles[channel].motion === "provider-owned", true);
    assert.ok(channelProfiles[channel].preservedElements.includes("plain-language-next-move") || channelProfiles[channel].preservedElements.includes("useful-next-move"));
  }
});

test("constrained projections derive safe delivery rules from the active contract", () => {
  assert.equal(channelProjections.email.profile, "emailConstrained");
  assert.equal(channelProjections.email.typography.display.preferred, "Georgia");
  assert.equal(channelProjections.email.typography.interface.preferred, "Arial");
  assert.equal(channelProjections.email.motion, "none");
  assert.equal(channelProjections.email.colors.action, "midnightAction");
  assert.equal(channelProjections.print.profile, "artifactPrint");
  assert.deepEqual(Object.keys(channelProjections.print.pageSizes).sort(), ["a4", "letter"]);
  assert.equal(channelProjections.print.fontEmbedding, "embedded-or-declared-fallback");
  assert.equal(channelProjections.provider.motion, "provider-owned");
  assert.deepEqual(channelProjections.distribution.preserved, ["plain-language-next-move", "tiny-static-mark"]);
  assert.ok(channelProfiles.email.targetProfiles.includes(channelProjections.email.profile));
  assert.ok(channelProfiles.print.targetProfiles.includes(channelProjections.print.profile));
  assert.ok(channelProfiles.provider.targetProfiles.includes(channelProjections.provider.profile));
  assert.ok(channelProfiles.metadata.targetProfiles.includes(channelProjections.distribution.profile));
});

test("native projection covers every approved primitive role and disposition", () => {
  assert.equal(NATIVE_PROJECTION_CONTRACT.version, "quiet-authority-v1");
  assert.equal(NATIVE_PROJECTION_CONTRACT.schemaVersion, 1);
  assert.deepEqual(Object.keys(nativePrimitiveAdapters).sort(), [...nativePrimitiveRoles].sort());
  for (const role of nativePrimitiveRoles) {
    const adapter = nativePrimitiveAdapters[role];
    assert.match(adapter.component, /^Native[A-Z]/u);
    assert.match(adapter.source, /^apps\/mobile\/src\/components\/ui\/semantic\.tsx$/u);
    assert.ok(adapter.legacyComponents.length > 0, `${role} must name its migration source`);
    assert.ok(adapter.requiredStates.length > 0, `${role} must name required states`);
    assert.ok(adapter.accessibility.length > 0, `${role} must name accessibility obligations`);
  }
});

test("native platform contract keeps accessibility and haptics explicit", () => {
  assert.equal(nativePlatformContract.target.minimumHitTargetPt, 44);
  assert.equal(nativePlatformContract.dynamicType.maxFontSizeMultiplier, null);
  assert.equal(nativePlatformContract.reducedMotion.endpoint, "final-still-immediately");
  assert.equal(nativePlatformContract.appearance.profiles.includes("dark"), true);
  assert.equal(Object.keys(nativeHapticRoles).sort().join(","), "error,press,select,success,warning");
  assert.equal(NATIVE_PROJECTION_CONTRACT.verification.physicalDevice, "required");
});
