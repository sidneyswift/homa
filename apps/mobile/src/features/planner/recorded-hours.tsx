import { Text, View } from "react-native";

import type { ChildRecord } from "../../lib/family";
import type { HoursLogRow } from "../../lib/hours";
import { formatMinutesAsHours, SUBJECT_LABELS, toHoursEntries } from "../hours/hours-view";
import { subjectTone } from "../hours/subject-tone";
import { fontFamilies } from "../../theme/fonts";
import { colors, fontSize, radius, space } from "../../theme/tokens";

export function RecordedHours({
  rows,
  kids,
}: {
  rows: HoursLogRow[];
  kids: ChildRecord[];
}) {
  if (rows.length === 0) return null;
  const entries = toHoursEntries(rows, kids);
  const totalMinutes = entries.reduce((sum, entry) => sum + entry.minutes, 0);

  return (
    <View style={{ gap: space.xs }}>
      <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}>
        <Text style={{ fontFamily: fontFamilies.bodySemibold, fontSize: fontSize.sm, color: colors.textBody }}>
          Recorded time
        </Text>
        <Text style={{ fontFamily: fontFamilies.body, fontSize: fontSize.xs, color: colors.textMuted }}>
          {formatMinutesAsHours(totalMinutes)}
        </Text>
      </View>
      <View
        style={{
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.borderSubtle,
          borderRadius: radius.sm,
          paddingHorizontal: space.sm,
        }}
      >
        {entries.map((entry, index) => {
          const [background, ink] = subjectTone(entry.subject);
          return (
            <View
              key={entry.id}
              style={{
                minHeight: 44,
                flexDirection: "row",
                alignItems: "center",
                gap: space.xs,
                paddingVertical: space.xs,
                borderTopWidth: index === 0 ? 0 : 1,
                borderTopColor: colors.borderSubtle,
              }}
            >
              <View style={{ paddingHorizontal: space.xs, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: background }}>
                <Text style={{ fontFamily: fontFamilies.bodyBold, fontSize: fontSize.xs, color: ink }}>
                  {SUBJECT_LABELS[entry.subject]}
                </Text>
              </View>
              <Text style={{ fontFamily: fontFamilies.bodySemibold, fontSize: fontSize.xs, color: colors.textStrong }}>
                {formatMinutesAsHours(entry.minutes)}
              </Text>
              <Text style={{ fontFamily: fontFamilies.body, fontSize: fontSize.xs, color: colors.textMuted }}>
                {entry.childName ?? "Whole family"}
              </Text>
              {entry.note ? (
                <Text
                  numberOfLines={1}
                  style={{ flex: 1, fontFamily: fontFamilies.body, fontSize: fontSize.xs, color: colors.textMuted }}
                >
                  {entry.note}
                </Text>
              ) : (
                <View style={{ flex: 1 }} />
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}
