import { DESIGN_CONTRACT_VERSION } from "./version.ts";

export const fontRoles = {
  display: { family: "EB Garamond", minimumPx: 20, allowedWeights: [400, 500, 600, 700], purpose: "meaningful invitations, page titles, reflective framing" },
  interface: { family: "DM Sans", minimumPx: 12, allowedWeights: [400, 500, 600, 700], purpose: "UI, body, labels, data, and controls" },
  wordmark: { family: "Fredoka", minimumPx: 12, allowedWeights: [500, 600, 700], purpose: "real Logo component only" },
} as const;

export const typeRoles = {
  hero: { familyRole: "display", weights: [600], phone: { size: 44, lineHeight: 46 }, desktop: { size: 64, lineHeight: 66 }, tracking: { minimumEm: -0.03, maximumEm: -0.025, rule: "wrap-tested" } },
  pageTitle: { familyRole: "display", weights: [600], minSize: 32, maxSize: 40, minLineHeight: 36, maxLineHeight: 44, tracking: { minimumEm: -0.025, maximumEm: -0.02, rule: "wrap-tested" } },
  sectionTitle: { familyRole: "display", weights: [600], minSize: 26, maxSize: 32, minLineHeight: 31, maxLineHeight: 37, tracking: { minimumEm: -0.025, maximumEm: -0.02, rule: "wrap-tested" } },
  cardTitle: { familyRole: "display", weights: [600], phone: { size: 20, lineHeight: 26 }, desktop: { size: 22, lineHeight: 28 }, tracking: { minimumEm: -0.02, maximumEm: 0, rule: "wrap-tested" } },
  body: { familyRole: "interface", weights: [400], size: 16, lineHeight: 24 },
  bodyLarge: { familyRole: "interface", weights: [400], size: 18, lineHeight: 28 },
  bodySmall: { familyRole: "interface", weights: [400], size: 14, lineHeight: 20 },
  control: { familyRole: "interface", weights: [600], size: 15, lineHeight: 20, minimumSize: 14 },
  label: { familyRole: "interface", weights: [600], size: 14, lineHeight: 20 },
  caption: { familyRole: "interface", weights: [500], size: 13, lineHeight: 18, meaningfulCustomerTextFloor: true },
  eyebrow: { familyRole: "interface", weights: [700], size: 12, lineHeight: 16, tracking: "0.08em", usage: "nonessential-orientation-only" },
  metric: { familyRole: "interface", weights: [600, 700], minSize: 16, maxSizePhone: 36, maxSizeDesktop: 40, lineHeight: 20, tabular: true },
} as const;

export type FontRole = keyof typeof fontRoles;
export type TypeRole = keyof typeof typeRoles;
export const TYPOGRAPHY_CONTRACT = { version: DESIGN_CONTRACT_VERSION, fontRoles, typeRoles, sentenceCase: true } as const;
