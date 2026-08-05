/**
 * React Native's platform adapter for the generated Quiet authority
 * projection. This file contains no independent design values. It translates
 * the machine contract into React Native's unitless style shapes and keeps the
 * existing route imports stable while migration proceeds.
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

export const quietColors = nativeThemeColors.light;
export const darkQuietColors = nativeThemeColors.dark;

/**
 * Frozen compatibility names for routes owned by the native migration wave.
 * Exact values remain in @homa/design. New code uses quietColors and the
 * semantic tonal scale instead of extending this adapter.
 */
export const palette = {
  stone50: nativeTonalScale.neutral50,
  stone100: nativeTonalScale.neutral100,
  stone200: nativeTonalScale.neutral200,
  stone300: nativeTonalScale.neutral300,
  stone400: nativeTonalScale.neutral400,
  stone500: nativeTonalScale.neutral500,
  stone600: nativeTonalScale.neutral600,
  stone700: nativeTonalScale.neutral700,
  stone800: nativeTonalScale.neutral800,
  stone900: nativeTonalScale.neutral900,
  clay50: nativeTonalScale.brand50,
  clay100: nativeTonalScale.brand100,
  clay200: nativeTonalScale.brand200,
  clay300: nativeTonalScale.brand300,
  clay400: nativeTonalScale.brand400,
  clay500: nativeTonalScale.brand500,
  clay600: nativeTonalScale.brand600,
  clay700: nativeTonalScale.brand700,
  sage50: nativeTonalScale.constructive50,
  sage100: nativeTonalScale.constructive100,
  sage200: nativeTonalScale.constructive200,
  sage300: nativeTonalScale.constructive300,
  sage400: nativeTonalScale.constructive400,
  sage500: nativeTonalScale.constructive500,
  sage600: nativeTonalScale.constructive600,
  sage700: nativeTonalScale.constructive700,
  sage800: nativeTonalScale.constructive800,
  gold100: nativeTonalScale.highlight100,
  gold300: nativeTonalScale.highlight300,
  gold400: nativeTonalScale.highlight400,
  gold500: nativeTonalScale.highlight500,
  goldInk: nativeTonalScale.highlightInk,
  goldInkStrong: nativeTonalScale.highlightInkStrong,
  sky50: nativeTonalScale.information50,
  sky100: nativeTonalScale.information100,
  sky300: nativeTonalScale.information300,
  sky500: nativeTonalScale.information500,
  sky600: nativeTonalScale.information600,
  rose100: nativeTonalScale.error100,
  rose500: nativeTonalScale.error500,
  rose600: nativeTonalScale.error600,
} as const;

export const colors = {
  ...quietColors,
  sage: quietColors.constructive,
  sageSoft: quietColors.constructiveSoft,
  gold: quietColors.highlight,
  goldSoft: quietColors.highlightSoft,
} as const;

export const darkColors = {
  ...darkQuietColors,
  sage: darkQuietColors.constructive,
  sageSoft: darkQuietColors.constructiveSoft,
  gold: darkQuietColors.highlight,
  goldSoft: darkQuietColors.highlightSoft,
} as const;

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

export const fontSize = nativeTypeScale;
export const shadows = nativeElevation;

/** Press feedback is a semantic motion role, not a route-local magic number. */
export const pressScale = NATIVE_PROJECTION_CONTRACT.theme.motion.pressScale;

export type NativeProjection = typeof nativeProjection;
