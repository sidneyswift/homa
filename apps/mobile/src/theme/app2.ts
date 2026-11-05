import { colors as legacyColors, quietColors as contractQuietColors } from "./native-projection";
import { fontFamilies as loadedFonts } from "./fonts";

/** Founder-selected white, minimal native App 2 surface, gh#1236. */
export const colors = {
  ...legacyColors,
  page: "#FFFFFF", card: "#FFFFFF", surfaceSunken: "#F5F5F5",
  textStrong: "#202124", textBody: "#202124", textMuted: "#626262", textSubtle: "#626262",
  action: "#202124", brand: "#202124", brandHover: "#202124", brandSoft: "#F5F5F5",
  onBrand: "#FFFFFF", border: "#D5D5D5", borderSubtle: "#EEEEEE", focusRing: "#202124",
} as const;
/**
 * The same App 2 surface in the contract's quiet names, for the shared
 * primitives (components/ui/semantic.tsx), so every route that composes
 * them reads as App 2 (founder ask 2026-11-03: the whole iOS app). Status
 * colors, the Homa orange, and the 3:1 field boundary stay the contract's.
 */
export const quietColors = {
  ...contractQuietColors,
  page: colors.page, card: colors.card, surfaceRaised: colors.card, surfaceSunken: colors.surfaceSunken,
  textStrong: colors.textStrong, textBody: colors.textBody, textMuted: colors.textMuted, textSubtle: colors.textSubtle,
  action: colors.action, actionText: colors.onBrand, brandText: colors.textStrong, brandSoft: colors.brandSoft,
  onBrand: colors.onBrand, borderSubtle: colors.borderSubtle, focusRing: colors.focusRing,
} as const;
export const fontFamilies = { ...loadedFonts, display: loadedFonts.bodyBold, displaySemibold: loadedFonts.bodySemibold };
export { darkColors, palette, fontSize, space, radius, shadows, pressScale } from "./native-projection";
export { darkQuietColors, quietPressScale, quietRadii, quietSpace, quietTypeRoles, quietTypeScale } from "./native-projection";
