import { Text, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { logoGeometry } from "@homa/design/contract";

import { fontFamilies } from "../../theme/fonts";
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

// [letter, baseline offset multiplier, rotation] for the bounced wordmark.
const WORDMARK_LETTERS: readonly (readonly [string, number, number])[] = [
  ["H", -0.06, -3],
  ["o", 0.05, 0],
  ["m", -0.04, 2],
  ["a", 0.06, -2],
];

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
  const word = tone === "dark" ? colors.card : colors.textStrong;

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

  const letterSize = size * 0.98;
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel="Homa"
      style={{ flexDirection: "row", alignItems: "center", gap: size * 0.3 }}
    >
      {mark}
      <View style={{ flexDirection: "row", marginTop: size * -0.04 }}>
        {WORDMARK_LETTERS.map(([letter, offsetY, rotateDeg]) => (
          <Text
            key={letter}
            style={{
              fontFamily: fontFamilies.wordmark,
              fontSize: letterSize,
              lineHeight: letterSize * 1.1,
              color: word,
              transform: [
                { translateY: letterSize * offsetY },
                { rotate: `${rotateDeg}deg` },
              ],
            }}
          >
            {letter}
          </Text>
        ))}
      </View>
    </View>
  );
}
