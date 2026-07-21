import { useRouter } from "expo-router";
import { useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { env } from "../../lib/env";
import { fontFamilies } from "../../theme/fonts";
import { colors, fontSize, palette, radius, space } from "../../theme/tokens";
import {
  buildProgressTiles,
  progressUpdatedLine,
  TILE_DOT_TONES,
  type ProgressTileModel,
} from "./map-model";
import { SubjectDetailSheet } from "./subject-detail";
import { TrajectoryChart, type TrajectorySubjectRow } from "./trajectory-chart";
import { trajectoryHasScaleChange } from "./trajectory-eras";
import { buildTrajectoryStory } from "./trajectory-story";
import {
  useChildProgress,
  type ChildProgressIdentity,
} from "./use-child-progress";
import { progressAssessmentCta, progressEmptyState } from "./view-copy";

/**
 * The live Progress screen body, ported from
 * apps/web/components/progress/progress-view.tsx (with the report
 * snapshot card from apps/web/app/onboarding/r/[token]/report-snapshot.tsx
 * folded in): a bare header with the freshness line and the report
 * door, then ONE subject card (founder ask 2026-07-13), the snapshot
 * chart whose legend rows are the subject-by-subject list. The tile
 * grid renders only when no chart exists yet, so every subject keeps a
 * door either way. Reassurance laws hold everywhere: growth framing
 * only, no red, no "behind", and siblings switch views rather than
 * sitting side by side.
 */

export interface ProgressViewKid {
  id: string;
  name: string;
}

function webUrl(path: string): string {
  return `${env.apiUrl.replace(/\/+$/, "")}${path}`;
}

/** Soft avatar tones cycled by family order (web KidAvatar's pattern);
 * decorative only, never a ranking. */
const AVATAR_TONES = [
  { background: colors.sageSoft, color: palette.sage600 },
  { background: colors.goldSoft, color: palette.goldInk },
  { background: colors.brandSoft, color: palette.clay700 },
  { background: palette.sky100, color: palette.sky500 },
] as const;

function bodyText(color: string = colors.textBody) {
  return {
    fontFamily: fontFamilies.body,
    fontSize: fontSize.base,
    lineHeight: fontSize.base * 1.45,
    color,
  } as const;
}

/** The in-page sibling switcher (web KidSwitcher): switching views is
 * how siblings coexist here, never a side-by-side comparison. */
function KidSwitcher({
  kids,
  currentChildId,
  onSelectChild,
}: {
  kids: ProgressViewKid[];
  currentChildId: string;
  onSelectChild: (childId: string) => void;
}) {
  if (kids.length < 2) return null;
  return (
    <View
      accessibilityLabel="Switch kid"
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        gap: space.sm,
        marginTop: space.md,
      }}
    >
      {kids.map((kid, index) => {
        const current = kid.id === currentChildId;
        const tone = AVATAR_TONES[index % AVATAR_TONES.length];
        return (
          <Pressable
            key={kid.id}
            accessibilityRole="button"
            accessibilityState={{ selected: current }}
            onPress={() => onSelectChild(kid.id)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              borderRadius: radius.pill,
              borderWidth: 1,
              borderColor: current ? colors.brandSoft : colors.borderSubtle,
              backgroundColor: current ? colors.brandSoft : colors.card,
              paddingHorizontal: 12,
              paddingVertical: 6,
            }}
          >
            <View
              style={{
                width: 20,
                height: 20,
                borderRadius: 10,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: tone.background,
              }}
            >
              <Text
                style={{
                  fontFamily: fontFamilies.bodyBold,
                  fontSize: 10,
                  color: tone.color,
                }}
              >
                {kid.name.charAt(0).toUpperCase()}
              </Text>
            </View>
            <Text
              style={{
                fontFamily: current
                  ? fontFamilies.bodyBold
                  : fontFamilies.bodyMedium,
                fontSize: fontSize.sm,
                color: current ? palette.clay700 : colors.textMuted,
              }}
            >
              {kid.name}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Web ProgressEmptyState: an empty state reassures before it informs. */
function EmptyStateCard({
  childName,
  onAskHoma,
}: {
  childName: string;
  onAskHoma: () => void;
}) {
  const copy = progressEmptyState(childName);
  return (
    <Card
      style={{
        backgroundColor: colors.sageSoft,
        borderColor: palette.sage100,
        gap: space.sm,
      }}
    >
      <Text
        style={{
          fontFamily: fontFamilies.displaySemibold,
          fontSize: fontSize.xl,
          color: colors.textStrong,
        }}
      >
        {copy.heading}
      </Text>
      <Text style={bodyText()}>{copy.body}</Text>
      <Button
        label={`Ask HOMA about ${childName}`}
        onPress={onAskHoma}
        style={{ alignSelf: "flex-start", marginTop: space.sm }}
      />
    </Card>
  );
}

/** Web AssessmentCta: never assessed, so offer the first check-in. The
 * check-in itself lives in web onboarding (it writes); mobile links out. */
function AssessmentCtaCard({
  childId,
  childName,
  onAskHoma,
}: {
  childId: string;
  childName: string;
  onAskHoma: () => void;
}) {
  const copy = progressAssessmentCta(childName);
  return (
    <Card
      style={{
        backgroundColor: colors.sageSoft,
        borderColor: palette.sage100,
        gap: space.sm,
      }}
    >
      <Text
        style={{
          fontFamily: fontFamilies.displaySemibold,
          fontSize: fontSize.xl,
          color: colors.textStrong,
        }}
      >
        {copy.heading}
      </Text>
      <Text style={bodyText()}>{copy.body}</Text>
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          alignItems: "center",
          gap: space.md,
          marginTop: space.sm,
        }}
      >
        <Button
          label={copy.cta}
          onPress={() =>
            void Linking.openURL(
              webUrl(`/onboarding?start=${encodeURIComponent(childId)}`),
            )
          }
        />
        <Button
          label={`Ask HOMA about ${childName}`}
          variant="secondary"
          onPress={onAskHoma}
        />
      </View>
    </Card>
  );
}

/** Web ProgressUnavailable: a failed read changed nothing, say so. */
function UnavailableCard({
  childName,
  onRetry,
  onAskHoma,
}: {
  childName: string;
  onRetry: () => void;
  onAskHoma: () => void;
}) {
  return (
    <Card
      style={{
        backgroundColor: colors.sageSoft,
        borderColor: palette.sage100,
        gap: space.sm,
      }}
    >
      <Text
        style={{
          fontFamily: fontFamilies.displaySemibold,
          fontSize: fontSize.xl,
          color: colors.textStrong,
        }}
      >
        {childName}&apos;s progress is still safe
      </Text>
      <Text style={bodyText()}>
        Progress could not load right now. Nothing was changed. You can try
        again or ask HOMA about {childName}.
      </Text>
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: space.sm,
          marginTop: space.sm,
        }}
      >
        <Button label="Try again" variant="secondary" onPress={onRetry} />
        <Button
          label={`Ask HOMA about ${childName}`}
          variant="secondary"
          onPress={onAskHoma}
        />
      </View>
    </Card>
  );
}

/** The no-chart fallback (web ProgressMap): one tile per subject so
 * every subject keeps its door before the first scoring. */
function TileGrid({
  tiles,
  onOpenSubject,
}: {
  tiles: ProgressTileModel[];
  onOpenSubject: (subjectId: string) => void;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 10,
      }}
    >
      {tiles.map((tile) => (
        <Pressable
          key={tile.subjectId}
          accessibilityRole="button"
          onPress={() => onOpenSubject(tile.subjectId)}
          style={({ pressed }) => ({
            flexBasis: "48%",
            flexGrow: 1,
            minHeight: 106,
            borderWidth: 1,
            borderColor: pressed ? palette.clay300 : colors.borderSubtle,
            borderRadius: radius.md,
            backgroundColor: colors.card,
            padding: space.md,
            gap: 6,
          })}
        >
          <Text
            style={{
              fontFamily: fontFamilies.displaySemibold,
              fontSize: fontSize.sm,
              lineHeight: fontSize.sm * 1.3,
              color: colors.textStrong,
            }}
          >
            {tile.displayName}
          </Text>
          {tile.needsConfirm ? (
            <View
              style={{
                alignSelf: "flex-start",
                borderRadius: radius.pill,
                paddingHorizontal: 8,
                paddingVertical: 2,
                backgroundColor: palette.gold100,
              }}
            >
              <Text
                style={{
                  fontFamily: fontFamilies.bodyBold,
                  fontSize: 10,
                  color: palette.goldInk,
                }}
              >
                Please confirm
              </Text>
            </View>
          ) : null}
          <View style={{ flex: 1 }} />
          {tile.badge ? (
            <View
              style={{
                alignSelf: "flex-start",
                borderRadius: radius.pill,
                paddingHorizontal: 10,
                paddingVertical: 4,
                backgroundColor: tile.badge.background,
              }}
            >
              <Text
                style={{
                  fontFamily: fontFamilies.bodyBold,
                  fontSize: fontSize.xs,
                  color: tile.badge.color,
                }}
              >
                {tile.badge.label}
              </Text>
            </View>
          ) : null}
          {tile.freshness ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
              }}
            >
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: TILE_DOT_TONES[tile.freshness.kind],
                }}
              />
              <Text
                style={{
                  fontFamily: fontFamilies.bodyMedium,
                  fontSize: 11,
                  color: colors.textSubtle,
                }}
              >
                {tile.freshness.label}
              </Text>
            </View>
          ) : null}
        </Pressable>
      ))}
    </View>
  );
}

export function ProgressView({
  child,
  kids,
  onSelectChild,
}: {
  child: ChildProgressIdentity;
  kids: ProgressViewKid[];
  onSelectChild: (childId: string) => void;
}) {
  const router = useRouter();
  const {
    view,
    detailPending,
    report,
    eras,
    loadedAt,
    loading,
    error,
    reload,
  } = useChildProgress(child);
  const [openSubjectId, setOpenSubjectId] = useState<string | null>(null);

  const askHoma = () => router.push("/chat");

  if (loading) {
    return (
      <ActivityIndicator
        color={colors.brand}
        style={{ marginTop: space.xl }}
      />
    );
  }
  if (error !== null || view === null) {
    return (
      <UnavailableCard
        childName={child.name}
        onRetry={() => void reload()}
        onAskHoma={askHoma}
      />
    );
  }

  const updatedLine = progressUpdatedLine(view);
  const tiles = buildProgressTiles(view, loadedAt);
  const story = buildTrajectoryStory(eras);
  const showsScaleChange = trajectoryHasScaleChange(eras);
  // Long-month date, matching the web header band ("July 8, 2026").
  const generatedDate = report
    ? new Date(report.generatedAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;
  // The merged card needs a chart with at least one plottable line;
  // before the first scoring the tile grid stays (web hasChart rule).
  const hasChart =
    report !== null && generatedDate !== null && story.subjects.length > 0;

  const doorRows: TrajectorySubjectRow[] = tiles.map((tile) => ({
    subjectId: tile.subjectId,
    displayName: tile.displayName,
    needsConfirm: tile.needsConfirm,
  }));
  const openSubject =
    openSubjectId === null
      ? null
      : (view.subjects.find(
          (subject) => subject.subjectId === openSubjectId,
        ) ?? null);
  const openTile =
    openSubjectId === null
      ? null
      : (tiles.find((tile) => tile.subjectId === openSubjectId) ?? null);

  return (
    <View style={{ gap: space.lg }}>
      <View>
        {updatedLine ? (
          <Text
            style={{
              fontFamily: fontFamilies.bodyBold,
              fontSize: 11,
              letterSpacing: 1.5,
              textTransform: "uppercase",
              color: updatedLine.today ? palette.sage600 : colors.textSubtle,
            }}
          >
            {updatedLine.label}
          </Text>
        ) : null}
        <Text
          style={{
            marginTop: updatedLine ? space.sm : 0,
            fontFamily: fontFamilies.display,
            fontSize: fontSize.xxl,
            lineHeight: fontSize.xxl * 1.1,
            color: colors.textStrong,
          }}
        >
          {view.childName}&apos;s progress
        </Text>
        {report?.token ? (
          // The permanent token report stays reachable from live
          // Progress (agent-led-live-progress ruling); it lives on the
          // web, so mobile links out.
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              void Linking.openURL(
                webUrl(`/onboarding/r/${encodeURIComponent(report.token ?? "")}`),
              )
            }
            style={({ pressed }) => ({
              alignSelf: "flex-start",
              marginTop: space.sm,
              borderWidth: 1,
              borderColor: pressed ? colors.brand : colors.border,
              borderRadius: radius.pill,
              backgroundColor: colors.card,
              paddingHorizontal: space.md,
              paddingVertical: 8,
            })}
          >
            <Text
              style={{
                fontFamily: fontFamilies.bodySemibold,
                fontSize: fontSize.sm,
                color: colors.textStrong,
              }}
            >
              Open the full report
            </Text>
          </Pressable>
        ) : null}
        <KidSwitcher
          kids={kids}
          currentChildId={view.childId}
          onSelectChild={onSelectChild}
        />
      </View>

      {view.subjects.length === 0 ? (
        detailPending ? (
          // Evidence exists server-side but the stored projection was
          // not readable from this client. Never pretend nothing was
          // shared; show the chart when one exists and point at the web
          // detail.
          <View style={{ gap: space.lg }}>
            {hasChart && generatedDate ? (
              <SnapshotCard
                childName={view.childName}
                generatedDate={generatedDate}
                caption={story.caption}
                showsScaleChange={showsScaleChange}
                chart={
                  <TrajectoryChart
                    story={story}
                    childName={view.childName}
                    now={loadedAt.getTime()}
                    doorRows={doorRows}
                    onOpenSubject={setOpenSubjectId}
                  />
                }
              />
            ) : null}
            <Card
              style={{
                backgroundColor: colors.sageSoft,
                borderColor: palette.sage100,
                gap: space.sm,
              }}
            >
              <Text style={bodyText()}>
                Everything you have shared for {view.childName} is safe. The
                subject-by-subject detail could not load in the app this
                time; it is ready on the web.
              </Text>
              <Button
                label="Open progress on the web"
                variant="secondary"
                onPress={() =>
                  void Linking.openURL(
                    webUrl(`/app/${encodeURIComponent(view.childId)}/progress`),
                  )
                }
                style={{ alignSelf: "flex-start" }}
              />
            </Card>
          </View>
        ) : report === null ? (
          // No report and nothing shared: this child has never been
          // assessed, so offer the first check-in rather than the
          // waiting-for-answers empty state (web twin's branch).
          <AssessmentCtaCard
            childId={view.childId}
            childName={view.childName}
            onAskHoma={askHoma}
          />
        ) : (
          <EmptyStateCard childName={view.childName} onAskHoma={askHoma} />
        )
      ) : hasChart && generatedDate ? (
        <SnapshotCard
          childName={view.childName}
          generatedDate={generatedDate}
          caption={story.caption}
          showsScaleChange={showsScaleChange}
          chart={
            <TrajectoryChart
              story={story}
              childName={view.childName}
              now={loadedAt.getTime()}
              doorRows={doorRows}
              onOpenSubject={setOpenSubjectId}
            />
          }
        />
      ) : (
        <View style={{ gap: space.sm }}>
          <Text
            style={{
              fontFamily: fontFamilies.displaySemibold,
              fontSize: fontSize.xl,
              color: colors.textStrong,
            }}
          >
            Subject by subject
          </Text>
          <TileGrid tiles={tiles} onOpenSubject={setOpenSubjectId} />
        </View>
      )}

      {openSubject ? (
        <SubjectDetailSheet
          childId={view.childId}
          subject={openSubject}
          tile={openTile}
          conflicts={view.conflicts}
          timeZone={view.timeZone}
          onClose={() => setOpenSubjectId(null)}
          onAskHoma={() => {
            setOpenSubjectId(null);
            askHoma();
          }}
        />
      ) : null}
    </View>
  );
}

/** The snapshot card (web ReportSnapshot): the chart with a caption the
 * data writes itself, on the sunken surface. */
function SnapshotCard({
  childName,
  generatedDate,
  caption,
  showsScaleChange,
  chart,
}: {
  childName: string;
  generatedDate: string;
  caption: string;
  showsScaleChange: boolean;
  chart: ReactNode;
}) {
  return (
    <View
      style={{
        borderRadius: radius.md,
        backgroundColor: colors.surfaceSunken,
        padding: space.md,
        gap: space.sm,
      }}
    >
      <Text
        style={{
          fontFamily: fontFamilies.bodyBold,
          fontSize: 10,
          letterSpacing: 1.5,
          textTransform: "uppercase",
          color: colors.textSubtle,
        }}
      >
        {childName}&apos;s snapshot {"·"} {generatedDate}
      </Text>
      {caption ? (
        <Text
          style={{
            fontFamily: fontFamilies.body,
            fontSize: fontSize.sm,
            lineHeight: fontSize.sm * 1.4,
            color: colors.textMuted,
          }}
        >
          {caption}
        </Text>
      ) : null}
      {chart}
      {showsScaleChange ? (
        <Text
          style={{
            fontFamily: fontFamilies.body,
            fontSize: fontSize.xs,
            lineHeight: fontSize.xs * 1.4,
            color: colors.textMuted,
          }}
        >
          A dotted stretch means we improved how we measure, not that{" "}
          {childName} changed. Every number you see now is measured the new
          way.
        </Text>
      ) : null}
    </View>
  );
}

/** Scrollable page frame shared by the tab and the stack route. */
export function ProgressPageScroll({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg }}>
      {children}
    </ScrollView>
  );
}
