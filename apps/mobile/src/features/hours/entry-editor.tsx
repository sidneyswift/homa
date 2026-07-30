import { X } from "lucide-react-native";
import { useState } from "react";
import { Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "../../components/ui/button";
import { HOURS_SUBJECTS, type HoursSubject } from "../../lib/hours";
import { fontFamilies } from "../../theme/fonts";
import { colors, fontSize, radius, space } from "../../theme/tokens";
import type { HoursEntry } from "./hours-view";
import { SUBJECT_LABELS } from "./hours-view";

/**
 * Edit subject/minutes/note, or delete, ported from apps/web/app/app/
 * hours/hours-entry-overlay.tsx. Creating a new entry has no UI here
 * either, matching web: log_hours (chat/SMS/voice) is the only writer
 * of new rows on either platform.
 *
 * The caller must render this with `key={entry?.id ?? "editor"}`: the
 * subject/minutes/note fields are only seeded from `entry` on mount, so
 * without a key forcing a remount, editing a second entry after the
 * first would keep showing the first entry's stale field values.
 */
export function EntryEditor({
  entry,
  onSave,
  onDelete,
  onClose,
}: {
  entry: HoursEntry | null;
  onSave: (edit: { subject: HoursSubject; minutes: number; note: string | null }) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [subject, setSubject] = useState<HoursSubject>(entry?.subject ?? "other");
  const [minutesText, setMinutesText] = useState(entry ? String(entry.minutes) : "");
  const [note, setNote] = useState(entry?.note ?? "");
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const minutes = Number(minutesText);
  const minutesValid = Number.isInteger(minutes) && minutes >= 1 && minutes <= 600;

  return (
    <Modal visible={entry !== null} animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet">
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.page }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            padding: space.md,
            borderBottomWidth: 1,
            borderBottomColor: colors.borderSubtle,
          }}
        >
          <Text style={{ fontFamily: fontFamilies.display, fontSize: fontSize.lg, color: colors.textStrong }}>
            Edit entry
          </Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <X size={22} color={colors.textSubtle} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ padding: space.md, gap: space.md }}>
          <View style={{ gap: space.xs }}>
            <Text style={{ fontFamily: fontFamilies.bodySemibold, fontSize: fontSize.sm, color: colors.textBody }}>
              Subject
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.xs }}>
              {HOURS_SUBJECTS.map((option) => {
                const active = option === subject;
                return (
                  <Pressable
                    key={option}
                    onPress={() => setSubject(option)}
                    style={{
                      paddingHorizontal: space.md,
                      paddingVertical: space.xs,
                      borderRadius: radius.pill,
                      backgroundColor: active ? colors.brand : colors.card,
                      borderWidth: 1,
                      borderColor: active ? colors.brand : colors.borderSubtle,
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: fontFamilies.bodyMedium,
                        fontSize: fontSize.sm,
                        color: active ? colors.onBrand : colors.textBody,
                      }}
                    >
                      {SUBJECT_LABELS[option]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={{ gap: space.xs }}>
            <Text style={{ fontFamily: fontFamilies.bodySemibold, fontSize: fontSize.sm, color: colors.textBody }}>
              Minutes
            </Text>
            <TextInput
              value={minutesText}
              onChangeText={setMinutesText}
              keyboardType="number-pad"
              placeholder="1–600"
              placeholderTextColor={colors.textSubtle}
              style={{
                fontFamily: fontFamilies.body,
                fontSize: fontSize.base,
                color: colors.textBody,
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: radius.sm,
                padding: space.sm,
              }}
            />
          </View>

          <View style={{ gap: space.xs }}>
            <Text style={{ fontFamily: fontFamilies.bodySemibold, fontSize: fontSize.sm, color: colors.textBody }}>
              Note
            </Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Optional"
              placeholderTextColor={colors.textSubtle}
              multiline
              maxLength={200}
              style={{
                fontFamily: fontFamilies.body,
                fontSize: fontSize.sm,
                color: colors.textBody,
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: radius.sm,
                padding: space.sm,
                minHeight: 72,
                textAlignVertical: "top",
              }}
            />
          </View>

          <Button
            label="Save changes"
            disabled={!minutesValid}
            onPress={() => onSave({ subject, minutes, note: note.trim() || null })}
          />

          <View style={{ borderTopWidth: 1, borderTopColor: colors.borderSubtle, paddingTop: space.sm }}>
            {confirmingDelete ? (
              <View style={{ gap: space.sm }}>
                <Text style={{ fontFamily: fontFamilies.bodySemibold, fontSize: fontSize.xs, color: colors.textMuted }}>
                  {entry
                    ? `Delete this ${entry.minutes}-minute ${SUBJECT_LABELS[entry.subject].toLowerCase()} block? This can't be undone.`
                    : ""}
                </Text>
                <View style={{ flexDirection: "row", gap: space.sm }}>
                  <View style={{ flex: 1 }}>
                    <Button label="Cancel" variant="secondary" onPress={() => setConfirmingDelete(false)} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button label="Delete" onPress={onDelete} />
                  </View>
                </View>
              </View>
            ) : (
              <Pressable onPress={() => setConfirmingDelete(true)}>
                <Text style={{ fontFamily: fontFamilies.bodySemibold, fontSize: fontSize.xs, color: colors.textMuted }}>
                  Delete this entry
                </Text>
              </Pressable>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
