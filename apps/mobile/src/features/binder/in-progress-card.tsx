import { Image, Linking, Pressable, Text, View } from "react-native";

import { Button } from "../../components/ui/button";
import { fontFamilies , colors, fontSize, radius, space } from "../../theme/app2";
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
  onOpen,
}: {
  material: BinderMaterial;
  keeping: boolean;
  onKeep: () => void;
  onOpen?: () => void;
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
      <Pressable
        accessible
        accessibilityRole={material.activityPlan && onOpen ? "button" : "link"}
        accessibilityLabel={`Open draft ${material.activityPlan && onOpen ? "plan" : "PDF"} for ${material.title}`}
        accessibilityHint={material.activityPlan && onOpen ? "Adjust this activity plan" : "Opens outside Homa"}
        onPress={() => material.activityPlan && onOpen ? onOpen() : void Linking.openURL(material.pdfUrl).catch(() => {})}
        style={{ minHeight: 44 }}
      >
        <Image
          accessible={false}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          source={{ uri: material.previewUrl }}
          style={{ width: "100%", aspectRatio: 8.5 / 11, backgroundColor: "#FFFFFF" }}
          resizeMode="cover"
        />
      </Pressable>
      <View style={{ padding: space.sm, gap: space.xs }}>
        <Text style={{ fontFamily: fontFamilies.bodySemibold, fontSize: fontSize.sm, color: colors.textStrong }}>
          {material.title}
        </Text>
        <Button label={keeping ? "Keeping…" : "Keep this one"} size="sm" disabled={keeping} onPress={onKeep} />
      </View>
    </View>
  );
}
