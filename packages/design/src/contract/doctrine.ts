import { BRAND_CONTRACT } from "./brand.ts";
import { CHANNELS_CONTRACT, brandChannels, channelProfiles } from "./channels.ts";
import { COLOR_CONTRACT } from "./colors.ts";
import { CONTENT_CONTRACT } from "./content.ts";
import { FONT_SYSTEM_CONTRACT } from "./fonts.ts";
import { ICON_CONTRACT } from "./icons.ts";
import { IDENTITY_CONTRACT } from "./identity.ts";
import { LAYOUT_CONTRACT } from "./layout.ts";
import { MOTION_CONTRACT } from "./motion.ts";
import { NATIVE_PROJECTION_CONTRACT } from "./native.ts";
import { PROFILES_CONTRACT } from "./profiles.ts";
import { STATES_CONTRACT } from "./states.ts";
import { TYPOGRAPHY_CONTRACT } from "./typography.ts";
import { DESIGN_CONTRACT_VERSION } from "./version.ts";

export const doctrineName = "quiet-authority" as const;
export const doctrinePrinciples = [
  "real-work-leads",
  "homa-keeps-the-thread",
  "one-useful-next-move",
  "parent-decides",
  "semantic-color-is-truthful",
  "motion-ends-in-state",
  "channel-reductions-preserve-meaning",
] as const;

/** The exact contract domains that every projection must consume. */
export const contractDomains = [
  "versioning",
  "colors",
  "typography",
  "layout",
  "motion",
  "states",
  "icons",
  "brand-geometry",
  "content",
  "surface-profiles",
  "channels",
  "appearance",
] as const;

export const DOCTRINE_CONTRACT = {
  version: DESIGN_CONTRACT_VERSION,
  name: doctrineName,
  displayName: "Homa, quiet authority",
  description: "A calm, capable, artifact-first design system for homeschooling families. Real work leads, Homa keeps the thread, and every meaningful moment ends with one useful next move.",
  principles: doctrinePrinciples,
  domains: contractDomains,
  sourceOfTruth: {
    human: "docs/homa-design/doctrine.md",
    typed: "packages/design/src/contract",
    generated: "packages/design/generated",
    tooling: "DESIGN.md",
  },
} as const;

export const versionedContracts = [
  BRAND_CONTRACT,
  CHANNELS_CONTRACT,
  COLOR_CONTRACT,
  CONTENT_CONTRACT,
  DOCTRINE_CONTRACT,
  FONT_SYSTEM_CONTRACT,
  ICON_CONTRACT,
  IDENTITY_CONTRACT,
  LAYOUT_CONTRACT,
  MOTION_CONTRACT,
  NATIVE_PROJECTION_CONTRACT,
  PROFILES_CONTRACT,
  STATES_CONTRACT,
  TYPOGRAPHY_CONTRACT,
] as const;

export function assertMatchingContractVersions(contracts: readonly { version: string }[]): void {
  for (const contract of contracts) {
    if (contract.version !== DESIGN_CONTRACT_VERSION) {
      throw new Error(`Design contract version drift: expected ${DESIGN_CONTRACT_VERSION}, got ${contract.version}`);
    }
  }
}

/**
 * Fail closed before generation. A projection must never be emitted from a
 * partially updated contract or a channel profile that points nowhere.
 */
export function assertDesignContract(): void {
  assertMatchingContractVersions(versionedContracts);

  for (const channel of brandChannels) {
    const profile = channelProfiles[channel];
    const targetProfiles = [...profile.targetProfiles];
    if (targetProfiles.length === 0) throw new Error(`Channel ${channel} has no target profile`);
    for (const targetProfile of targetProfiles) {
      const target = PROFILES_CONTRACT.targetProfiles[targetProfile];
      if (!target) throw new Error(`Channel ${channel} references unknown target profile ${targetProfile}`);
      if (target.channel !== channel) throw new Error(`Channel ${channel} references ${targetProfile} with channel ${target.channel}`);
    }
    for (const mode of profile.allowedAppearance) {
      if (!CHANNELS_CONTRACT.appearanceModes.includes(mode)) throw new Error(`Channel ${channel} references unknown appearance mode ${mode}`);
      if (!CHANNELS_CONTRACT.appearancePolicies[mode].requiresEvidence) throw new Error(`Appearance mode ${mode} is missing its evidence requirement`);
    }
  }

  for (const role of Object.values(TYPOGRAPHY_CONTRACT.typeRoles)) {
    if (!(role.familyRole in TYPOGRAPHY_CONTRACT.fontRoles)) throw new Error(`Typography role references an unknown font role: ${role.familyRole}`);
    const allowedWeights = TYPOGRAPHY_CONTRACT.fontRoles[role.familyRole].allowedWeights as readonly number[];
    for (const weight of role.weights) if (!allowedWeights.includes(weight)) throw new Error(`Typography role ${role.familyRole} uses unsupported weight ${weight}`);
  }

  for (const pair of COLOR_CONTRACT.approvedPairs) {
    if (!(pair.foreground in COLOR_CONTRACT.tokens) || !(pair.background in COLOR_CONTRACT.tokens)) {
      throw new Error(`Color pair references an unknown token: ${pair.foreground} on ${pair.background}`);
    }
  }

  const semanticIconCount = Object.keys(ICON_CONTRACT.semanticIconAliases).length;
  if (semanticIconCount === 0 || semanticIconCount !== Object.keys(ICON_CONTRACT.semanticIcons).length) {
    throw new Error("Semantic icon registry is incomplete");
  }
  if (MOTION_CONTRACT.reducedMotionEndpoint !== "final-still-immediately") throw new Error("Reduced Motion must end at the final still immediately");
  if (MOTION_CONTRACT.interruption.expiry !== "required-for-every-live-motion") throw new Error("Every live motion needs an expiry contract");
  if (LAYOUT_CONTRACT.maximumElevationLevels !== 2) throw new Error("Quiet authority permits at most two elevation levels");
  if (LAYOUT_CONTRACT.density.interactiveRowMinimumHeight.titleAndMetadata !== 52 || LAYOUT_CONTRACT.density.interactiveRowMinimumHeight.otherwise !== 44) throw new Error("Interactive row floors drifted");
  if (LAYOUT_CONTRACT.mediaGeometry.objectFit !== "contain" || !LAYOUT_CONTRACT.mediaGeometry.reserveFinalDimensionsBeforeLoad) throw new Error("Artifact previews must reserve dimensions and contain media");
  if (
    TYPOGRAPHY_CONTRACT.displayLineBehavior.balance !== "intentional"
    || TYPOGRAPHY_CONTRACT.displayLineBehavior.preferredMaximumLines !== 2
    || TYPOGRAPHY_CONTRACT.displayLineBehavior.exception !== "localization-or-accessibility-expansion"
  ) throw new Error("Display lines must balance around a two-line preference without breaking accessibility or localization");
  const colorTotal = COLOR_CONTRACT.composition.canvasAndPaperTargetPercent
    + COLOR_CONTRACT.composition.midnightAndInkTargetPercent
    + COLOR_CONTRACT.composition.visualCoralTargetPercent
    + COLOR_CONTRACT.composition.semanticColorMaximumPercent;
  if (colorTotal !== 100) throw new Error(`Color composition must total 100, got ${colorTotal}`);
  const selectedState = STATES_CONTRACT.selectedStateContract;
  if (
    selectedState.colorAlone
    || selectedState.minimumConcurrentCarriers !== selectedState.carriers.length
    || selectedState.requiredVisualCarriers.some((carrier) => !selectedState.carriers.includes(carrier))
    || !selectedState.carriers.includes(selectedState.requiredAccessibleCarrier)
  ) throw new Error("Selected state needs every coordinated visual and accessible carrier");
  if (BRAND_CONTRACT.roofThread.maximumTurns > 2) throw new Error("Roof thread exceeds the two-turn limit");
  if (BRAND_CONTRACT.signatureComposition.realObjectVisualWeightPercent.minimum !== 55 || BRAND_CONTRACT.signatureComposition.realObjectVisualWeightPercent.maximum !== 70) throw new Error("Real work prominence drifted");
  if (BRAND_CONTRACT.signatureComposition.homaShortEdgePercent.minimum !== 10 || BRAND_CONTRACT.signatureComposition.homaShortEdgePercent.maximum !== 16) throw new Error("Homa composition proportion drifted");
  if (CONTENT_CONTRACT.prohibitedPunctuation.includes("em-dash") === false) throw new Error("Content contract must prohibit em dash punctuation");
}
