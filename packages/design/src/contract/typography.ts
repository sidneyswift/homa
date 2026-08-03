import { DESIGN_CONTRACT_VERSION } from "./version.ts";

export const fontRoles = {
  display: { family: "EB Garamond", minimumPx: 20, allowedWeights: [400, 500, 600, 700], purpose: "meaningful invitations, page titles, reflective framing" },
  interface: { family: "DM Sans", minimumPx: 12, allowedWeights: [400, 500, 600, 700], purpose: "UI, body, labels, data, and controls" },
  wordmark: { family: "Fredoka", minimumPx: 12, allowedWeights: [500, 600, 700], purpose: "real Logo component only" },
} as const;

export const typeRoles = {
  hero: { familyRole: "display", phone: { size: 44, lineHeight: 46 }, desktop: { size: 64, lineHeight: 66 } },
  pageTitle: { familyRole: "display", minSize: 32, maxSize: 40, minLineHeight: 36, maxLineHeight: 44 },
  sectionTitle: { familyRole: "display", minSize: 26, maxSize: 32, minLineHeight: 31, maxLineHeight: 37 },
  body: { familyRole: "interface", size: 16, lineHeight: 24 },
  bodyLarge: { familyRole: "interface", size: 18, lineHeight: 28 },
  bodySmall: { familyRole: "interface", size: 14, lineHeight: 20 },
  control: { familyRole: "interface", size: 15, lineHeight: 20 },
  label: { familyRole: "interface", size: 14, lineHeight: 20 },
  caption: { familyRole: "interface", size: 13, lineHeight: 18 },
  eyebrow: { familyRole: "interface", size: 12, lineHeight: 16, tracking: "0.08em" },
  metric: { familyRole: "interface", size: 16, lineHeight: 20, tabular: true },
} as const;

export type FontRole = keyof typeof fontRoles;
export type TypeRole = keyof typeof typeRoles;
export const TYPOGRAPHY_CONTRACT = { version: DESIGN_CONTRACT_VERSION, fontRoles, typeRoles, sentenceCase: true } as const;
