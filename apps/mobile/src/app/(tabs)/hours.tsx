import { Redirect } from "expo-router";
import { Check } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useFamilyData } from "../../features/family/use-family-data";
import { InlineError } from "../../components/ui/inline-error";
import { LoadingStatus } from "../../components/ui/loading-status";
import { EntryEditor } from "../../features/hours/entry-editor";
import { EntryRow } from "../../features/hours/entry-row";
import { TotalsCard } from "../../features/hours/totals-card";
import { useHoursData } from "../../features/hours/use-hours-data";
import {
  computeChildTotals,
  effectiveTimeZone,
  filterEntriesBySubject,
  formatMinutesAsHours,
  groupEntriesByDay,
  subjectOptions,
  SUBJECT_LABELS,
  toHoursEntries,
} from "../../features/hours/hours-view";
import { deleteHoursEntry, updateHoursEntry, type HoursSubject } from "../../lib/hours";
import { fontFamilies } from "../../theme/fonts";
import { colors, fontSize, radius, space } from "../../theme/tokens";

/**
 * Hours: the compliance record, ported from apps/web/app/app/hours/
 * page.tsx + hours-view.tsx. Creating a new entry stays agent-only
 * (log_hours via chat/SMS/voice) on both platforms; editing and
 * deleting an existing one is a real parent-facing feature here too,
 * via direct RLS-scoped writes (hours_log has full insert/update/
 * delete policies for authenticated family members).
 *
 * No state minimum-hours comparison: state_requirements has no hours
 * field yet (web's own issue #174 deferral), so totals render plainly,
 * never a red "behind" state.
 */
export function HoursSurface({ embedded = false }: { embedded?: boolean }) {
  const { family, children, loading: familyLoading } = useFamilyData();
  const { rows, loading: hoursLoading, error, reload } = useHoursData(family?.id ?? null);
  const [subjectFilter, setSubjectFilter] = useState<HoursSubject | null>(null);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);

  const timeZone = effectiveTimeZone(family?.time_zone);
  const now = new Date();
  const entries = useMemo(() => toHoursEntries(rows, children), [rows, children]);
  const subjects = useMemo(() => subjectOptions(entries), [entries]);
  const filtered = useMemo(() => filterEntriesBySubject(entries, subjectFilter), [entries, subjectFilter]);
  const groups = groupEntriesByDay(filtered, timeZone, now);
  const totals = computeChildTotals(filtered, children, now, timeZone);
  const editingEntry = entries.find((entry) => entry.id === editingEntryId) ?? null;
  const loading = familyLoading || hoursLoading;

  async function handleSaveEdit(edit: { subject: HoursSubject; minutes: number; note: string | null }) {
    if (!editingEntryId) {
      throw new Error("hours edit context is unavailable");
    }
    await updateHoursEntry(editingEntryId, edit);
    setEditingEntryId(null);
    await reload();
  }

  async function handleDelete() {
    if (!editingEntryId) {
      throw new Error("hours delete context is unavailable");
    }
    await deleteHoursEntry(editingEntryId);
    setEditingEntryId(null);
    await reload();
  }

  const content = (
    <>
      <ScrollView
        contentContainerStyle={{ padding: space.md, gap: space.md }}
        refreshControl={<RefreshControl refreshing={hoursLoading} onRefresh={() => void reload()} />}
      >
        <View style={{ gap: 2 }}>
          {embedded ? null : (
            <Text
              style={{
                fontFamily: fontFamilies.bodyBold,
                fontSize: 11,
                letterSpacing: 0.4,
                color: colors.textMuted,
                textTransform: "uppercase",
              }}
            >
              The compliance record
            </Text>
          )}
          <Text accessibilityRole="header" style={{ fontFamily: fontFamilies.display, fontSize: fontSize.xxl, color: colors.textStrong }}>
            Hours
          </Text>
          <Text style={{ fontFamily: fontFamilies.body, fontSize: fontSize.sm, color: colors.textMuted }}>
            Every school-time block Homa has heard about, by day.
          </Text>
        </View>

        {loading && rows.length === 0 ? (
          <View style={{ paddingVertical: space.xl, alignItems: "center" }}>
            <LoadingStatus label="Loading school hours" />
          </View>
        ) : null}

        {error ? <InlineError message="That didn't load. Pull down to try again." /> : null}

        {totals.length > 0 ? (
          <View style={{ gap: space.sm }}>
            {totals.map((total) => {
              const kidIndex = children.findIndex((child) => child.id === total.childId);
              return <TotalsCard key={total.childId} total={total} kidIndex={Math.max(0, kidIndex)} />;
            })}
          </View>
        ) : null}

        {subjects.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.xs }}>
            <SubjectChip label="All" active={subjectFilter === null} onPress={() => setSubjectFilter(null)} />
            {subjects.map((subject) => (
              <SubjectChip
                key={subject}
                label={SUBJECT_LABELS[subject]}
                active={subjectFilter === subject}
                onPress={() => setSubjectFilter(subject)}
              />
            ))}
          </ScrollView>
        ) : null}

        {!loading && groups.length === 0 ? (
          <View style={{ paddingVertical: space.xl, alignItems: "center", gap: space.xs }}>
            <Text style={{ fontFamily: fontFamilies.display, fontSize: fontSize.lg, color: colors.textStrong }}>
              Nothing logged yet.
            </Text>
            <Text style={{ fontFamily: fontFamilies.body, fontSize: fontSize.sm, color: colors.textMuted, textAlign: "center" }}>
              {subjectFilter
                ? `Nothing logged for ${SUBJECT_LABELS[subjectFilter].toLowerCase()} yet.`
                : "Tell Homa about school time and it shows up here."}
            </Text>
          </View>
        ) : null}

        {groups.map((group) => (
          <View key={group.key} style={{ gap: space.xs }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
              <Text style={{ fontFamily: fontFamilies.bodySemibold, fontSize: fontSize.sm, color: colors.textBody }}>
                {group.label}
              </Text>
              <Text style={{ fontFamily: fontFamilies.body, fontSize: fontSize.xs, color: colors.textMuted }}>
                {formatMinutesAsHours(group.totalMinutes)}
              </Text>
            </View>
            <View style={{ gap: space.xs }}>
              {group.entries.map((entry) => (
                <EntryRow
                  key={entry.id}
                  entry={entry}
                  showChild={children.length > 1}
                  onEdit={() => setEditingEntryId(entry.id)}
                />
              ))}
            </View>
          </View>
        ))}
      </ScrollView>

      <EntryEditor
        key={editingEntry?.id ?? "editor"}
        entry={editingEntry}
        onSave={handleSaveEdit}
        onDelete={handleDelete}
        onClose={() => setEditingEntryId(null)}
      />
    </>
  );

  if (embedded) {
    return <View style={{ flex: 1, backgroundColor: colors.page }}>{content}</View>;
  }
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.page }} edges={["bottom"]}>
      {content}
    </SafeAreaView>
  );
}

/** Compatibility door for existing deep links. Planner owns Hours now. */
export default function HoursScreen() {
  return <Redirect href="/planner?view=hours" />;
}

function SubjectChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessible
      accessibilityRole="button"
      accessibilityLabel={`Filter school hours by ${label}`}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={{
        minHeight: 44,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: space.xs,
        paddingHorizontal: space.md,
        paddingVertical: space.xs,
        borderRadius: radius.pill,
        backgroundColor: active ? colors.brandSoft : colors.card,
        borderWidth: 1,
        borderColor: active ? colors.brandHover : colors.borderSubtle,
      }}
    >
      {active ? (
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Check size={14} color={colors.textStrong} />
        </View>
      ) : null}
      <Text
        style={{
          fontFamily: fontFamilies.bodyBold,
          fontSize: fontSize.xs,
          color: active ? colors.textStrong : colors.textMuted,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
