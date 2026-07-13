import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { FAMILY_MEMORY_CHAR_BUDGET } from "../../../../../lib/agent-memory";
import { getFamilyBrain } from "../../../../../lib/admin/family-deep-data";
import { requireFounder } from "../../../../../lib/admin/gate";
import { adminTimeZone, formatInt, timeAgo, timeLabel } from "../../../../../lib/admin/format";
import { EmptyNote, Pill, SectionHead, type PillTone } from "../../../ui";
import { FamilyShell, isUuid } from "../family-shell";

/**
 * The family file's Brain chapter: what Homa remembers about this
 * family (with provenance where the capture layer has it), what a
 * session actually carries in (the newest context snapshot), and the
 * background extraction audits.
 */

export const metadata: Metadata = { title: "Family brain" };

const KIND_TONE: Record<string, PillTone> = {
  fact: "sky",
  what_works: "sage",
  daily_note: "stone",
};

export default async function AdminFamilyBrainPage({
  params,
}: {
  params: Promise<{ familyId: string }>;
}) {
  await requireFounder();
  const { familyId } = await params;
  if (!isUuid(familyId)) notFound();
  const brain = await getFamilyBrain(familyId);
  const timeZone = adminTimeZone();
  const active = brain.memories.filter((memory) => memory.supersededAt === null);
  const superseded = brain.memories.filter((memory) => memory.supersededAt !== null);

  return (
    <FamilyShell
      familyId={familyId}
      title="· Brain"
      sub="What she remembers, where each memory came from, and what she carries into every conversation."
    >
      {() => (
        <div>
          <p className="text-sm text-muted">
            {active.length} active memories ·{" "}
            {formatInt(brain.activeChars)} of {formatInt(FAMILY_MEMORY_CHAR_BUDGET)} characters used
            {superseded.length > 0 ? ` · ${superseded.length} superseded kept for the record` : ""}
          </p>

          <div className="mt-3 grid gap-2">
            {active.length === 0 ? (
              <EmptyNote>No memories saved yet.</EmptyNote>
            ) : (
              active.map((memory) => (
                <div
                  key={memory.id}
                  className="flex flex-wrap items-start gap-2 rounded-md border border-border-subtle bg-card px-3.5 py-2.5 shadow-sm"
                >
                  <Pill tone={KIND_TONE[memory.kind] ?? "stone"}>
                    {memory.kind.replace(/_/g, " ")}
                  </Pill>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-body">{memory.content}</p>
                    <p className="mt-0.5 font-mono text-[0.62rem] text-subtle">
                      {memory.childName ? `${memory.childName} · ` : ""}
                      {memory.source} · {timeAgo(memory.createdAt)}
                      {memory.sessionId ? (
                        <>
                          {" · "}
                          <Link
                            href={`/admin/sessions/${encodeURIComponent(memory.sessionId)}`}
                            className="text-[var(--sky-600)] hover:underline"
                          >
                            from this conversation
                          </Link>
                        </>
                      ) : (
                        " · source conversation not recorded (pre-capture row)"
                      )}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          <SectionHead
            eyebrow="Observation ledger"
            title="Observations"
            sub="A parent's message about a child's ability saves here when it matches no skill line. An observation never changes a score. The morning brief builds on new ones and marks them used."
          />
          {brain.observations.length === 0 ? (
            <EmptyNote>
              No observations saved yet. The next parent message that matches
              no skill line saves one.
            </EmptyNote>
          ) : (
            <div className="mt-3 grid gap-2">
              {brain.observations.map((observation) => (
                <div
                  key={observation.id}
                  className="flex flex-wrap items-start gap-2 rounded-md border border-border-subtle bg-card px-3.5 py-2.5 shadow-sm"
                >
                  <Pill tone={observation.status === "used" ? "sage" : "sky"}>
                    {observation.status === "used" ? "used" : "new"}
                  </Pill>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-body">&ldquo;{observation.quote}&rdquo;</p>
                    <p className="mt-0.5 font-mono text-[0.62rem] text-subtle">
                      {observation.childName ? `${observation.childName} · ` : ""}
                      {observation.classification.replace(/_/g, " ")} · {observation.channel} ·{" "}
                      {timeAgo(observation.createdAt)}
                      {observation.subjectHints.length > 0
                        ? ` · near ${observation.subjectHints.join(", ")}`
                        : ""}
                      {observation.usedAt ? ` · used ${timeAgo(observation.usedAt)}` : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          <SectionHead
            eyebrow="Injected"
            title="What a session carries in"
            sub="The newest captured context snapshot: the dynamic blocks (family, progress, continuity) assembled for a real turn. The static soul and channel rules live in code on top of this."
          />
          {brain.latestSnapshot ? (
            <details className="mt-3 rounded-lg border border-border-subtle bg-card p-4 shadow-sm">
              <summary className="cursor-pointer text-sm font-semibold text-body">
                Captured {timeLabel(brain.latestSnapshot.createdAt, timeZone)} ·{" "}
                {brain.latestSnapshot.channel ?? "web"} ·{" "}
                {formatInt(brain.latestSnapshot.content.length)} chars ·{" "}
                <Link
                  href={`/admin/sessions/${encodeURIComponent(brain.latestSnapshot.sessionId)}`}
                  className="text-[var(--sky-600)] hover:underline"
                >
                  its session
                </Link>
              </summary>
              <pre className="mt-3 max-h-[480px] overflow-auto whitespace-pre-wrap rounded-md bg-[var(--surface-sunken)] p-3 font-mono text-xs text-muted">
                {brain.latestSnapshot.content}
              </pre>
            </details>
          ) : (
            <EmptyNote>
              No context snapshot captured yet. The first conversation after this deploy writes one.
            </EmptyNote>
          )}

          <SectionHead
            eyebrow="Learning loop"
            title="Background extraction audits"
            sub="Each review window's verdict: what the post-turn learner saved or skipped."
          />
          {brain.reviews.length === 0 ? (
            <EmptyNote>No background reviews have run for this family yet.</EmptyNote>
          ) : (
            <ul className="mt-3 flex flex-col gap-1.5">
              {brain.reviews.map((review, index) => {
                const result = review.result as
                  | { saved?: unknown[]; skipped?: unknown[]; reason?: string }
                  | null;
                return (
                  <li
                    key={index}
                    className="flex flex-wrap items-center gap-2 rounded-md border border-border-subtle bg-card px-3.5 py-2.5 text-sm shadow-sm"
                  >
                    <span className="font-mono text-xs text-subtle">{timeAgo(review.createdAt)}</span>
                    <span className="text-body">
                      {result
                        ? `saved ${result.saved?.length ?? 0} · skipped ${result.skipped?.length ?? 0}${result.reason ? ` · ${result.reason}` : ""}`
                        : "review claimed, result pending"}
                    </span>
                    <Link
                      href={`/admin/sessions/${encodeURIComponent(review.sessionId)}`}
                      className="ml-auto font-semibold text-[var(--sky-600)] hover:underline"
                    >
                      session
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}

          {superseded.length > 0 ? (
            <details className="mt-6">
              <summary className="cursor-pointer text-sm font-semibold text-muted">
                {superseded.length} superseded memories (kept for the record)
              </summary>
              <div className="mt-2 grid gap-1.5">
                {superseded.map((memory) => (
                  <p key={memory.id} className="rounded-md bg-[var(--surface-sunken)] px-3.5 py-2 text-sm text-subtle">
                    {memory.content}
                    <span className="font-mono text-[0.62rem]">
                      {" "}· superseded {timeAgo(memory.supersededAt)}
                    </span>
                  </p>
                ))}
              </div>
            </details>
          ) : null}
        </div>
      )}
    </FamilyShell>
  );
}
