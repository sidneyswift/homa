import { useCallback, useEffect, useState } from "react";

import {
  emptyChildProgressView,
  getChildProgressLiveView,
  getChildReport,
  getFamilyTimeZone,
  getTrajectoryEvidence,
  type ChildReportRecord,
} from "../../lib/progress";
import {
  buildTrajectoryEras,
  type TrajectoryEra,
} from "./trajectory-eras";
import type { ChildProgressView } from "./types";

/**
 * Loads one child's Progress data, the mobile twin of what
 * apps/web/app/app/[childId]/progress/page.tsx assembles server-side:
 * the live view (child_progress_live), the permanent report row
 * (child_reports, kept reachable by the agent-led-live-progress
 * ruling), and the re-normalized trajectory eras from the evidence
 * ledger. All reads are RLS-scoped (lib/progress.ts).
 */

export interface ChildProgressIdentity {
  id: string;
  name: string;
  /** "YYYY-MM-DD" (children.birth_month holds the full birthday). */
  birthDate: string;
}

export interface ChildProgressData {
  /** Null only while loading or unavailable. */
  view: ChildProgressView | null;
  /** True when evidence exists but the stored projection could not be
   * read: everything shared is safe server-side, the subject detail
   * just is not renderable from this client. The screen says so instead
   * of pretending nothing was shared. */
  detailPending: boolean;
  report: ChildReportRecord | null;
  /** Oldest first, live last; empty before the first scoring. */
  eras: TrajectoryEra[];
  /** The read instant, so render stays pure: tiles and the chart's
   * today line both measure from the load, not from each re-render. */
  loadedAt: Date;
  loading: boolean;
  /** Set when the reads themselves failed (network, auth). Nothing was
   * changed by a failed read; the screen offers a retry. */
  error: string | null;
  reload: () => Promise<void>;
}

export function useChildProgress(
  child: ChildProgressIdentity | null,
): ChildProgressData {
  const [view, setView] = useState<ChildProgressView | null>(null);
  const [detailPending, setDetailPending] = useState(false);
  const [report, setReport] = useState<ChildReportRecord | null>(null);
  const [eras, setEras] = useState<TrajectoryEra[]>([]);
  const [loadedAt, setLoadedAt] = useState<Date>(() => new Date());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const childId = child?.id ?? null;
  const childName = child?.name ?? null;
  const birthDate = child?.birthDate ?? null;

  const reload = useCallback(async () => {
    if (childId === null || childName === null || birthDate === null) {
      setView(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const now = new Date();
      const [liveView, reportRow, evidence, timeZone] = await Promise.all([
        getChildProgressLiveView(childId, now),
        getChildReport(childId),
        getTrajectoryEvidence(childId),
        getFamilyTimeZone(),
      ]);

      const nextView =
        liveView ??
        emptyChildProgressView({
          childId,
          childName,
          birthDate,
          timeZone,
          now,
        });
      // The chart re-normalizes archived scorings under the current
      // basis wherever the ledger reaches (trajectory-eras); before the
      // first report there is nothing to plot.
      const nextEras = reportRow
        ? buildTrajectoryEras({
            archived: [...reportRow.history].reverse(),
            live: {
              generated_at: reportRow.generatedAt,
              scores: reportRow.scores,
            },
            evidence,
            birthDate,
          })
        : [];

      setView(nextView);
      setDetailPending(liveView === null && evidence.length > 0);
      setReport(reportRow);
      setEras(nextEras);
      setLoadedAt(now);
      setError(null);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Something went wrong.",
      );
    } finally {
      setLoading(false);
    }
  }, [childId, childName, birthDate]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void reload();
    }, 0);
    return () => clearTimeout(timer);
  }, [reload]);

  return {
    view,
    detailPending,
    report,
    eras,
    loadedAt,
    loading,
    error,
    reload,
  };
}
