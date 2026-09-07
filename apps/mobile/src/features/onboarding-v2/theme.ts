/**
 * Onboarding v2's own token set. Deliberately not `native-projection.ts`:
 * this lab is a bounded, Keiki-styled experiment the founder asked to feel
 * without touching the production Quiet-authority contract
 * (packages/design/src/contract/). Names mirror that contract's shape
 * (colors.ts, typography.ts) so graduating a screen out of the lab is a
 * rename, not a rewrite.
 *
 * Palette: one saturated field (the hero sky, ported from the existing
 * signin.tsx gradient), coral as the single accent (Homa's presence, the
 * roof thread, selected-chip borders), midnight as the enabled-CTA fill
 * (never coral-fill with white text, which fails contrast per the council
 * review's design-contract lens). EB Garamond for bubble questions
 * (already loaded fleet-wide, matches signin.tsx's headline), DM Sans for
 * chips and captions. Fredoka stays Logo-only, never used here.
 */
import { fontFamilies } from "../../theme/fonts";

export const v2Colors = {
  page: "#FBE8DF",
  field: "#F2703A",
  fieldMid: "#F7BE6E",
  fieldSoft: "#FBE8DF",
  coral: "#D9491F",
  coralSoft: "#F2CFC0",
  midnight: "#1F2430",
  ink: "#20242B",
  inkMuted: "#6B6154",
  paper: "#FFFFFF",
  paperMuted: "#FBF7F2",
  border: "#E7D9CC",
  onMidnight: "#FBF7F2",
  onCoral: "#FFFFFF",
  danger: "#B3261E",
} as const;

export const v2Radii = {
  chip: 14,
  control: 16,
  bubble: 20,
  card: 24,
  pill: 999,
} as const;

export const v2Space = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 } as const;

export const v2Type = {
  question: { fontFamily: fontFamilies.display, fontSize: 24, lineHeight: 30 },
  caption: { fontFamily: fontFamilies.body, fontSize: 15, lineHeight: 21 },
  chip: { fontFamily: fontFamilies.bodyMedium, fontSize: 16, lineHeight: 21 },
  control: { fontFamily: fontFamilies.bodySemibold, fontSize: 16, lineHeight: 21 },
  hero: { fontFamily: fontFamilies.display, fontSize: 30, lineHeight: 37 },
} as const;
