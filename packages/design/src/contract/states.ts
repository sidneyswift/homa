import { DESIGN_CONTRACT_VERSION } from "./version.ts";

export const interactionStates = ["rest", "hover", "keyboard-focus", "pressed", "selected", "disabled", "read-only", "loading", "success", "error", "offline", "interrupted"] as const;
export const qualityModes = ["forced-colors", "increased-contrast", "reduced-motion", "large-text", "200%-zoom", "400%-reflow", "dark-or-adaptive"] as const;
export const semanticStateRoles = {
  constructive: { label: "constructive", ink: "constructiveInk", tint: "constructiveTint" },
  info: { label: "information", ink: "infoInk", tint: "infoTint" },
  highlight: { label: "attention", ink: "highlightInk", tint: "highlightTint" },
  error: { label: "system failure", ink: "errorInk", tint: "errorTint" },
} as const;
export const selectedStateContract = {
  carriers: ["surface-tint", "border", "text", "context", "accessible-state"],
  colorAlone: false,
  minimumConcurrentCarriers: 2,
  functionalAnchor: "midnightAction",
  prohibitedSemanticSubstitutes: ["constructive", "info", "highlight", "error"],
} as const;
export const stateCarrierPolicy = {
  everyStateHasLanguageOrAccessibleState: true,
  semanticColorRequiresTruth: true,
  childWorthIsNeverAState: true,
} as const;
export const STATES_CONTRACT = {
  version: DESIGN_CONTRACT_VERSION,
  interactionStates,
  qualityModes,
  semanticStateRoles,
  selectedStateContract,
  stateCarrierPolicy,
} as const;
