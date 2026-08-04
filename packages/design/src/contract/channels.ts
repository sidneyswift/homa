import { DESIGN_CONTRACT_VERSION } from "./version.ts";
import { type ColorToken } from "./colors.ts";
import { channelTypography } from "./fonts.ts";
import { identitySafeAreas } from "./identity.ts";
import { radii, spacing } from "./layout.ts";
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

/**
 * Constrained-channel geometry and delivery rules. These are projections of
 * the master contract, not a second set of visual tokens. Renderers consume
 * token names and typography roles so a contract change invalidates every
 * dependent channel together.
 */
export const channelProjections = {
  email: {
    profile: "emailConstrained",
    expression: channelProfiles.email.expression,
    maxWidthPx: 560,
    gutterPx: { wide: spacing.scale[3], narrow: spacing.scale[4] },
    outerPaddingPx: { top: 36, right: spacing.scale[3], bottom: 40, left: spacing.scale[3] },
    card: { radiusPx: radii.card, paddingPx: { wide: "32px 30px", narrow: "26px 22px" } },
    ctaRadiusPx: radii.control,
    colors: {
      canvas: "canvas",
      paper: "paper",
      ink: "ink",
      action: "midnightAction",
      brandText: "brandText",
      visualCoral: "visualCoral",
      boundary: "controlBoundary",
    } as const satisfies Record<string, ColorToken>,
    typography: channelTypography.emailConstrained,
    logo: {
      assetPath: "apps/web/public/brand/homa-mark.svg",
      publicPath: "/brand/homa-mark.svg",
      fallbackText: "Homa",
      alt: "Homa",
      minimumWidthPx: 24,
    },
    imagePolicy: "optional-with-meaningful-alt",
    motion: "none",
    appearance: "client-controlled",
  },
  print: {
    profile: "artifactPrint",
    expression: channelProfiles.print.expression,
    pageSizes: {
      letter: { widthIn: 8.5, heightIn: 11, cssSize: "letter" },
      a4: { widthIn: 8.27, heightIn: 11.69, cssSize: "A4" },
    },
    interior: { topIn: 0.55, leftIn: 0.6, bottomIn: 0.95, rightIn: 0.6 },
    footer: { bottomIn: 0.32, fontSizePx: 9.5, gapPx: 5 },
    radiiPx: { control: radii.control, card: radii.card, frame: radii.frame },
    colors: {
      canvas: "canvas",
      paper: "paper",
      ink: "ink",
      floating: "floating",
      visualCoral: "visualCoral",
      brandText: "brandText",
      midnightAction: "midnightAction",
      controlBoundary: "controlBoundary",
    } as const satisfies Record<string, ColorToken>,
    typography: channelTypography.artifactPrint,
    logo: { assetPath: "apps/web/public/brand/homa-mark.svg", safeArea: identitySafeAreas.printInline },
    fontEmbedding: "embedded-or-declared-fallback",
    grayscaleProof: "required",
    motion: "none",
    appearance: "grayscale",
  },
  provider: {
    profile: "providerConstrained",
    expression: channelProfiles.provider.expression,
    typography: channelTypography.providerConstrained,
    logo: { assetPath: "apps/web/public/brand/homa-mark.svg", publicPath: "/brand/homa-mark.svg", fallbackText: "Homa" },
    allowedColorRoles: ["brandText", "midnightAction", "paper", "canvas"] as const satisfies readonly ColorToken[],
    unsupported: ["web-font-embedding", "product-motion", "unsupported-css"] as const,
    motion: "provider-owned",
    appearance: "provider-controlled",
  },
  distribution: {
    profile: "metadataConstrained",
    expression: channelProfiles.metadata.expression,
    typography: channelTypography.metadataConstrained,
    logo: { assetPath: "apps/web/public/brand/homa-mark.svg", publicPath: "/brand/homa-mark.svg", safeArea: identitySafeAreas.tight },
    preserved: ["plain-language-next-move", "tiny-static-mark"] as const,
    motion: "none",
    appearance: "client-controlled",
  },
} as const satisfies Record<string, {
  [key: string]: unknown;
  profile: TargetProfile;
  expression: ChannelExpression;
  typography: unknown;
  motion: string;
  appearance: AppearanceMode;
}>;

export const CHANNELS_CONTRACT = {
  version: DESIGN_CONTRACT_VERSION,
  brandChannels,
  appearanceModes,
  channelExpressions,
  channelProfiles,
  appearancePolicies,
  projections: channelProjections,
} as const;
