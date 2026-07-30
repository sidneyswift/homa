import { Image, Pressable, Text, View } from "react-native";

import { fontFamilies } from "../../theme/fonts";
import { colors, fontSize, radius, shadows, space } from "../../theme/tokens";
import type { BinderMaterial } from "./binder-model";
import { KIND_LABELS } from "./binder-model";

export function MaterialGridCard({ material, onPress }: { material: BinderMaterial; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        backgroundColor: colors.card,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.borderSubtle,
        overflow: "hidden",
        ...shadows.sm,
      }}
    >
      <Image
        source={{ uri: material.previewUrl }}
        accessibilityLabel={`Preview of ${material.title}`}
        style={{ width: "100%", aspectRatio: 8.5 / 11, backgroundColor: "#FFFFFF" }}
        resizeMode="cover"
      />
      <View style={{ padding: space.sm, gap: 4 }}>
        <Text numberOfLines={2} style={{ fontFamily: fontFamilies.bodySemibold, fontSize: fontSize.sm, color: colors.textStrong }}>
          {material.title}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <View style={{ paddingHorizontal: space.xs, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: colors.brandSoft }}>
            <Text style={{ fontFamily: fontFamilies.bodyBold, fontSize: 10, color: colors.brandHover }}>
              {KIND_LABELS[material.kind]}
            </Text>
          </View>
          {material.pageCount > 1 ? (
            <Text style={{ fontFamily: fontFamilies.body, fontSize: fontSize.xs, color: colors.textSubtle }}>
              {material.pageCount} pages
            </Text>
          ) : null}
        </View>
        <Text numberOfLines={1} style={{ fontFamily: fontFamilies.bodyMedium, fontSize: fontSize.xs, color: colors.textMuted }}>
          {material.childName ?? "Family"}
        </Text>
      </View>
    </Pressable>
  );
}
