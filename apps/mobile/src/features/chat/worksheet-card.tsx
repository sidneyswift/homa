import { Text, View } from "react-native";

import { Card } from "../../components/ui/card";
import { fontFamilies } from "../../theme/fonts";
import { colors, fontSize, radius, space } from "../../theme/tokens";

/**
 * A create_worksheet tool result as an on-brand card. Printing stays a
 * web ability for now (the browser print pipeline); the card says so
 * gently instead of hiding it.
 */

export interface WorksheetPayload {
  childName: string;
  title: string;
  subtitle: string;
  theme: string;
  items: { instruction: string; content: string }[];
  encouragement: string;
}

export function WorksheetCard({ worksheet }: { worksheet: WorksheetPayload }) {
  return (
    <Card style={{ padding: space.md, gap: space.sm }}>
      <Text
        style={{
          fontFamily: fontFamilies.bodyMedium,
          fontSize: fontSize.sm,
          color: colors.brand,
        }}
      >
        Worksheet ready
      </Text>
      <Text
        style={{
          fontFamily: fontFamilies.displaySemibold,
          fontSize: fontSize.lg,
          color: colors.textStrong,
        }}
      >
        {worksheet.title}
      </Text>
      <Text
        style={{
          fontFamily: fontFamilies.body,
          fontSize: fontSize.sm,
          color: colors.textMuted,
        }}
      >
        {worksheet.subtitle} {"\u00B7"} for {worksheet.childName}
      </Text>
      <View style={{ gap: 6, marginTop: 2 }}>
        {worksheet.items.map((item, index) => (
          <View key={index} style={{ flexDirection: "row", gap: space.sm }}>
            <View
              style={{
                width: 22,
                height: 22,
                borderRadius: radius.pill,
                backgroundColor: colors.brandSoft,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text
                style={{
                  fontFamily: fontFamilies.bodySemibold,
                  fontSize: fontSize.xs,
                  color: colors.brand,
                }}
              >
                {index + 1}
              </Text>
            </View>
            <Text
              style={{
                flex: 1,
                fontFamily: fontFamilies.body,
                fontSize: fontSize.sm,
                lineHeight: fontSize.sm * 1.5,
                color: colors.textBody,
              }}
            >
              {item.instruction}
            </Text>
          </View>
        ))}
      </View>
      <Text
        style={{
          marginTop: 4,
          fontFamily: fontFamilies.body,
          fontSize: fontSize.xs,
          color: colors.textMuted,
        }}
      >
        Paper copies print from Homa on the web whenever you want one.
      </Text>
    </Card>
  );
}
