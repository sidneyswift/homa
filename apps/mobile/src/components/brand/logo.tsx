import { Text, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

import { fontFamilies } from "../../theme/fonts";
import { colors, palette } from "../../theme/tokens";

/**
 * Homa logo, "the little home", ported from
 * apps/web/components/brand/Logo.tsx (itself ported from
 * docs/homa-design/components/brand/Logo.jsx, the source of truth).
 * Keep the three copies in sync until packages/design exists (M1-17).
 */

const HOUSE_PATH =
  "M24 5.6 C22.5 5.6 21 6.2 19.8 7.3 L7.1 18.9 C5.5 20.4 4.6 22.5 4.6 24.7 L4.6 35.2 C4.6 40.1 8.5 44 13.4 44 L34.6 44 C39.5 44 43.4 40.1 43.4 35.2 L43.4 24.7 C43.4 22.5 42.5 20.4 40.9 18.9 L28.2 7.3 C27 6.2 25.5 5.6 24 5.6 Z";

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
  const word = tone === "dark" ? "#FFFFFF" : colors.textStrong;

  const mark = (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path d={HOUSE_PATH} fill={body} />
      <Circle cx="17.4" cy="26" r="4.8" fill="#FFFFFF" />
      <Circle cx="30.6" cy="26" r="4.8" fill="#FFFFFF" />
      <Circle cx="18.3" cy="26.7" r="2.2" fill={palette.stone900} />
      <Circle cx="31.5" cy="26.7" r="2.2" fill={palette.stone900} />
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
