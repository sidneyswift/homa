import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ReportSnapshot } from "../../../../onboarding/r/[token]/report-snapshot";
import { ProgressMap } from "../../../../../components/progress/progress-map";
import { ProgressSubjects } from "../../../../../components/progress/progress-subjects";
import type { SubjectDoorRow } from "../../../../../components/progress/subject-door-context";
import { getFamilyProgressDeep } from "../../../../../lib/admin/family-deep-data";
import { requireFounder } from "../../../../../lib/admin/gate";
import { timeAgo } from "../../../../../lib/admin/format";
import { buildProgressTiles } from "../../../../../lib/child-progress/map-model";
import { buildTrajectoryStory } from "../../../../../lib/map/trajectory-story";
import { EmptyNote, SectionHead } from "../../../ui";
import { FamilyShell, isUuid } from "../family-shell";

/**
 * The family file's Progress chapter: per kid, the same merged surface
 * the family sees. The snapshot chart's legend rows are the subject
 * list and each row opens the subject's detail panel (the app's
 * ProgressSubjects host over the real ReportSnapshot); before the
 * first scoring the app's tile grid keeps every subject's door. The
 * retired subject-card grid is gone here too (founder ask 2026-07-14).
 * Conflicts pass as an empty list, so the panel shows the conflict
 * state but offers the founder no resolve buttons: a founder look
 * never settles a family's conflict.
 */

export const metadata: Metadata = { title: "Family progress" };

export default async function AdminFamilyProgressPage({
  params,
}: {
  params: Promise<{ familyId: string }>;
}) {
  await requireFounder();
  const { familyId } = await params;
  if (!isUuid(familyId)) notFound();
  const kids = await getFamilyProgressDeep(familyId);
  const now = new Date();

  return (
    <FamilyShell
      familyId={familyId}
      title="· Progress"
      sub="The same chart and subject panels the family sees, with the evidence behind them."
    >
      {() => (
        <div>
          {kids.length === 0 ? <EmptyNote>No kids added yet.</EmptyNote> : null}
          {kids.map((kid) => {
            const view = kid.view;
            const tiles = view ? buildProgressTiles(view, now) : [];
            const doorRows: SubjectDoorRow[] = tiles.map((tile) => ({
              subjectId: tile.subjectId,
              displayName: tile.displayName,
              needsConfirm: tile.needsConfirm,
            }));
            const generatedDate = kid.reportGeneratedAt
              ? new Date(kid.reportGeneratedAt).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })
              : null;
            // Same gate as the app's ProgressView: the merged card needs
            // a chart with at least one plottable line.
            const hasChart =
              generatedDate !== null &&
              kid.eras.length > 0 &&
              buildTrajectoryStory(kid.eras).subjects.length > 0;

            return (
              <section key={kid.childId} className="mb-8">
                <SectionHead
                  eyebrow="Kid"
                  title={kid.childName}
                  sub={
                    view
                      ? `Live projection updated ${timeAgo(view.projectedAt)} · report scored ${timeAgo(kid.reportGeneratedAt)}`
                      : "Live progress view unavailable for this child."
                  }
                />

                {hasChart && generatedDate ? (
                  view && view.subjects.length > 0 ? (
                    <ProgressSubjects
                      childId={kid.childId}
                      subjects={view.subjects}
                      tiles={tiles}
                      conflicts={[]}
                      timeZone={view.timeZone}
                      deeperChecks={false}
                    >
                      <ReportSnapshot
                        childName={kid.childName}
                        generatedDate={generatedDate}
                        eras={kid.eras}
                        className="mt-3"
                        doorRows={doorRows}
                      />
                    </ProgressSubjects>
                  ) : (
                    <ReportSnapshot
                      childName={kid.childName}
                      generatedDate={generatedDate}
                      eras={kid.eras}
                      className="mt-3"
                    />
                  )
                ) : view && view.subjects.length > 0 ? (
                  <div className="mt-3">
                    <ProgressMap
                      childId={kid.childId}
                      tiles={tiles}
                      subjects={view.subjects}
                      conflicts={[]}
                      timeZone={view.timeZone}
                      deeperChecks={false}
                    />
                  </div>
                ) : (
                  <EmptyNote>No report scorings yet, so no trajectory to draw.</EmptyNote>
                )}

                {kid.evidence.length > 0 ? (
                  <div className="mt-3 rounded-lg border border-border-subtle bg-card p-4 shadow-sm">
                    <p className="text-[0.72rem] font-bold text-muted">Newest evidence</p>
                    <ul className="mt-2 flex flex-col gap-2">
                      {kid.evidence.map((row, index) => (
                        <li key={index} className="text-sm">
                          {row.quote ? (
                            <p className="text-body">&ldquo;{row.quote}&rdquo;</p>
                          ) : (
                            <p className="text-muted">
                              {row.itemId} marked {row.answer.replace(/_/g, " ")}
                            </p>
                          )}
                          <p className="mt-0.5 font-mono text-[0.62rem] text-subtle">
                            {row.source.replace(/_/g, " ")}
                            {row.channel ? ` · ${row.channel}` : ""} · {timeAgo(row.createdAt)}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>
      )}
    </FamilyShell>
  );
}
