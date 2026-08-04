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
  visualCoral: "Homa presence, roof thread, punctuation, visual signature",
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
 * The native adapter still needs a few tonal steps for child-facing accents,
 * calendars, and truthful status surfaces. They live here, beside the
 * semantic contract, so React Native cannot grow a private color vocabulary.
 */
export const nativeColorScale = {
  stone50: colorTokens.canvas,
  stone100: "#EEEAE2",
  stone200: "#DED8CC",
  stone300: colorTokens.controlBoundary,
  stone400: "#77736B",
  stone500: "#68645E",
  stone600: "#5B5852",
  stone700: "#3F3D39",
  stone800: colorTokens.ink,
  stone900: colorTokens.ink,
  clay50: "#FBE8DF",
  clay100: "#F8D8CC",
  clay200: "#F1B29A",
  clay300: "#EA8969",
  clay400: colorTokens.visualCoral,
  clay500: colorTokens.visualCoral,
  clay600: colorTokens.brandText,
  clay700: colorTokens.brandText,
  sage50: colorTokens.constructiveTint,
  sage100: "#D7E9DC",
  sage200: "#B5D2BD",
  sage300: "#85B595",
  sage400: "#5F9271",
  sage500: colorTokens.constructiveInk,
  sage600: colorTokens.constructiveInk,
  sage700: "#284938",
  sage800: "#1F382A",
  gold100: colorTokens.highlightTint,
  gold300: "#EBCF82",
  gold400: "#D6AC43",
  gold500: colorTokens.highlightInk,
  goldInk: colorTokens.highlightInk,
  goldInkStrong: "#4D380A",
  sky50: colorTokens.infoTint,
  sky100: colorTokens.infoTint,
  sky300: "#AFCED5",
  sky500: colorTokens.infoInk,
  sky600: colorTokens.infoInk,
  rose100: colorTokens.errorTint,
  rose500: colorTokens.errorInk,
  rose600: "#703027",
} as const;

export type NativeColorScaleToken = keyof typeof nativeColorScale;

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
  webCompatibilityTokens,
  nativeColorScale,
  approvedPairs: approvedColorPairs,
} as const;
