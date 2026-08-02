import { Text, View } from "react-native";

import { kidTone } from "./kid-tone";
import { fontFamilies } from "../../theme/fonts";
import { colors, fontSize, radius, shadows, space } from "../../theme/tokens";
import { formatMinutesAsHours, type ChildHoursTotals } from "./hours-view";

function TotalStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, alignItems: "center" }}>
      <Text
        style={{
          fontFamily: fontFamilies.bodyBold,
          fontSize: 10,
          letterSpacing: 0.4,
          color: colors.textMuted,
          textTransform: "uppercase",
        }}
      >
        {label}
      </Text>
      <Text
        style={{ fontFamily: fontFamilies.displaySemibold, fontSize: fontSize.lg, color: colors.textStrong, marginTop: 2 }}
      >
        {value}
      </Text>
    </View>
  );
}

export function TotalsCard({ total, kidIndex }: { total: ChildHoursTotals; kidIndex: number }) {
  const [background, textColor] = kidTone(kidIndex);
  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.borderSubtle,
        padding: space.md,
        ...shadows.sm,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            backgroundColor: background,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ fontFamily: fontFamilies.bodyBold, fontSize: fontSize.sm, color: textColor }}>
            {total.childName.charAt(0)}
          </Text>
        </View>
        <Text style={{ fontFamily: fontFamilies.displaySemibold, fontSize: fontSize.base, color: colors.textStrong }}>
          {total.childName}
        </Text>
      </View>
      <View style={{ flexDirection: "row", marginTop: space.sm }}>
        <TotalStat label="This week" value={formatMinutesAsHours(total.week)} />
        <TotalStat label="This month" value={formatMinutesAsHours(total.month)} />
        <TotalStat label="School year" value={formatMinutesAsHours(total.schoolYear)} />
      </View>
    </View>
  );
}
