import { DESIGN_CONTRACT_VERSION } from "./version.ts";

export const colorTokens = {
  canvas: "#F7F4EE",
  ink: "#20242B",
  paper: "#FFFEFC",
  floating: "#FFFFFF",
  visualCoral: "#E7602F",
  midnightAction: "#27374D",
  brandText: "#A33F22",
  controlBoundary: "#918B83",
  constructiveInk: "#335C46",
  constructiveTint: "#E5EFE8",
  infoInk: "#2F5968",
  infoTint: "#E4EFF2",
  highlightInk: "#76560F",
  highlightTint: "#F7EBC7",
  errorInk: "#923F33",
  errorTint: "#F5E5E1",
  containedBand: "#27374D",
} as const;

export type ColorToken = keyof typeof colorTokens;

export const colorUsage = {
  canvas: "default page and quiet bands",
  ink: "primary text and structure",
  paper: "reading surfaces and artifacts",
  floating: "temporary elevated surfaces only",
  visualCoral: "Homa presence, roof thread, visual signature, and rare campaign or editorial punctuation",
  midnightAction: "filled actions, selected states, structural emphasis",
  brandText: "accessible coral-family text substitute",
  controlBoundary: "quiet control and field boundaries",
  constructiveInk: "truthful constructive state",
  constructiveTint: "truthful constructive state background",
  infoInk: "truthful information state",
  infoTint: "truthful information state background",
  highlightInk: "attention or celebration without scoring",
  highlightTint: "attention or celebration background",
  errorInk: "real system failure only",
  errorTint: "real system failure background",
  containedBand: "contained mineral band with paper foreground",
} as const satisfies Record<ColorToken, string>;

export const colorComposition = {
  canvasAndPaperTargetPercent: 76,
  midnightAndInkTargetPercent: 16,
  visualCoralTargetPercent: 6,
  semanticColorMaximumPercent: 2,
  coralPunctuationScope: "rare-campaign-or-editorial-moments-only",
} as const;

/**
 * Web-only derived aliases that keep secondary ink and quiet boundaries
 * available on every route. They are generated beside the canonical tokens,
 * rather than being scoped by a single landing component.
 */
export const webCompatibilityTokens = {
  mutedInk: "color-mix(in srgb, var(--homa-ink) 64%, var(--homa-canvas))",
  softBoundary: "color-mix(in srgb, var(--homa-control-boundary) 34%, transparent)",
} as const;

/**
 * Native needs tonal steps for calendars, family differentiation, and
 * truthful status surfaces. The names describe semantic roles, never the
 * retired palette that happened to supply an earlier implementation.
 */
export const nativeTonalScale = {
  neutral50: colorTokens.canvas,
  neutral100: "#EEEAE2",
  neutral200: "#DED8CC",
  neutral300: colorTokens.controlBoundary,
  neutral400: "#77736B",
  neutral500: "#68645E",
  neutral600: "#5B5852",
  neutral700: "#3F3D39",
  neutral800: colorTokens.ink,
  neutral900: colorTokens.ink,
  brand50: "#FBE8DF",
  brand100: "#F8D8CC",
  brand200: "#F1B29A",
  brand300: "#EA8969",
  brand400: colorTokens.visualCoral,
  brand500: colorTokens.visualCoral,
  brand600: colorTokens.brandText,
  brand700: colorTokens.brandText,
  constructive50: colorTokens.constructiveTint,
  constructive100: "#D7E9DC",
  constructive200: "#B5D2BD",
  constructive300: "#85B595",
  constructive400: "#5F9271",
  constructive500: colorTokens.constructiveInk,
  constructive600: colorTokens.constructiveInk,
  constructive700: "#284938",
  constructive800: "#1F382A",
  highlight100: colorTokens.highlightTint,
  highlight300: "#EBCF82",
  highlight400: "#D6AC43",
  highlight500: colorTokens.highlightInk,
  highlightInk: colorTokens.highlightInk,
  highlightInkStrong: "#4D380A",
  information50: colorTokens.infoTint,
  information100: colorTokens.infoTint,
  information300: "#AFCED5",
  information500: colorTokens.infoInk,
  information600: colorTokens.infoInk,
  error100: colorTokens.errorTint,
  error500: colorTokens.errorInk,
  error600: "#703027",
} as const;

export type NativeTonalScaleToken = keyof typeof nativeTonalScale;

export const approvedColorPairs = [
  { foreground: "ink", background: "canvas", minimumRatio: 4.5, usage: "body" },
  { foreground: "ink", background: "paper", minimumRatio: 4.5, usage: "body" },
  { foreground: "ink", background: "floating", minimumRatio: 4.5, usage: "body" },
  { foreground: "paper", background: "midnightAction", minimumRatio: 4.5, usage: "action" },
  { foreground: "brandText", background: "canvas", minimumRatio: 4.5, usage: "text" },
  { foreground: "brandText", background: "paper", minimumRatio: 4.5, usage: "text" },
  { foreground: "constructiveInk", background: "constructiveTint", minimumRatio: 4.5, usage: "state" },
  { foreground: "infoInk", background: "infoTint", minimumRatio: 4.5, usage: "state" },
  { foreground: "highlightInk", background: "highlightTint", minimumRatio: 4.5, usage: "state" },
  { foreground: "errorInk", background: "errorTint", minimumRatio: 4.5, usage: "state" },
  { foreground: "visualCoral", background: "canvas", minimumRatio: 3, usage: "large-display-only" },
] as const;

export const COLOR_CONTRACT = {
  version: DESIGN_CONTRACT_VERSION,
  tokens: colorTokens,
  usage: colorUsage,
  composition: colorComposition,
  webCompatibilityTokens,
  nativeTonalScale,
  approvedPairs: approvedColorPairs,
} as const;
