import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Linking, Pressable, Text, View } from "react-native";

import { Button } from "../../components/ui/button";
import { Icon } from "../../components/design/icon";
import { LoadingStatus } from "../../components/ui/loading-status";
import { useAccessibilityAnnouncement } from "../../lib/accessibility";
import {
  fetchStateRecords,
  generateStateRecord,
  type StateRecordAction,
  type StateRecordDocument,
  type StateRecordsSummary,
} from "../../lib/state-records";
import { colors, fontFamilies, fontSize, radius, shadows, space } from "../../theme/app2";

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${iso.slice(0, 10)}T12:00:00Z`));
}

function latest(
  documents: readonly StateRecordDocument[],
  type: StateRecordDocument["type"],
): StateRecordDocument | null {
  return documents.find((document) => document.type === type && document.status === "final") ?? null;
}

export function StateRecordsCard({
  action = "view",
  onOpenDocument,
  onReady,
}: {
  action?: StateRecordAction;
  onOpenDocument: (document: StateRecordDocument) => void;
  onReady?: (message: string) => void;
}) {
  const router = useRouter();
  const [summary, setSummary] = useState<StateRecordsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<StateRecordAction | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [resolution, setResolution] = useState<"settings" | "retry" | null>(null);
  const actedRef = useRef(false);
  useAccessibilityAnnouncement(note);

  const load = useCallback(async () => {
    const result = await fetchStateRecords();
    setSummary(result.summary);
    setNote(result.note);
    setResolution(result.resolution);
    setLoading(false);
    return result.summary;
  }, []);

  const make = useCallback(async (
    nextAction: Exclude<StateRecordAction, "view">,
  ) => {
    setWorking(nextAction);
    setNote(null);
    const failure = await generateStateRecord(nextAction);
    if (failure) {
      setNote(failure);
      onReady?.(failure);
      setWorking(null);
      return;
    }
    const refreshed = await load();
    const type = nextAction === "generate_pack" ? "pack" : "filing";
    const made = refreshed ? latest(refreshed.documents, type) : null;
    const message = made
      ? `${made.title} is ready to review. Nothing was filed or sent.`
      : "Your document is ready in the Binder.";
    onReady?.(message);
    setWorking(null);
  }, [load, onReady]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    if (loading || !summary || action === "view" || actedRef.current) return;
    if (action === "generate_filing" && !summary.filing.entitled) {
      actedRef.current = true;
      return;
    }
    actedRef.current = true;
    const timer = setTimeout(() => {
      void make(action);
    }, 0);
    return () => clearTimeout(timer);
  }, [action, loading, make, summary]);

  const currentPack = useMemo(
    () => summary ? latest(summary.documents, "pack") : null,
    [summary],
  );
  const currentFiling = useMemo(
    () => summary ? latest(summary.documents, "filing") : null,
    [summary],
  );
  const older = summary?.documents.filter((document) => document.status === "superseded") ?? [];

  return (
    <View
      style={{
        padding: space.md,
        gap: space.md,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.borderSubtle,
        backgroundColor: colors.card,
        ...shadows.sm,
      }}
    >
      <View style={{ gap: 3 }}>
        <Text accessibilityRole="header" style={{ fontFamily: fontFamilies.displaySemibold, fontSize: fontSize.xl, color: colors.textStrong }}>
          State records
        </Text>
        <Text style={{ fontFamily: fontFamilies.body, fontSize: fontSize.sm, color: colors.textMuted }}>
          The packet explains your state’s rules and includes blank record pages. The school time you logged stays separate beside it.
        </Text>
      </View>

      {loading ? <LoadingStatus label="Loading state records" /> : null}
      {note ? <Text style={{ fontFamily: fontFamilies.body, fontSize: fontSize.sm, color: colors.textBody }}>{note}</Text> : null}
      {!loading && !summary && resolution ? (
        <Button
          label={resolution === "settings" ? "Open settings" : "Try loading again"}
          variant="secondary"
          onPress={() => {
            if (resolution === "settings") router.push("/settings");
            else void load();
          }}
        />
      ) : null}

      {summary ? (
        <>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.md }}>
            <Fact label="State" value={`${summary.state.name} (${summary.state.code})`} />
            <Fact label="School year" value={summary.schoolYear.label ?? "Start date needed"} />
            <Fact label="Sources checked" value={formatDate(summary.lastVerified)} />
          </View>

          <View style={{ padding: space.sm, borderRadius: radius.sm, backgroundColor: colors.sageSoft, gap: 3 }}>
            <Text style={{ fontFamily: fontFamilies.bodyBold, fontSize: fontSize.sm, color: colors.textStrong }}>
              Your record so far
            </Text>
            <Text style={{ fontFamily: fontFamilies.body, fontSize: fontSize.sm, color: colors.textBody }}>
              {summary.recordCoverage.daysWithLoggedTime} days with logged school time · {summary.recordCoverage.loggedEntries} time entries · {Math.round(summary.recordCoverage.minutesLogged / 60)} hours
            </Text>
            <Text style={{ fontFamily: fontFamilies.body, fontSize: fontSize.xs, color: colors.textMuted }}>
              These totals come from the school time you logged with Homa. The packet PDF keeps its attendance and time pages blank for you to review and complete.
            </Text>
          </View>

          <Section label="Included in the packet" items={summary.includedRecords} />
          <Section
            label="Missing information"
            items={summary.missingInformation.length > 0 ? summary.missingInformation : ["No missing information"]}
            calm={summary.missingInformation.length === 0}
          />
          {summary.missingInformation.length > 0 ? (
            <Button
              label="Add missing information"
              variant="secondary"
              onPress={() => router.push("/settings")}
            />
          ) : null}

          <View style={{ gap: space.xs }}>
            <Text style={{ fontFamily: fontFamilies.bodyBold, fontSize: fontSize.sm, color: colors.textStrong }}>Current documents</Text>
            {currentPack ? (
              <DocumentRow document={currentPack} onOpen={() => onOpenDocument(currentPack)} />
            ) : (
              <Text style={{ fontFamily: fontFamilies.body, fontSize: fontSize.sm, color: colors.textMuted }}>No packet yet. Make one when you’re ready.</Text>
            )}
            {currentFiling ? <DocumentRow document={currentFiling} onOpen={() => onOpenDocument(currentFiling)} /> : null}
          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
            <Button
              label={working === "generate_pack" ? "Making packet…" : currentPack ? "Make a fresh packet" : "Make my packet"}
              disabled={working !== null}
              onPress={() => void make("generate_pack")}
            />
            {summary.filing.kind !== "not_required" && summary.filing.entitled ? (
              <Button
                label={working === "generate_filing" ? "Making document…" : currentFiling ? "Make a fresh filing document" : "Prepare filing document"}
                variant="secondary"
                disabled={working !== null}
                onPress={() => void make("generate_filing")}
              />
            ) : null}
          </View>

          <Text style={{ fontFamily: fontFamilies.bodyMedium, fontSize: fontSize.sm, color: colors.textBody }}>
            {summary.parentAction}
          </Text>

          <View style={{ gap: space.xs }}>
            <Text style={{ fontFamily: fontFamilies.bodyBold, fontSize: fontSize.sm, color: colors.textStrong }}>Sources</Text>
            {summary.sources.map((source) => (
              <Pressable
                key={source.url}
                accessibilityRole="link"
                accessibilityLabel={`Open source ${source.label}`}
                accessibilityHint="Opens outside Homa"
                onPress={() => void Linking.openURL(source.url)}
                style={{ minHeight: 44, flexDirection: "row", gap: space.xs, alignItems: "center" }}
              >
                <Icon name="external" size={16} color={colors.brand} />
                <Text style={{ fontFamily: fontFamilies.bodyMedium, fontSize: fontSize.sm, color: colors.textStrong }}>{source.label}</Text>
              </Pressable>
            ))}
          </View>

          {older.length > 0 ? (
            <View style={{ gap: space.xs }}>
              <Text style={{ fontFamily: fontFamilies.bodyBold, fontSize: fontSize.sm, color: colors.textStrong }}>Earlier copies</Text>
              {older.map((document) => (
                <DocumentRow key={document.id} document={document} onOpen={() => onOpenDocument(document)} />
              ))}
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ minWidth: 105, flexGrow: 1 }}>
      <Text style={{ fontFamily: fontFamilies.bodyBold, fontSize: 10, letterSpacing: 0.4, textTransform: "uppercase", color: colors.textMuted }}>{label}</Text>
      <Text style={{ marginTop: 2, fontFamily: fontFamilies.bodyMedium, fontSize: fontSize.sm, color: colors.textBody }}>{value}</Text>
    </View>
  );
}

function Section({ label, items, calm = false }: { label: string; items: readonly string[]; calm?: boolean }) {
  return (
    <View style={{ gap: 3 }}>
      <Text style={{ fontFamily: fontFamilies.bodyBold, fontSize: fontSize.sm, color: colors.textStrong }}>{label}</Text>
      {items.map((item) => (
        <Text key={item} style={{ fontFamily: fontFamilies.body, fontSize: fontSize.sm, color: calm ? colors.success : colors.textBody }}>
          {calm ? "✓" : "•"} {item}
        </Text>
      ))}
    </View>
  );
}

function DocumentRow({ document, onOpen }: { document: StateRecordDocument; onOpen: () => void }) {
  return (
    <View style={{ padding: space.sm, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, gap: space.xs }}>
      <Text style={{ fontFamily: fontFamilies.bodySemibold, fontSize: fontSize.sm, color: colors.textStrong }}>{document.title}</Text>
      <Text style={{ fontFamily: fontFamilies.body, fontSize: fontSize.xs, color: colors.textMuted }}>
        {document.status === "final" ? "Current" : "Earlier copy"} · {document.pageCount} {document.pageCount === 1 ? "page" : "pages"} · Made {formatDate(document.createdAt)}
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
        <Pressable
          onPress={onOpen}
          accessibilityRole="button"
          accessibilityLabel={`Preview, print, or share ${document.title}`}
          style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: space.xs }}
        >
          <Text style={{ fontFamily: fontFamilies.bodySemibold, fontSize: fontSize.sm, color: colors.textStrong }}>Preview, print, or share</Text>
        </Pressable>
        <Pressable
          onPress={() => void Linking.openURL(document.pdfUrl)}
          accessibilityRole="link"
          accessibilityLabel={`Open PDF for ${document.title}`}
          accessibilityHint="Opens outside Homa"
          style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: space.xs }}
        >
          <Text style={{ fontFamily: fontFamilies.bodySemibold, fontSize: fontSize.sm, color: colors.textStrong }}>Open PDF</Text>
        </Pressable>
      </View>
    </View>
  );
}
