import { colors as legacyColors } from "./native-projection";
import { fontFamilies as loadedFonts } from "./fonts";

/** Founder-selected white, minimal native App 2 surface, gh#1236. */
export const colors = {
  ...legacyColors,
  page: "#FFFFFF", card: "#FFFFFF", surfaceSunken: "#F5F5F5",
  textStrong: "#202124", textBody: "#202124", textMuted: "#626262", textSubtle: "#626262",
  action: "#202124", brand: "#202124", brandHover: "#202124", brandSoft: "#F5F5F5",
  onBrand: "#FFFFFF", border: "#D5D5D5", borderSubtle: "#EEEEEE", focusRing: "#202124",
} as const;
export const fontFamilies = { ...loadedFonts, display: loadedFonts.bodyBold, displaySemibold: loadedFonts.bodySemibold };
export { darkColors, palette, fontSize, space, radius, shadows, pressScale } from "./native-projection";
