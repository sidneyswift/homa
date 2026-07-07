/**
 * Homa design tokens for React Native, hand-copied from
 * docs/homa-design/tokens/ (the source of truth) via apps/web's
 * globals.css. Same rule as the web app: if docs/homa-design tokens
 * change, update this file too so nothing drifts (see AGENTS.md;
 * packages/design replaces both hand-copies when M1-17 lands).
 *
 * Values are px numbers because React Native styles are unitless.
 */

export const palette = {
  stone50: "#FBF7F0",
  stone100: "#F3ECE1",
  stone200: "#E7DDCE",
  stone300: "#D6C8B4",
  stone400: "#B3A492",
  stone500: "#8A7D6C",
  stone600: "#6B6259",
  stone700: "#4E463E",
  stone800: "#332E29",
  stone900: "#221E1A",

  clay50: "#FFF0E8",
  clay100: "#FFDDC9",
  clay200: "#FFBE9C",
  clay300: "#FB9868",
  clay400: "#F1793F",
  clay500: "#E7602F",
  clay600: "#C44C22",
  clay700: "#9C3B1B",

  sage50: "#EAF6EC",
  sage100: "#D2ECD6",
  sage300: "#7CC689",
  sage500: "#3D9A50",
  sage600: "#2F7C40",

  gold100: "#FFF3C2",
  gold500: "#F0BE00",
  goldInk: "#8A6410",

  sky100: "#DDF3F9",
  sky500: "#4FB4D6",

  rose100: "#FDE1D8",
  rose500: "#E2593B",
} as const;

/** Semantic aliases, mirroring globals.css. Use these, not the palette. */
export const colors = {
  page: palette.stone50,
  card: "#FFFFFF",
  surfaceSunken: palette.stone100,

  textStrong: palette.stone900,
  textBody: palette.stone800,
  textMuted: palette.stone600,
  textSubtle: palette.stone500,

  brand: palette.clay500,
  brandHover: palette.clay600,
  brandSoft: palette.clay50,
  onBrand: "#FFFFFF",

  sage: palette.sage500,
  sageSoft: palette.sage50,
  gold: palette.gold500,
  goldSoft: palette.gold100,

  border: palette.stone300,
  borderSubtle: palette.stone200,
  focusRing: palette.clay400,

  success: palette.sage600,
  danger: palette.rose500,
  dangerSoft: palette.rose100,
  info: palette.sky500,
} as const;

/** 4px base scale (space-1 through space-24 in the token sheet). */
export const space = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 22,
  xl: 28,
  pill: 999,
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

/** Soft, warm-tinted shadows (brown, never gray), per shadows.css. */
export const shadows = {
  sm: {
    shadowColor: "#332A21",
    shadowOpacity: 0.08,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  md: {
    shadowColor: "#332A21",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
} as const;

/** Motion: gentle, no bounce (motion.css). */
export const pressScale = 0.98;
