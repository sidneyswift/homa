import { Image, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { logoGeometry } from "@homa/design/contract";

import { colors, palette } from "../../theme/tokens";

/**
 * Homa logo, "the little home", projected from @homa/design's master
 * geometry. Keep this adapter aligned with the generated contract.
 */

export const HOUSE_PATH = logoGeometry.housePath;

/**
 * The eyes, in the same 48x48 viewBox, exported (with HOUSE_PATH,
 * PUPIL_FILL and HOUSE_BASE) for the voice screen's animated character,
 * which must animate THE mark, never a lookalike (brand-casing-homa,
 * 2026-07-28). Mirrors apps/web/components/brand/Logo.tsx's exports.
 * Each pupil sits slightly down and right of its own white, the resting
 * gaze that gives the still logo its character; animated glances move
 * relative to that offset rather than replacing it.
 */
export const EYES = logoGeometry.eyes;

/** The pupil ink, shared for the same reason. */
export const PUPIL_FILL = logoGeometry.pupilFill;

/** Where the house meets the ground, so a squash scales from its base
 *  like clay pressed down rather than from its middle like a balloon. */
export const HOUSE_BASE = { x: 24, y: 44 } as const;

export function Logo({
  size = 32,
  variant = "full",
  tone = "light",
}: {
  size?: number;
  variant?: "full" | "mark";
  tone?: "light" | "dark";
}) {
  const body = tone === "dark" ? palette.clay400 : colors.brand;
  const mark = (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path d={HOUSE_PATH} fill={body} />
      {EYES.map((eye) => (
        <Circle key={eye.cx} cx={eye.cx} cy={eye.cy} r={eye.r} fill={colors.card} />
      ))}
      {EYES.map((eye) => (
        <Circle
          key={eye.cx}
          cx={eye.pupilCx}
          cy={eye.pupilCy}
          r={eye.pupilR}
          fill={PUPIL_FILL}
        />
      ))}
    </Svg>
  );

  if (variant === "mark") {
    return (
      <View accessibilityRole="image" accessibilityLabel="Homa">
        {mark}
      </View>
    );
  }

  const lockup = tone === "dark"
    ? require("../../../assets/brand/homa-lockup-dark.png")
    : require("../../../assets/brand/homa-lockup.png");
  return (
    <Image
      source={lockup}
      accessibilityRole="image"
      accessibilityLabel="Homa"
      fadeDuration={0}
      resizeMode="contain"
      style={{ width: size * (1200 / 270), height: size }}
    />
  );
}
