import { DESIGN_CONTRACT_VERSION } from "./version.ts";
import type { TargetProfile } from "./profiles.ts";

/**
 * A channel is a delivery constraint, not a second visual identity. Keeping
 * the vocabulary here makes reductions explicit before a renderer is built.
 */
export const brandChannels = [
  "web",
  "native",
  "marketing",
  "email",
  "sms",
  "print",
  "provider",
  "metadata",
] as const;
export type BrandChannel = (typeof brandChannels)[number];

export const appearanceModes = [
  "light",
  "dark-adaptive",
  "forced-colors",
  "increased-contrast",
  "grayscale",
  "client-controlled",
  "provider-controlled",
] as const;
export type AppearanceMode = (typeof appearanceModes)[number];

export const channelExpressions = ["full-expressive", "static-rich", "constrained", "plain-text", "none"] as const;
export type ChannelExpression = (typeof channelExpressions)[number];

export const channelProfiles = {
  web: {
    targetProfiles: ["webProduct"] as const satisfies readonly TargetProfile[],
    expression: "full-expressive",
    allowedAppearance: ["light", "dark-adaptive", "forced-colors", "increased-contrast"] as const satisfies readonly AppearanceMode[],
    preservedElements: ["real-artifact", "logo", "meaningful-thread", "useful-next-move"] as const,
    motion: "truthful-interruptible",
  },
  native: {
    targetProfiles: ["nativeProduct"] as const satisfies readonly TargetProfile[],
    expression: "full-expressive",
    allowedAppearance: ["light", "dark-adaptive", "forced-colors", "increased-contrast"] as const satisfies readonly AppearanceMode[],
    preservedElements: ["real-artifact", "logo", "meaningful-thread", "useful-next-move"] as const,
    motion: "truthful-interruptible",
  },
  marketing: {
    targetProfiles: ["marketingRich"] as const satisfies readonly TargetProfile[],
    expression: "static-rich",
    allowedAppearance: ["light", "grayscale"] as const satisfies readonly AppearanceMode[],
    preservedElements: ["real-artifact", "logo", "meaningful-thread", "useful-next-move"] as const,
    motion: "static-or-reduced-to-still",
  },
  email: {
    targetProfiles: ["emailConstrained"] as const satisfies readonly TargetProfile[],
    expression: "constrained",
    allowedAppearance: ["light", "client-controlled"] as const satisfies readonly AppearanceMode[],
    preservedElements: ["logo", "plain-language-next-move"] as const,
    motion: "none",
  },
  sms: {
    targetProfiles: ["smsPlainText"] as const satisfies readonly TargetProfile[],
    expression: "plain-text",
    allowedAppearance: ["client-controlled"] as const satisfies readonly AppearanceMode[],
    preservedElements: ["plain-language-next-move"] as const,
    motion: "none",
  },
  print: {
    targetProfiles: ["artifactPrint"] as const satisfies readonly TargetProfile[],
    expression: "constrained",
    allowedAppearance: ["grayscale"] as const satisfies readonly AppearanceMode[],
    preservedElements: ["real-artifact", "provenance", "plain-language-next-move"] as const,
    motion: "none",
  },
  provider: {
    targetProfiles: ["providerConstrained"] as const satisfies readonly TargetProfile[],
    expression: "constrained",
    allowedAppearance: ["provider-controlled"] as const satisfies readonly AppearanceMode[],
    preservedElements: ["approved-static", "plain-language-next-move"] as const,
    motion: "provider-owned",
  },
  metadata: {
    targetProfiles: ["metadataConstrained"] as const satisfies readonly TargetProfile[],
    expression: "plain-text",
    allowedAppearance: ["client-controlled"] as const satisfies readonly AppearanceMode[],
    preservedElements: ["plain-language-next-move"] as const,
    motion: "none",
  },
} as const satisfies Record<BrandChannel, {
  targetProfiles: readonly TargetProfile[];
  expression: ChannelExpression;
  allowedAppearance: readonly AppearanceMode[];
  preservedElements: readonly string[];
  motion: string;
}>;

/** Appearance is a proof obligation. It never authorizes an untested palette. */
export const appearancePolicies = {
  light: { tokenSource: "approved-color-tokens", contrastFloor: 4.5, requiresEvidence: true },
  "dark-adaptive": { tokenSource: "projection-owned-adaptive-tokens", contrastFloor: 4.5, requiresEvidence: true },
  "forced-colors": { tokenSource: "system-colors", contrastFloor: 3, requiresEvidence: true },
  "increased-contrast": { tokenSource: "approved-color-tokens", contrastFloor: 4.5, requiresEvidence: true },
  grayscale: { tokenSource: "approved-color-tokens-and-tones", contrastFloor: 4.5, requiresEvidence: true },
  "client-controlled": { tokenSource: "client-or-platform", contrastFloor: null, requiresEvidence: true },
  "provider-controlled": { tokenSource: "provider", contrastFloor: null, requiresEvidence: true },
} as const satisfies Record<AppearanceMode, {
  tokenSource: string;
  contrastFloor: number | null;
  requiresEvidence: boolean;
}>;

export const CHANNELS_CONTRACT = {
  version: DESIGN_CONTRACT_VERSION,
  brandChannels,
  appearanceModes,
  channelExpressions,
  channelProfiles,
  appearancePolicies,
} as const;
