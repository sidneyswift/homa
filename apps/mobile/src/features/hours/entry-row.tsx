import { Pressable, Text, View } from "react-native";

import { fontFamilies } from "../../theme/fonts";
import { colors, fontSize, radius, space } from "../../theme/tokens";
import type { HoursEntry } from "./hours-view";
import { formatMinutesAsHours, SOURCE_LABELS, SUBJECT_LABELS } from "./hours-view";
import { subjectTone } from "./subject-tone";

export function EntryRow({
  entry,
  showChild,
  onEdit,
}: {
  entry: HoursEntry;
  showChild: boolean;
  onEdit?: () => void;
}) {
  const [bg, ink] = subjectTone(entry.subject);
  return (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        alignItems: "center",
        gap: space.xs,
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.borderSubtle,
        borderRadius: radius.sm,
        paddingHorizontal: space.sm,
        paddingVertical: space.sm,
      }}
    >
      <View style={{ paddingHorizontal: space.sm, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: bg }}>
        <Text style={{ fontFamily: fontFamilies.bodyBold, fontSize: fontSize.xs, color: ink }}>
          {SUBJECT_LABELS[entry.subject]}
        </Text>
      </View>
      <Text style={{ fontFamily: fontFamilies.displaySemibold, fontSize: fontSize.sm, color: colors.textStrong }}>
        {formatMinutesAsHours(entry.minutes)}
      </Text>
      {showChild ? (
        <Text style={{ fontFamily: fontFamilies.bodySemibold, fontSize: fontSize.xs, color: colors.textMuted }}>
          {entry.childName ?? "Whole family"}
        </Text>
      ) : null}
      {entry.note ? (
        <Text
          style={{ flex: 1, minWidth: 80, fontFamily: fontFamilies.body, fontSize: fontSize.xs, color: colors.textMuted }}
        >
          {entry.note}
        </Text>
      ) : (
        <View style={{ flex: 1 }} />
      )}
      <View
        style={{
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: radius.pill,
          paddingHorizontal: space.xs,
          paddingVertical: 2,
        }}
      >
        <Text style={{ fontFamily: fontFamilies.bodyBold, fontSize: 10, color: colors.textMuted }}>
          {SOURCE_LABELS[entry.source].toUpperCase()}
        </Text>
      </View>
      {onEdit ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Edit ${SUBJECT_LABELS[entry.subject]} entry, ${formatMinutesAsHours(entry.minutes)}`}
          onPress={onEdit}
          style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: space.xs }}
        >
          <Text style={{ fontFamily: fontFamilies.bodySemibold, fontSize: fontSize.xs, color: colors.textStrong }}>
            Edit
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
