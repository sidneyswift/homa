/**
 * Compatibility names for existing mobile routes. The values are projected
 * from @homa/design/contract in native-projection.ts. New primitives should
 * import the projection directly, while route migrations can keep these
 * semantic names until their local styles are replaced.
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
  radius,
  shadows,
  space,
} from "./native-projection";

export type { NativeProjection } from "./native-projection";
