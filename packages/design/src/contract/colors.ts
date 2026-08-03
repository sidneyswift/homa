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

export const COLOR_CONTRACT = { version: DESIGN_CONTRACT_VERSION, tokens: colorTokens, usage: colorUsage, approvedPairs: approvedColorPairs } as const;
