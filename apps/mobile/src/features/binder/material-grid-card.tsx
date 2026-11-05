import { Image, Pressable, Text, View } from "react-native";

import { fontFamilies , colors, fontSize, radius, shadows, space } from "../../theme/app2";
import type { BinderMaterial } from "./binder-model";
import { KIND_LABELS } from "./binder-model";

export function MaterialGridCard({ material, onPress }: { material: BinderMaterial; onPress: () => void }) {
  return (
    <Pressable
      accessible
      accessibilityRole="button"
      accessibilityLabel={`Open ${material.title}. ${KIND_LABELS[material.kind]}. ${material.pageCount} ${material.pageCount === 1 ? "page" : "pages"}. For ${material.childName ?? "the family"}.`}
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
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        source={{ uri: material.previewUrl }}
        style={{ width: "100%", aspectRatio: 8.5 / 11, backgroundColor: "#FFFFFF" }}
        resizeMode="cover"
      />
      <View style={{ padding: space.sm, gap: 4 }}>
        <Text style={{ fontFamily: fontFamilies.bodySemibold, fontSize: fontSize.sm, color: colors.textStrong }}>
          {material.title}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <View style={{ paddingHorizontal: space.xs, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: colors.brandSoft }}>
            <Text style={{ fontFamily: fontFamilies.bodyBold, fontSize: 10, color: colors.textStrong }}>
              {KIND_LABELS[material.kind]}
            </Text>
          </View>
          {material.pageCount > 1 ? (
            <Text style={{ fontFamily: fontFamilies.body, fontSize: fontSize.xs, color: colors.textMuted }}>
              {material.pageCount} pages
            </Text>
          ) : null}
        </View>
        <Text style={{ fontFamily: fontFamilies.bodyMedium, fontSize: fontSize.xs, color: colors.textMuted }}>
          {material.childName ?? "Family"}
        </Text>
      </View>
    </Pressable>
  );
}
