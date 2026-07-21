import { Image, Text, View } from "react-native";

import { fontFamilies } from "../../theme/fonts";
import { colors, palette } from "../../theme/tokens";

/**
 * One kid's face on the week board, ported from
 * apps/web/components/dashboard/kid-avatar.tsx: the uploaded profile
 * photo when the family added one, otherwise the toned initial circle.
 * Tones are keyed by position in the family list so a kid keeps their
 * color everywhere. Web's sky-600 and sage-700 inks have no copied
 * mobile step yet, so the nearest token stands in.
 */

const AVATAR_TONES: readonly (readonly [string, string])[] = [
  [palette.clay100, palette.clay700],
  [palette.sky100, palette.sky500],
  [palette.sage100, palette.sage600],
  [palette.gold100, palette.goldInk],
];

export function KidAvatar({
  name,
  index,
  avatarUrl,
  size,
}: {
  name: string;
  /** Position in the family list, drives the fallback tone. */
  index: number;
  avatarUrl: string | null;
  size: number;
}) {
  if (avatarUrl) {
    return (
      <Image
        source={{ uri: avatarUrl }}
        accessibilityLabel={name}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 1,
          borderColor: colors.borderSubtle,
        }}
      />
    );
  }
  const [bg, ink] = AVATAR_TONES[index % AVATAR_TONES.length];
  return (
    <View
      accessibilityLabel={name}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: bg,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        style={{
          fontFamily: fontFamilies.bodyBold,
          fontSize: size * 0.45,
          color: ink,
        }}
      >
        {name.charAt(0)}
      </Text>
    </View>
  );
}
