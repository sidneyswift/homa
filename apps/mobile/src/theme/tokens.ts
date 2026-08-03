/**
 * Native projection of the Quiet authority contract. Components keep the
 * established semantic names while the values come from @homa/design, so a
 * surface can migrate without introducing a second token vocabulary.
 *
 * Values are px numbers because React Native styles are unitless.
 */
import { colorTokens, radii, spacing } from "@homa/design/contract";

export const palette = {
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

/** Semantic aliases, mirroring globals.css. Use these, not the palette. */
export const colors = {
  page: palette.stone50,
  card: colorTokens.paper,
  surfaceSunken: palette.stone100,

  textStrong: palette.stone900,
  textBody: palette.stone800,
  textMuted: palette.stone600,
  textSubtle: palette.stone500,

  brand: palette.clay500,
  action: colorTokens.midnightAction,
  brandHover: palette.clay600,
  brandSoft: palette.clay50,
  onBrand: colorTokens.paper,

  sage: palette.sage500,
  sageSoft: palette.sage50,
  gold: palette.gold500,
  goldSoft: palette.gold100,

  border: colorTokens.controlBoundary,
  borderSubtle: palette.stone200,
  focusRing: colorTokens.visualCoral,

  success: palette.sage600,
  danger: palette.rose500,
  dangerSoft: palette.rose100,
  info: palette.sky500,
} as const;

/**
 * Native semantic colors for the approved dark container profile. Components choose this
 * object as a complete theme so light-theme palette values cannot leak onto
 * a navy surface.
 */
export const darkColors = {
  page: "#1E2936",
  card: "#27374D",
  surfaceRaised: "#33465E",
  surfaceSunken: "#17212C",

  textStrong: "#FFFEFC",
  textBody: "#F2EEE7",
  textMuted: "#C7C2BA",
  textSubtle: "#A9A39A",

  brand: colorTokens.visualCoral,
  brandHover: "#F0835A",
  brandSoft: "#573426",
  onBrand: "#FFFEFC",

  border: "#53677D",
  borderSubtle: "#40546A",
  focusRing: "#F0835A",

  danger: "#F2A296",
  dangerSoft: "#59332E",
} as const;

/** 4px base scale (space-1 through space-24 in the token sheet). */
export const space = {
  xs: spacing.scale[1],
  sm: spacing.scale[2],
  md: spacing.scale[4],
  lg: spacing.scale[6],
  xl: spacing.scale[7],
  xxl: spacing.scale[9],
} as const;

export const radius = {
  xs: 8,
  sm: 10,
  md: radii.control,
  lg: radii.card,
  xl: radii.frame,
  pill: radii.compactPill,
} as const;

/** Type scale in px (the token sheet's rem values times 16). */
export const fontSize = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 22,
  xxl: 28,
  xxxl: 36,
} as const;

/** Quiet, mineral-tinted shadows, limited to two elevations. */
export const shadows = {
  sm: {
    shadowColor: colorTokens.ink,
    shadowOpacity: 0.08,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  md: {
    shadowColor: colorTokens.ink,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
} as const;

/** Motion: gentle, no bounce (motion.css). */
export const pressScale = 0.98;
