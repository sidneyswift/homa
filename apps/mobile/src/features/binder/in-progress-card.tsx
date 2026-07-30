import { Image, Linking, Pressable, Text, View } from "react-native";

import { Button } from "../../components/ui/button";
import { fontFamilies } from "../../theme/fonts";
import { colors, fontSize, radius, space } from "../../theme/tokens";
import type { BinderMaterial } from "./binder-model";

/**
 * A draft nobody finalized yet, ported from apps/web/app/app/binder/
 * in-progress-shelf.tsx (gh#197/gh#377): fleet-wide, only 41-59% of
 * revision chains ever reach final, so a family's Binder can otherwise
 * look empty despite Homa having made things for them. One tap here
 * calls the same finalize_family_material RPC the agent uses.
 */
export function InProgressCard({
  material,
  keeping,
  onKeep,
}: {
  material: BinderMaterial;
  keeping: boolean;
  onKeep: () => void;
}) {
  return (
    <View
      style={{
        width: 220,
        backgroundColor: colors.card,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.borderSubtle,
        overflow: "hidden",
      }}
    >
      <Pressable onPress={() => void Linking.openURL(material.pdfUrl).catch(() => {})}>
        <Image
          source={{ uri: material.previewUrl }}
          accessibilityLabel={`Preview of ${material.title}`}
          style={{ width: "100%", aspectRatio: 8.5 / 11, backgroundColor: "#FFFFFF" }}
          resizeMode="cover"
        />
      </Pressable>
      <View style={{ padding: space.sm, gap: space.xs }}>
        <Text numberOfLines={2} style={{ fontFamily: fontFamilies.bodySemibold, fontSize: fontSize.sm, color: colors.textStrong }}>
          {material.title}
        </Text>
        <Button label={keeping ? "Keeping…" : "Keep this one"} size="sm" disabled={keeping} onPress={onKeep} />
      </View>
    </View>
  );
}
