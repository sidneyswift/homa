import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { adminDb } from "../../../../../../lib/admin/db";
import { requireFounder } from "../../../../../../lib/admin/gate";
import { narrativeEnabled } from "../../../../../../lib/map/narrative-flag";
import { getStateRequirements } from "../../../../../../lib/map/state-requirements";
import { getReportByToken } from "../../../../../../lib/map/store";
import { EmptyNote } from "../../../../ui";
import { ReportView } from "../../../../../onboarding/r/[token]/report-view";
import { isUuid } from "../../family-shell";

/**
 * The report mirror (founder ask 2026-07-14: "how can I view the
 * report"): one kid's real report rendered through the family's own
 * ReportView, founder-gated and read-only by construction. Loaded with
 * stampFirstView false and rendered with mirror, so a founder look
 * never forges her viewed receipt, never fires the view beacon, and
 * offers none of her doors (corrections, plans, calls, flow CTAs).
 */

export const metadata: Metadata = { title: "Report mirror" };

export default async function AdminChildReportMirrorPage({
  params,
}: {
  params: Promise<{ familyId: string; childId: string }>;
}) {
  await requireFounder();
  const { familyId, childId } = await params;
  if (!isUuid(familyId) || !isUuid(childId)) notFound();

  const sql = adminDb();
  const rows = await sql<
    { token: string | null; child_name: string; parent_name: string | null }[]
  >`
    select r.token, c.name as child_name, f.parent_display_name as parent_name
    from public.children c
    join public.families f on f.id = c.family_id
    left join public.child_reports r on r.child_id = c.id and r.revoked_at is null
    where c.id = ${childId} and c.family_id = ${familyId}
      and coalesce(f.status, 'open') <> 'deleted'
  `;
  const row = rows[0];
  if (!row) notFound();

  const backLink = (
    <Link
      href={`/admin/families/${familyId}`}
      className="text-sm font-semibold text-[var(--clay-600)] hover:underline"
    >
      Back to the family file
    </Link>
  );

  if (!row.token) {
    return (
      <div>
        {backLink}
        <EmptyNote>
          {row.child_name} has no report yet; the kid row on the family file shows how far the
          questions got.
        </EmptyNote>
      </div>
    );
  }

  const report = await getReportByToken(row.token, { stampFirstView: false });
  if (!report) notFound();

  const flagOn = narrativeEnabled();
  const meta = report.narrativeMeta;
  const ready = meta?.status === "ready" && report.narrative !== null;
  const narrativeView =
    flagOn && ready && report.narrative
      ? { narrative: report.narrative, rejectedPieces: meta?.rejectedPieces ?? [] }
      : null;
  const stateRequirements = report.usState
    ? await getStateRequirements(report.usState).catch(() => null)
    : null;

  return (
    <div>
      {backLink}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[var(--radius-lg)] bg-[var(--pop-navy)] px-4 py-2.5 text-sm text-white">
        <p>
          {report.childName}&apos;s report as {row.parent_name ?? "the family"} sees it ·
          read-only · her opened receipt stays untouched
        </p>
        {flagOn && !ready ? (
          <p className="font-mono text-xs text-white/80">
            {meta?.status === "failed"
              ? "narrative failed · template sentences shown"
              : "narrative still writing · template sentences meanwhile"}
          </p>
        ) : null}
      </div>
      <div className="overflow-hidden rounded-b-[var(--radius-lg)]">
        <ReportView
          data={report}
          mirror
          narrativeView={narrativeView}
          stateRequirements={stateRequirements}
        />
      </div>
    </div>
  );
}
