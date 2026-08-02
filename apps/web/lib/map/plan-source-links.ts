import type { FourWeekPlan } from "@homa/core";

import {
  MAX_FAMILY_ASSET_REFERENCES,
  parseFamilyAssetReferenceSnapshots,
  type FamilyAssetReferenceSnapshot,
} from "../library/family-asset-reference";
import type { DashboardPlan } from "../plan-week";
import type { PlanEdit } from "./plan-edits";

export interface StoredPlanSourceLink {
  assetId: string;
  week: number;
  activityIndex: number;
  activityText: string;
  sourceTitle: string;
  sourceLocator: string | null;
}

export interface CanonicalPlanSource {
  id: string;
  title: string;
}

export type PlanSourceLinkWrite = StoredPlanSourceLink;

interface SourcedActivity {
  text: string;
  sources: Array<{
    assetId: string;
    sourceTitle: string;
    sourceLocator: string | null;
  }>;
}

function sourcesForIds(
  ids: readonly string[] | undefined,
  catalog: ReadonlyMap<string, string>,
): SourcedActivity["sources"] {
  if (!ids) return [];
  return [...new Set(ids)].flatMap((id) => {
    const title = catalog.get(id);
    return title
      ? [{ assetId: id, sourceTitle: title, sourceLocator: null }]
      : [];
  });
}

/**
 * Replays a validated edit batch against activity plus source pairs. Existing
 * rows survive only when their text fingerprint still matches the original
 * plan. The caller deletes and reinserts every returned touched week inside
 * the same transaction as the plan write.
 */
export function planSourceLinksAfterEdits(input: {
  plan: FourWeekPlan;
  existing: readonly StoredPlanSourceLink[];
  edits: readonly PlanEdit[];
  canonicalSources: readonly CanonicalPlanSource[];
}): PlanSourceLinkWrite[] {
  const byWeek = new Map<number, SourcedActivity[]>();
  for (const week of input.plan.weeks) {
    byWeek.set(
      week.week,
      week.activities.map((text) => ({ text, sources: [] })),
    );
  }
  for (const link of input.existing) {
    const activity = byWeek.get(link.week)?.[link.activityIndex];
    if (!activity || activity.text !== link.activityText) continue;
    if (activity.sources.some((source) => source.assetId === link.assetId)) {
      continue;
    }
    if (activity.sources.length >= MAX_FAMILY_ASSET_REFERENCES) continue;
    activity.sources.push({
      assetId: link.assetId,
      sourceTitle: link.sourceTitle,
      sourceLocator: link.sourceLocator,
    });
  }

  const catalog = new Map(
    input.canonicalSources.map((source) => [source.id, source.title]),
  );
  const touchedWeeks = new Set<number>();
  for (const edit of input.edits) {
    const activities = byWeek.get(edit.week);
    if (!activities) continue;
    touchedWeeks.add(edit.week);
    if (edit.action === "add") {
      activities.push({
        text: edit.text,
        sources: sourcesForIds(edit.sourceFamilyAssetIds, catalog),
      });
      continue;
    }
    if (edit.action === "replace") {
      if (!activities[edit.index]) continue;
      activities[edit.index] = {
        text: edit.text,
        sources: sourcesForIds(edit.sourceFamilyAssetIds, catalog),
      };
      continue;
    }
    activities.splice(edit.index, 1);
  }

  return [...touchedWeeks]
    .sort((left, right) => left - right)
    .flatMap((week) =>
      (byWeek.get(week) ?? []).flatMap((activity, activityIndex) =>
        activity.sources.map((source) => ({
          ...source,
          week,
          activityIndex,
          activityText: activity.text,
        })),
      ),
    );
}

export interface PlanSourceDisplayRow {
  child_id: string;
  subject_id: string;
  week: number;
  activity_index: number;
  activity_text: string;
  asset_id: string;
  source_title: string;
}

/** Attaches only exact-text source rows to their current activity. */
export function attachPlanSourceRows(
  plans: readonly DashboardPlan[],
  rows: readonly PlanSourceDisplayRow[],
): DashboardPlan[] {
  const next = plans.map((plan) => ({
    ...plan,
    activitySources: { ...plan.activitySources },
  }));
  const byPlan = new Map(
    next.map((plan) => [`${plan.childId}:${plan.subjectId}`, plan]),
  );
  for (const row of rows) {
    const plan = byPlan.get(`${row.child_id}:${row.subject_id}`);
    if (!plan) continue;
    const week = plan.weeks.find((candidate) => candidate.week === row.week);
    if (week?.activities[row.activity_index] !== row.activity_text) continue;
    const key = `${row.week}.${row.activity_index}`;
    const sources = parseFamilyAssetReferenceSnapshots([
      ...(plan.activitySources[key] ?? []),
      { id: row.asset_id, title: row.source_title },
    ]);
    plan.activitySources[key] = sources;
  }
  return next;
}

export function planActivitySourceSnapshots(
  plan: Pick<DashboardPlan, "activitySources">,
  week: number,
  activityIndex: number,
): FamilyAssetReferenceSnapshot[] {
  return plan.activitySources[`${week}.${activityIndex}`] ?? [];
}
