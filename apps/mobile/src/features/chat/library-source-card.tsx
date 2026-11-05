import { Linking, Pressable, Text, View } from "react-native";

import { Card } from "../../components/ui/card";
import { fontFamilies , colors, fontSize, radius, space } from "../../theme/app2";
import type { LibrarySourceCardData } from "./library-source-card-model";

export function LibrarySourceCard({
  source,
}: {
  source: LibrarySourceCardData;
}) {
  const detail = [
    source.kindLabel,
    source.childNames.length > 0
      ? `for ${source.childNames.join(", ")}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <Card style={{ padding: space.md, gap: space.sm }}>
      <View>
        <Text
          style={{
            fontFamily: fontFamilies.bodySemibold,
            fontSize: fontSize.xs,
            color: colors.textMuted,
            textTransform: "uppercase",
          }}
        >
          Library source
        </Text>
        <Text
          style={{
            marginTop: 2,
            fontFamily: fontFamilies.displaySemibold,
            fontSize: fontSize.lg,
            color: colors.textStrong,
          }}
        >
          {source.title}
        </Text>
        {detail ? (
          <Text
            style={{
              marginTop: 2,
              fontFamily: fontFamilies.body,
              fontSize: fontSize.sm,
              color: colors.textMuted,
            }}
          >
            {detail}
          </Text>
        ) : null}
      </View>
      <Pressable
        accessibilityRole="link"
        onPress={() => void Linking.openURL(source.libraryUrl)}
        style={{
          minHeight: 44,
          alignSelf: "flex-start",
          justifyContent: "center",
          borderRadius: radius.md,
          paddingHorizontal: 12,
        }}
      >
        <Text
          style={{
            fontFamily: fontFamilies.bodySemibold,
            fontSize: fontSize.sm,
            color: colors.textStrong,
          }}
        >
          Open in Library
        </Text>
      </Pressable>
    </Card>
  );
}
