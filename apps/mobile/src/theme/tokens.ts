/**
 * Compatibility names for existing mobile routes. The values are projected
 * from @homa/design/contract in native-projection.ts. New primitives should
 * import the projection directly, while route migrations can keep these
 * semantic names until their local styles are replaced.
 */
export {
  colors,
  darkColors,
  fontSize,
  nativeProjection,
  palette,
  pressScale,
  radius,
  shadows,
  space,
} from "./native-projection";

export type { NativeProjection } from "./native-projection";

/**
 * React Native scales this base line box by Dynamic Type internally. Custom
 * fonts need a roomier ratio at large text sizes so their ascenders and
 * descenders do not clip after the platform applies that multiplier.
 */
export function lineHeightFor(
  size: number,
  fontScale: number,
  multiplier = 1.35,
): number {
  const largeTextMultiplier = fontScale >= 1.4 ? Math.max(multiplier, 1.8) : multiplier;
  return Math.ceil(size * largeTextMultiplier);
}
