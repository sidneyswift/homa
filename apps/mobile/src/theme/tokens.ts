/**
 * Frozen compatibility names for existing mobile routes. New primitives use
 * the `quiet*` exports from native-projection.ts. Route migrations remove
 * these names instead of changing their values in place.
 */
export {
  colors,
  darkQuietColors,
  darkColors,
  fontSize,
  nativeProjection,
  palette,
  pressScale,
  quietColors,
  quietElevation,
  quietPressScale,
  quietRadii,
  quietSpace,
  quietTonalScale,
  quietTypeRoles,
  quietTypeScale,
  radius,
  shadows,
  space,
} from "./native-projection";

export type { NativeProjection } from "./native-projection";
