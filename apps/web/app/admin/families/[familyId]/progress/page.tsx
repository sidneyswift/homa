import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ReportSnapshot } from "../../../../onboarding/r/[token]/report-snapshot";
import { getFamilyProgressDeep } from "../../../../../lib/admin/family-deep-data";
import { requireFounder } from "../../../../../lib/admin/gate";
import { timeAgo } from "../../../../../lib/admin/format";
import { EmptyNote, Pill, SectionHead, type PillTone } from "../../../ui";
import { FamilyShell, isUuid } from "../family-shell";

/**
 * The family file's Progress chapter: per kid, the same trajectory
 * chart the family sees (the real ReportSnapshot component over the
 * real eras), the live subject states, and the newest evidence quotes
 * with their sources.
 */

export const metadata: Metadata = { title: "Family progress" };

const SUBJECT_TONE: Record<string, PillTone> = {
  updated_recently: "sage",
  older: "stone",
  conflict: "gold",
};

export default async function AdminFamilyProgressPage({
  params,
}: {
  params: Promise<{ familyId: string }>;
}) {
  await requireFounder();
  const { familyId } = await params;
  if (!isUuid(familyId)) notFound();
  const kids = await getFamilyProgressDeep(familyId);

  return (
    <FamilyShell
      familyId={familyId}
      title="· Progress"
      sub="The same chart and subject map the family sees, with the evidence behind them."
    >
      {() => (
        <div>
          {kids.length === 0 ? <EmptyNote>No kids added yet.</EmptyNote> : null}
          {kids.map((kid) => (
            <section key={kid.childId} className="mb-8">
              <SectionHead
                eyebrow="Kid"
                title={kid.childName}
                sub={
                  kid.view
                    ? `Live projection updated ${timeAgo(kid.view.projectedAt)} · report scored ${timeAgo(kid.reportGeneratedAt)}`
                    : "Live progress view unavailable for this child."
                }
              />

              {kid.eras.length > 0 && kid.reportGeneratedAt ? (
                <ReportSnapshot
                  childName={kid.childName}
                  generatedDate={new Date(kid.reportGeneratedAt).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                  plans={[]}
                  eras={kid.eras}
                  className="mt-3"
                />
              ) : (
                <EmptyNote>No report scorings yet, so no trajectory to draw.</EmptyNote>
              )}

              {kid.view && kid.view.subjects.length > 0 ? (
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {kid.view.subjects.map((subject) => (
                    <div
                      key={subject.subjectId}
                      className="rounded-md border border-border-subtle bg-card px-3.5 py-2.5 shadow-sm"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-bold text-strong">{subject.displayName}</p>
                        <Pill tone={SUBJECT_TONE[subject.state] ?? "stone"}>
                          {subject.state.replace(/_/g, " ")}
                        </Pill>
                      </div>
                      <p className="mt-1 font-mono text-[0.62rem] text-subtle">
                        {subject.evidenceCount} evidence rows · latest{" "}
                        {timeAgo(subject.latestObservedAt)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : null}

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
          ))}
        </div>
      )}
    </FamilyShell>
  );
}
