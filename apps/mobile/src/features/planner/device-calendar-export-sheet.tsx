import { CalendarPlus, Check, X } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "../../components/ui/button";
import { emitFamilyEvent } from "../../lib/events";
import { fontFamilies } from "../../theme/fonts";
import { colors, fontSize, radius, space } from "../../theme/tokens";
import {
  calendarExportFingerprint,
  recurrenceLabel,
  type CalendarExportItem,
} from "./device-calendar-export";
import { exportedFingerprints, rememberCalendarExport } from "./device-calendar-ledger";
import { chooseWriteOnlyCalendar, type DeviceCalendarDestination } from "./device-calendar-native";
import {
  outcomeResults,
  saveCalendarExports,
  type CalendarExportResult,
} from "./device-calendar-runner";

type Step = "select" | "preview" | "results";

function iosMajorVersion(): number | null {
  if (Platform.OS !== "ios") return null;
  const parsed = Number.parseInt(String(Platform.Version), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatDate(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, day)),
  );
}

function formatTime(value: string | null): string | null {
  if (!value) return null;
  const [hourString, minute] = value.split(":");
  const hour = Number(hourString);
  const period = hour >= 12 ? "pm" : "am";
  const twelveHour = hour % 12 === 0 ? 12 : hour % 12;
  return minute === "00" ? `${twelveHour}${period}` : `${twelveHour}:${minute}${period}`;
}

function scheduleLabel(item: CalendarExportItem): string {
  if (!item.startTime) {
    return item.startsOn === item.endsOn
      ? `${formatDate(item.startsOn)} · All day`
      : `${formatDate(item.startsOn)} through ${formatDate(item.endsOn)} · All day`;
  }
  const start = formatTime(item.startTime);
  const end = formatTime(item.endTime);
  return `${formatDate(item.startsOn)} · ${start}${end ? ` to ${end}` : ""} · ${item.timeZone}`;
}

function resultColor(outcome: CalendarExportResult["outcome"]): string {
  if (outcome === "saved") return colors.success;
  if (outcome === "failed" || outcome === "denied") return colors.danger;
  return colors.textMuted;
}

export function DeviceCalendarExportSheet({
  visible,
  familyId,
  items,
  onClose,
}: {
  visible: boolean;
  familyId: string;
  items: CalendarExportItem[];
  onClose: () => void;
}) {
  const [step, setStep] = useState<Step>("select");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [duplicates, setDuplicates] = useState<Set<string>>(new Set());
  const [destination, setDestination] = useState<DeviceCalendarDestination | null>(null);
  const [results, setResults] = useState<CalendarExportResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const supportsWriteOnly = iosMajorVersion() !== null && (iosMajorVersion() ?? 0) >= 17;

  const selectedItems = useMemo(
    () => items.filter((item) => selected.has(item.sourceKey)),
    [items, selected],
  );
  const newEventCount = useMemo(
    () => selectedItems.filter((item) => !duplicates.has(calendarExportFingerprint(item))).length,
    [duplicates, selectedItems],
  );

  useEffect(() => {
    if (!visible) return;
    let active = true;
    const fingerprints = items.map(calendarExportFingerprint);
    void exportedFingerprints(familyId, fingerprints)
      .then((next) => {
        if (active) setDuplicates(next);
      })
      .catch(() => {
        if (active) setDuplicates(new Set());
      });
    return () => {
      active = false;
    };
  }, [familyId, items, visible]);

  function toggle(item: CalendarExportItem) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(item.sourceKey)) next.delete(item.sourceKey);
      else next.add(item.sourceKey);
      return next;
    });
  }

  async function chooseCalendar() {
    setBusy(true);
    setMessage(null);
    const choice = await chooseWriteOnlyCalendar();
    setBusy(false);
    if (choice.kind === "ready") {
      setDestination(choice.destination);
      return;
    }
    if (choice.kind === "denied") {
      const nextResults = outcomeResults(selectedItems, "denied", choice.canAskAgain ? "Calendar access was not allowed." : "Calendar access is off in Settings.");
      setResults(nextResults);
      emitFinished(nextResults);
      setStep("results");
      return;
    }
    if (choice.kind === "canceled") {
      const nextResults = outcomeResults(selectedItems, "canceled", "No destination calendar was chosen.");
      setResults(nextResults);
      emitFinished(nextResults);
      setStep("results");
      return;
    }
    setMessage(choice.message);
  }

  async function save() {
    if (!destination) return;
    setBusy(true);
    const nextResults = await saveCalendarExports(
      familyId,
      selectedItems,
      duplicates,
      destination,
      rememberCalendarExport,
    );
    setResults(nextResults);
    emitFinished(nextResults);
    setBusy(false);
    setStep("results");
  }

  function preview() {
    const duplicateCount = selectedItems.filter((item) => duplicates.has(calendarExportFingerprint(item))).length;
    void emitFamilyEvent(familyId, "planner.device_calendar_previewed", {
      family_id: familyId,
      selected_count: selectedItems.length,
      duplicate_count: duplicateCount,
    });
    setStep("preview");
  }

  function emitFinished(nextResults: CalendarExportResult[]) {
    const savedCount = nextResults.filter((result) => result.outcome === "saved").length;
    const duplicateCount = nextResults.filter((result) => result.outcome === "duplicate").length;
    const failedCount = nextResults.filter((result) => result.outcome === "failed").length;
    const outcomes = new Set(nextResults.map((result) => result.outcome));
    const outcome = outcomes.size > 1
      ? "mixed"
      : outcomes.has("saved")
        ? "saved"
        : outcomes.has("duplicate")
          ? "duplicates_only"
          : outcomes.has("denied")
            ? "denied"
            : outcomes.has("canceled")
              ? "canceled"
              : "failed";
    void emitFamilyEvent(familyId, "planner.device_calendar_export_finished", {
      family_id: familyId,
      outcome,
      selected_count: nextResults.length,
      saved_count: savedCount,
      duplicate_count: duplicateCount,
      failed_count: failedCount,
    });
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.page }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: space.md, borderBottomWidth: 1, borderBottomColor: colors.borderSubtle }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
            <CalendarPlus size={20} color={colors.brand} />
            <Text style={{ fontFamily: fontFamilies.display, fontSize: fontSize.lg, color: colors.textStrong }}>
              {step === "select" ? "Choose planner items" : step === "preview" ? "Check before adding" : "Calendar results"}
            </Text>
          </View>
          <Pressable accessibilityLabel="Close calendar export" onPress={onClose} hitSlop={8}>
            <X size={22} color={colors.textSubtle} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ padding: space.md, gap: space.md }}>
          {!supportsWriteOnly ? (
            <View style={{ backgroundColor: colors.card, borderRadius: radius.lg, padding: space.md, gap: space.xs }}>
              <Text style={{ fontFamily: fontFamilies.bodySemibold, fontSize: fontSize.base, color: colors.textStrong }}>
                Your planner is safe.
              </Text>
              <Text style={{ fontFamily: fontFamilies.body, fontSize: fontSize.sm, color: colors.textBody }}>
                Selected calendar export needs iOS 17 or newer so Homa can add events without reading your calendar.
              </Text>
            </View>
          ) : step === "select" ? (
            <>
              <Text style={{ fontFamily: fontFamilies.body, fontSize: fontSize.sm, color: colors.textBody }}>
                Pick only what you want on your phone calendar. Homa will not read anything already there.
              </Text>
              {items.length === 0 ? (
                <Text style={{ fontFamily: fontFamilies.body, fontSize: fontSize.sm, color: colors.textMuted }}>
                  Nothing in this view is ready to export.
                </Text>
              ) : items.map((item) => {
                const active = selected.has(item.sourceKey);
                const duplicate = duplicates.has(calendarExportFingerprint(item));
                return (
                  <Pressable
                    key={item.sourceKey}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: active }}
                    onPress={() => toggle(item)}
                    style={{ flexDirection: "row", gap: space.sm, backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: active ? colors.brand : colors.borderSubtle, padding: space.md }}
                  >
                    <View style={{ width: 22, height: 22, borderRadius: radius.xs, borderWidth: 1.5, borderColor: active ? colors.brand : colors.border, backgroundColor: active ? colors.brand : "transparent", alignItems: "center", justifyContent: "center" }}>
                      {active ? <Check size={14} color={colors.onBrand} /> : null}
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={{ fontFamily: fontFamilies.bodySemibold, fontSize: fontSize.sm, color: colors.textStrong }}>{item.title}</Text>
                      <Text style={{ fontFamily: fontFamilies.body, fontSize: fontSize.xs, color: colors.textMuted }}>{scheduleLabel(item)}</Text>
                      <Text style={{ fontFamily: fontFamilies.body, fontSize: fontSize.xs, color: colors.textSubtle }}>{item.childScope}</Text>
                      {duplicate ? <Text style={{ fontFamily: fontFamilies.bodySemibold, fontSize: fontSize.xs, color: colors.brand }}>Already exported from this device. It will be skipped.</Text> : null}
                    </View>
                  </Pressable>
                );
              })}
              <Button label={`Preview ${selectedItems.length} ${selectedItems.length === 1 ? "event" : "events"}`} disabled={selectedItems.length === 0} onPress={preview} />
            </>
          ) : step === "preview" ? (
            <>
              <View style={{ backgroundColor: colors.sageSoft, borderRadius: radius.md, padding: space.md, gap: 2 }}>
                <Text style={{ fontFamily: fontFamilies.bodySemibold, fontSize: fontSize.sm, color: colors.textStrong }}>Destination calendar</Text>
                <Text style={{ fontFamily: fontFamilies.body, fontSize: fontSize.sm, color: colors.textBody }}>
                  {destination?.title ?? "Not chosen yet. You will choose after this preview."}
                </Text>
              </View>
              {selectedItems.map((item) => {
                const duplicate = duplicates.has(calendarExportFingerprint(item));
                return (
                  <View key={item.sourceKey} style={{ backgroundColor: colors.card, borderRadius: radius.lg, padding: space.md, gap: space.xs }}>
                    <Text style={{ fontFamily: fontFamilies.display, fontSize: fontSize.base, color: colors.textStrong }}>{item.title}</Text>
                    <PreviewLine label="When" value={scheduleLabel(item)} />
                    <PreviewLine label="Repeats" value={recurrenceLabel(item.recurrence)} />
                    <PreviewLine label="For" value={item.childScope} />
                    <PreviewLine label="Notes" value={item.notes?.trim() || "No note"} />
                    {duplicate ? <Text style={{ fontFamily: fontFamilies.bodySemibold, fontSize: fontSize.xs, color: colors.brand }}>Duplicate warning: Homa already exported this exact version from this device. It will not be added again.</Text> : null}
                  </View>
                );
              })}
              {message ? <Text style={{ fontFamily: fontFamilies.body, fontSize: fontSize.sm, color: colors.danger }}>{message}</Text> : null}
              {destination ? (
                <>
                  <Text style={{ fontFamily: fontFamilies.bodySemibold, fontSize: fontSize.sm, color: colors.textStrong, textAlign: "center" }}>
                    You are adding exactly {newEventCount} new {newEventCount === 1 ? "event" : "events"} to {destination.title}.
                  </Text>
                  <Button label={newEventCount === 0 ? "Finish without duplicates" : `Add ${newEventCount} ${newEventCount === 1 ? "event" : "events"}`} disabled={busy} onPress={() => void save()} />
                  <Button label="Choose a different calendar" variant="secondary" disabled={busy} onPress={() => void chooseCalendar()} />
                </>
              ) : (
                <Button label="Choose calendar" disabled={busy} onPress={() => void chooseCalendar()} />
              )}
              <Button label="Back" variant="ghost" disabled={busy} onPress={() => setStep("select")} />
            </>
          ) : (
            <>
              <Text style={{ fontFamily: fontFamilies.body, fontSize: fontSize.sm, color: colors.textBody }}>
                Homa&apos;s planner did not change. Here is what happened on your device.
              </Text>
              {results.map((result) => (
                <View key={result.item.sourceKey} style={{ backgroundColor: colors.card, borderRadius: radius.md, padding: space.md, gap: 2 }}>
                  <Text style={{ fontFamily: fontFamilies.bodySemibold, fontSize: fontSize.sm, color: colors.textStrong }}>{result.item.title}</Text>
                  <Text style={{ fontFamily: fontFamilies.bodySemibold, fontSize: fontSize.xs, color: resultColor(result.outcome), textTransform: "capitalize" }}>{result.outcome}</Text>
                  {result.detail ? <Text style={{ fontFamily: fontFamilies.body, fontSize: fontSize.xs, color: colors.textMuted }}>{result.detail}</Text> : null}
                </View>
              ))}
              <Button label="Done" onPress={onClose} />
            </>
          )}
          {busy ? <ActivityIndicator color={colors.brand} /> : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function PreviewLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: "row", gap: space.sm }}>
      <Text style={{ width: 64, fontFamily: fontFamilies.bodySemibold, fontSize: fontSize.xs, color: colors.textSubtle }}>{label}</Text>
      <Text style={{ flex: 1, fontFamily: fontFamilies.body, fontSize: fontSize.xs, color: colors.textBody }}>{value}</Text>
    </View>
  );
}
