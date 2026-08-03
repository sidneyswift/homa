/**
 * React Native's platform adapter for the generated Quiet authority
 * projection. This file contains no independent design values. It translates
 * the machine contract into React Native's unitless style shapes and keeps the
 * existing route imports stable while migration proceeds.
 */
import {
  NATIVE_PROJECTION_CONTRACT,
  nativeColorScale,
  nativeElevation,
  nativeThemeColors,
  nativeTypeScale,
  spacing,
  radii,
} from "@homa/design/contract";

export const nativeProjection = NATIVE_PROJECTION_CONTRACT;

export const palette = nativeColorScale;
export const colors = nativeThemeColors.light;
export const darkColors = nativeThemeColors.dark;

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
