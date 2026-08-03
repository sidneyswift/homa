import { DESIGN_CONTRACT_VERSION } from "./version.ts";

export const contentRules = {
  casing: "sentence-case",
  brandName: "Homa",
  neverBrandUppercase: true,
  voice: "true-clear-memorable-kind",
  relationship: "Homa-suggests-parent-decides",
  childFraming: "no-verdict-no-behind-no-sibling-comparison",
  signature: "real-work-warm-guide-one-useful-next-move",
  constrainedFallback: "Logo-accessible-colors-plain-language-next-move",
  prohibitedPunctuation: ["em-dash"] as const,
} as const;
export const CONTENT_CONTRACT = { version: DESIGN_CONTRACT_VERSION, ...contentRules } as const;
