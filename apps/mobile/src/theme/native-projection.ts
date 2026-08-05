/**
 * React Native's platform boundary for Quiet authority.
 *
 * The `quiet*` exports are the live semantic projection from @homa/design.
 * The older route API below is a frozen snapshot owned by #720. It must not
 * resolve through the live contract, because that would restyle an unmigrated
 * screen without route-level evidence.
 */
import {
  NATIVE_PROJECTION_CONTRACT,
  nativeElevation,
  nativeThemeColors,
  nativeTonalScale,
  nativeTypeScale,
  spacing,
  radii,
} from "@homa/design/contract";

export const nativeProjection = NATIVE_PROJECTION_CONTRACT;
export const quietTonalScale = nativeTonalScale;
export const quietColors = nativeThemeColors.light;
export const darkQuietColors = nativeThemeColors.dark;
export const quietSpace = spacing;
export const quietRadii = radii;
export const quietTypeScale = nativeTypeScale;
export const quietElevation = nativeElevation;
export const quietPressScale = NATIVE_PROJECTION_CONTRACT.theme.motion.pressScale;

/** Frozen compatibility snapshot. Delete it as #720 migrates its consumers. */
export const palette = {
  stone50: "#F7F4EE",
  stone100: "#EEEAE2",
  stone200: "#DED8CC",
  stone300: "#918B83",
  stone400: "#77736B",
  stone500: "#68645E",
  stone600: "#5B5852",
  stone700: "#3F3D39",
  stone800: "#20242B",
  stone900: "#20242B",
  clay50: "#FBE8DF",
  clay100: "#F8D8CC",
  clay200: "#F1B29A",
  clay300: "#EA8969",
  clay400: "#E7602F",
  clay500: "#E7602F",
  clay600: "#A33F22",
  clay700: "#A33F22",
  sage50: "#E5EFE8",
  sage100: "#D7E9DC",
  sage200: "#B5D2BD",
  sage300: "#85B595",
  sage400: "#5F9271",
  sage500: "#335C46",
  sage600: "#335C46",
  sage700: "#284938",
  sage800: "#1F382A",
  gold100: "#F7EBC7",
  gold300: "#EBCF82",
  gold400: "#D6AC43",
  gold500: "#76560F",
  goldInk: "#76560F",
  goldInkStrong: "#4D380A",
  sky50: "#E4EFF2",
  sky100: "#E4EFF2",
  sky300: "#AFCED5",
  sky500: "#2F5968",
  sky600: "#2F5968",
  rose100: "#F5E5E1",
  rose500: "#923F33",
  rose600: "#703027",
} as const;

export const colors = {
  page: palette.stone50,
  card: "#FFFEFC",
  surfaceSunken: palette.stone100,
  textStrong: palette.stone900,
  textBody: palette.stone800,
  textMuted: palette.stone600,
  textSubtle: palette.stone500,
  brand: palette.clay500,
  action: "#27374D",
  brandHover: palette.clay600,
  brandSoft: palette.clay50,
  onBrand: "#FFFEFC",
  sage: palette.sage500,
  sageSoft: palette.sage50,
  gold: palette.gold500,
  goldSoft: palette.gold100,
  border: palette.stone300,
  borderSubtle: palette.stone200,
  focusRing: palette.clay500,
  success: palette.sage600,
  danger: palette.rose500,
  dangerSoft: palette.rose100,
  info: palette.sky500,
} as const;

export const darkColors = {
  page: "#1E2936",
  card: "#27374D",
  surfaceRaised: "#33465E",
  surfaceSunken: "#17212C",
  textStrong: "#FFFEFC",
  textBody: "#F2EEE7",
  textMuted: "#C7C2BA",
  textSubtle: "#A9A39A",
  brand: "#E7602F",
  action: "#27374D",
  brandHover: "#F0835A",
  brandSoft: "#573426",
  onBrand: "#FFFEFC",
  sage: "#9BC5A8",
  sageSoft: "#294737",
  gold: "#EBCF82",
  goldSoft: "#51431F",
  border: "#53677D",
  borderSubtle: "#40546A",
  focusRing: "#F0835A",
  success: "#9BC5A8",
  danger: "#F2A296",
  dangerSoft: "#59332E",
  info: "#AFCED5",
} as const;

export const space = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 } as const;
export const radius = { xs: 8, sm: 10, md: 12, lg: 18, xl: 28, pill: 999 } as const;
export const fontSize = { xs: 12, sm: 14, base: 16, lg: 18, xl: 22, xxl: 28, xxxl: 36 } as const;
export const shadows = {
  sm: {
    shadowColor: "#20242B",
    shadowOpacity: 0.08,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  md: {
    shadowColor: "#20242B",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
} as const;
export const pressScale = 0.98;

export type NativeProjection = typeof nativeProjection;
