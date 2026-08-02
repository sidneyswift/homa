import { X } from "lucide-react-native";
import { useRef, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AccessibleModal } from "../../components/ui/accessible-modal";
import { Button } from "../../components/ui/button";
import { IconButton } from "../../components/ui/icon-button";
import { InlineError } from "../../components/ui/inline-error";
import { reportCrash } from "../../lib/crash-reporting";
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
  onSave: (edit: { subject: HoursSubject; minutes: number; note: string | null }) => Promise<void>;
  onDelete: () => Promise<void>;
  onClose: () => void;
}) {
  const headingRef = useRef<View>(null);
  const [subject, setSubject] = useState<HoursSubject>(entry?.subject ?? "other");
  const [minutesText, setMinutesText] = useState(entry ? String(entry.minutes) : "");
  const [note, setNote] = useState(entry?.note ?? "");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [pendingAction, setPendingAction] = useState<"save" | "delete" | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);

  const minutes = Number(minutesText);
  const minutesValid = Number.isInteger(minutes) && minutes >= 1 && minutes <= 600;
  const busy = pendingAction !== null;

  async function handleSave() {
    if (!minutesValid || busy) return;
    setMutationError(null);
    setPendingAction("save");
    try {
      await onSave({ subject, minutes, note: note.trim() || null });
    } catch (cause) {
      reportCrash(cause, { surface: "native-hours", operation: "save-entry" });
      setMutationError(
        "Your changes are still here. Homa couldn't confirm they saved. Check your connection and try again.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  async function handleDelete() {
    if (busy) return;
    setMutationError(null);
    setPendingAction("delete");
    try {
      await onDelete();
    } catch (cause) {
      reportCrash(cause, { surface: "native-hours", operation: "delete-entry" });
      setMutationError(
        "Homa couldn't confirm the deletion. Close and refresh before trying again.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <AccessibleModal
      visible={entry !== null}
      title="Edit hours entry"
      initialFocusRef={headingRef}
      onRequestClose={busy ? () => undefined : onClose}
      presentationStyle="pageSheet"
    >
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
          <View ref={headingRef} accessible accessibilityRole="header" accessibilityLabel="Edit hours entry" style={{ flex: 1 }}>
            <Text style={{ fontFamily: fontFamilies.display, fontSize: fontSize.lg, color: colors.textStrong }}>
              Edit entry
            </Text>
          </View>
          <IconButton
            label="Close hours editor"
            accessibilityState={{ disabled: busy }}
            disabled={busy}
            onPress={onClose}
          >
            <X size={22} color={colors.textSubtle} />
          </IconButton>
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
                    accessibilityRole="radio"
                    accessibilityState={{ checked: active, disabled: busy }}
                    accessibilityLabel={SUBJECT_LABELS[option]}
                    disabled={busy}
                    onPress={() => setSubject(option)}
                    style={{
                      paddingHorizontal: space.md,
                      minHeight: 44,
                      justifyContent: "center",
                      paddingVertical: space.xs,
                      borderRadius: radius.pill,
                      backgroundColor: active ? colors.brandHover : colors.card,
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
              accessibilityLabel="Minutes"
              accessibilityState={{ disabled: busy }}
              editable={!busy}
              value={minutesText}
              onChangeText={setMinutesText}
              keyboardType="number-pad"
              placeholder="1–600"
              placeholderTextColor={colors.textMuted}
              style={{
                fontFamily: fontFamilies.body,
                fontSize: fontSize.base,
                color: colors.textBody,
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: radius.sm,
                minHeight: 48,
                padding: space.sm,
              }}
            />
          </View>

          <View style={{ gap: space.xs }}>
            <Text style={{ fontFamily: fontFamilies.bodySemibold, fontSize: fontSize.sm, color: colors.textBody }}>
              Note
            </Text>
            <TextInput
              accessibilityLabel="Note"
              accessibilityState={{ disabled: busy }}
              editable={!busy}
              value={note}
              onChangeText={setNote}
              placeholder="Optional"
              placeholderTextColor={colors.textMuted}
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

          {mutationError ? <InlineError message={mutationError} /> : null}

          <Button
            label={pendingAction === "save" ? "Saving…" : "Save changes"}
            disabled={!minutesValid || busy}
            busy={pendingAction === "save"}
            onPress={() => void handleSave()}
          />

          <View style={{ borderTopWidth: 1, borderTopColor: colors.borderSubtle, paddingTop: space.sm }}>
            {confirmingDelete ? (
              <View style={{ gap: space.sm }}>
                <Text style={{ fontFamily: fontFamilies.bodySemibold, fontSize: fontSize.xs, color: colors.textMuted }}>
                  {entry
                    ? `Delete this ${entry.minutes}-minute ${SUBJECT_LABELS[entry.subject].toLowerCase()} block? This can't be undone.`
                    : ""}
                </Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
                  <View style={{ flex: 1, minWidth: 128 }}>
                    <Button
                      label="Cancel"
                      variant="secondary"
                      disabled={busy}
                      onPress={() => setConfirmingDelete(false)}
                    />
                  </View>
                  <View style={{ flex: 1, minWidth: 128 }}>
                    <Button
                      label={pendingAction === "delete" ? "Deleting…" : "Delete"}
                      onPress={() => void handleDelete()}
                      disabled={busy}
                      busy={pendingAction === "delete"}
                    />
                  </View>
                </View>
              </View>
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Delete this hours entry"
                accessibilityState={{ disabled: busy }}
                disabled={busy}
                onPress={() => setConfirmingDelete(true)}
                style={{ minHeight: 44, justifyContent: "center" }}
              >
                <Text style={{ fontFamily: fontFamilies.bodySemibold, fontSize: fontSize.xs, color: colors.textMuted }}>
                  Delete this entry
                </Text>
              </Pressable>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </AccessibleModal>
  );
}
