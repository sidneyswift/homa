import { Image, Pressable, Text, View } from "react-native";

import { fontFamilies } from "../../theme/fonts";
import {
  colors,
  fontSize,
  palette,
  pressScale,
  radius,
  space,
} from "../../theme/tokens";
import { KIND_LABELS, type BinderMaterial } from "./binder-model";

/**
 * One Binder item, the native twin of
 * apps/web/app/app/binder/binder-card.tsx: the large real preview image
 * (the same JPEG chat's material-card.tsx renders, not a placeholder
 * icon) plus a plain, human caption underneath. A Pressable, not a
 * link: it opens the detail sheet rather than navigating away. Sized by
 * its parent (the 2-column grid), so no width of its own.
 */

/** The web card's four rotating chip tones, mapped to mobile palette. */
const KIND_TONES: readonly (readonly [string, string])[] = [
  [palette.clay50, palette.clay700],
  [palette.sage50, palette.sage600],
  [palette.gold100, palette.goldInk],
  [palette.sky100, palette.sky500],
];

const KIND_ORDER = Object.keys(KIND_LABELS);

function kindTone(kind: string): readonly [string, string] {
  const index = Math.max(0, KIND_ORDER.indexOf(kind));
  return KIND_TONES[index % KIND_TONES.length];
}

export function BinderTile({
  material,
  onOpen,
}: {
  material: BinderMaterial;
  onOpen: (material: BinderMaterial) => void;
}) {
  const [chipBg, chipInk] = kindTone(material.kind);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${material.title}. View and print.`}
      onPress={() => onOpen(material)}
      style={({ pressed }) => ({
        transform: [{ scale: pressed ? pressScale : 1 }],
        gap: space.sm,
      })}
    >
      <Image
        source={{ uri: material.previewUrl }}
        accessibilityLabel={`Preview of ${material.title}`}
        style={{
          width: "100%",
          aspectRatio: 8.5 / 11,
          borderRadius: radius.sm,
          borderWidth: 1,
          borderColor: colors.borderSubtle,
          // Materials render on white paper; the page tint would show
          // through the JPEG's margins otherwise.
          backgroundColor: "#FFFFFF",
        }}
        resizeMode="cover"
      />
      <View style={{ gap: 2 }}>
        <Text
          numberOfLines={1}
          style={{
            fontFamily: fontFamilies.bodySemibold,
            fontSize: fontSize.sm,
            color: colors.textStrong,
          }}
        >
          {material.title}
        </Text>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            flexWrap: "wrap",
          }}
        >
          <View
            style={{
              borderRadius: radius.pill,
              backgroundColor: chipBg,
              paddingHorizontal: 8,
              paddingVertical: 2,
            }}
          >
            <Text
              style={{
                fontFamily: fontFamilies.bodyBold,
                fontSize: 10,
                color: chipInk,
              }}
            >
              {KIND_LABELS[material.kind]}
            </Text>
          </View>
          <Text
            numberOfLines={1}
            style={{
              fontFamily: fontFamilies.body,
              fontSize: fontSize.xs,
              color: colors.textSubtle,
            }}
          >
            {material.childName ?? "Family"}
            {material.pageCount > 1 ? ` · ${material.pageCount} pages` : ""}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}
