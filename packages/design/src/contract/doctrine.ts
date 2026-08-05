import { BRAND_CONTRACT } from "./brand.ts";
import { CHANNELS_CONTRACT, brandChannels, channelProfiles } from "./channels.ts";
import { COLOR_CONTRACT } from "./colors.ts";
import { CONTENT_CONTRACT } from "./content.ts";
import { ICON_CONTRACT } from "./icons.ts";
import { LAYOUT_CONTRACT } from "./layout.ts";
import { MOTION_CONTRACT } from "./motion.ts";
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

const versionedContracts = [
  BRAND_CONTRACT,
  CHANNELS_CONTRACT,
  COLOR_CONTRACT,
  CONTENT_CONTRACT,
  ICON_CONTRACT,
  LAYOUT_CONTRACT,
  MOTION_CONTRACT,
  PROFILES_CONTRACT,
  STATES_CONTRACT,
  TYPOGRAPHY_CONTRACT,
] as const;

/**
 * Fail closed before generation. A projection must never be emitted from a
 * partially updated contract or a channel profile that points nowhere.
 */
export function assertDesignContract(): void {
  for (const contract of versionedContracts) {
    if (contract.version !== DESIGN_CONTRACT_VERSION) {
      throw new Error(`Design contract version drift: expected ${DESIGN_CONTRACT_VERSION}, got ${contract.version}`);
    }
  }

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
  if (LAYOUT_CONTRACT.maximumElevationLevels !== 2) throw new Error("Quiet authority permits at most two elevation levels");
  if (BRAND_CONTRACT.roofThread.maximumTurns > 2) throw new Error("Roof thread exceeds the two-turn limit");
  if (CONTENT_CONTRACT.prohibitedPunctuation.includes("em-dash") === false) throw new Error("Content contract must prohibit em dash punctuation");
}
