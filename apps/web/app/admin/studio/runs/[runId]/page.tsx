import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { requireFounder } from "../../../../../lib/admin/gate";
import { adminTimeZone, familyDisplayName, timeAgo } from "../../../../../lib/admin/format";
import { getSessionDetail } from "../../../../../lib/admin/sessions-data";
import {
  getStudioRunDetail,
  getStudioRunFeedbackHistory,
} from "../../../../../lib/admin/studio-data";
import {
  buildStudioBrief,
  STUDIO_RUN_UUID_PATTERN,
} from "../../../../../lib/materials/studio-brief";
import { AgentPromptButton } from "../../../agent-prompt-button";
import { SessionTrace } from "../../../session-trace";
import { EmptyNote, Pill, SectionHead } from "../../../ui";
import { StudioFeedbackForm } from "../feedback-form";

/**
 * /admin/studio/runs/[runId]: one test run's whole story (founder ask
 * 2026-07-18 evening, the iteration loop). Output first, then the
 * founder's verdict beside the Prompt for agent button (the packet
 * carries the verdict out to a coding agent), then the exact brief the
 * session received, then the full turn-by-turn trace, the same renderer
 * the session X-ray uses.
 */

export const metadata: Metadata = { title: "Studio run" };

function runTone(status: string): "sage" | "gold" | "rose" {
  if (status === "completed") return "sage";
  if (status === "failed") return "rose";
  return "gold";
}

export default async function AdminStudioRunPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  await requireFounder();
  const { runId } = await params;
  if (!STUDIO_RUN_UUID_PATTERN.test(runId)) notFound();
  const run = await getStudioRunDetail(runId);
  if (!run) notFound();
  // db.ts law: sequential reads on the console's single-connection pool.
  const feedbackHistory = await getStudioRunFeedbackHistory(runId);
  const sessionDetail = run.sessionId ? await getSessionDetail(run.sessionId) : null;
  const timeZone = adminTimeZone();
  const brief = buildStudioBrief({ request: run.request, childName: run.childName });

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link
          href="/admin/studio"
          className="text-sm font-semibold text-[var(--clay-600)] hover:underline"
        >
          Material studio
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h1 className="font-display text-2xl font-bold text-strong">{run.request}</h1>
          <Pill tone={runTone(run.status)}>
            {run.status === "started" ? "running" : run.status}
          </Pill>
        </div>
        <p className="mt-1 text-sm text-muted">
          {familyDisplayName(run.familyName)}
          {run.childName ? ` · for ${run.childName}` : ""} · {timeAgo(run.createdAt)} · started
          by {run.startedBy}
        </p>
        {run.error ? (
          <p className="mt-2 rounded-md border border-[var(--rose-500)] bg-[var(--danger-soft)] px-3.5 py-2.5 text-sm font-semibold text-[var(--rose-600)]">
            {run.error}
          </p>
        ) : null}
      </div>

      <div>
        <SectionHead
          eyebrow="Output"
          title="What the skill made"
          sub="Every material this run's session created, with the automatic quality-check verdict."
        />
        <div className="mt-3 flex flex-col gap-3">
          {run.materials.length === 0 ? (
            <EmptyNote>
              {run.status === "started"
                ? "Still building; refresh in a minute."
                : "No material carries this session id. The trace below shows what the session did instead."}
            </EmptyNote>
          ) : (
            run.materials.map((material) => (
              <div
                key={material.id}
                className="flex flex-wrap items-start gap-4 rounded-[var(--radius-md)] border border-border-subtle bg-card p-4"
              >
                {/* Blob preview JPEGs have no next/image loader config; plain img matches the chat card. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={material.previewUrl}
                  alt={`${material.title} preview`}
                  className="w-[180px] rounded-md border border-border-subtle"
                />
                <div className="min-w-[240px] flex-1 text-sm">
                  <p className="text-base font-bold text-strong">{material.title}</p>
                  <p className="mt-1 text-muted">
                    {material.path ?? material.kind} path · {material.kind} ·{" "}
                    {material.pageCount} {material.pageCount === 1 ? "page" : "pages"} ·{" "}
                    {material.status}
                  </p>
                  <p className="mt-2">
                    {material.reviewPassed ? (
                      <Pill tone="sage">quality check passed</Pill>
                    ) : (
                      <Pill tone="gold">quality check flagged</Pill>
                    )}
                  </p>
                  {!material.reviewPassed && material.reviewIssues.length > 0 ? (
                    <p className="mt-1.5 text-[0.82rem] text-muted">
                      {material.reviewIssues.join("; ")}
                    </p>
                  ) : null}
                  <p className="mt-2.5">
                    <a
                      href={material.pdfUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-[var(--clay-600)] hover:underline"
                    >
                      Open PDF
                    </a>
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionHead
            eyebrow="Verdict"
            title="Your feedback on this output"
            sub="Tag it, add a sentence, save. Prompt for agent copies a packet with this verdict, the run, the output, and the trace, ready to paste into a coding agent that improves the skill."
          />
          <AgentPromptButton source="studio_run" sourceId={run.id} />
        </div>
        <div className="mt-3 rounded-[var(--radius-md)] border border-border-subtle bg-card p-4">
          <StudioFeedbackForm
            runId={run.id}
            initialTags={run.feedbackTags}
            initialFeedback={run.feedback ?? ""}
            savedAt={run.feedbackAt ? timeAgo(run.feedbackAt) : null}
          />
        </div>
        {feedbackHistory.length > 1 ? (
          <div className="mt-3 rounded-[var(--radius-md)] border border-border-subtle bg-card p-4">
            <p className="text-sm font-semibold text-strong">
              Earlier verdicts on this run
            </p>
            <p className="mt-1 text-xs text-muted">
              Every verdict is kept. What you changed your mind about is the most
              useful thing here: the version you rejected, why, and the version
              that followed.
            </p>
            <ol className="mt-3 flex flex-col gap-3">
              {feedbackHistory.slice(1).map((entry) => (
                <li
                  key={entry.id}
                  className="border-t border-border-subtle pt-3 text-sm text-body"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted">{timeAgo(entry.createdAt)}</span>
                    {entry.tags.map((tag) => (
                      <Pill key={tag} tone="outline">
                        {tag}
                      </Pill>
                    ))}
                  </div>
                  {entry.feedback ? <p className="mt-1">{entry.feedback}</p> : null}
                  {entry.materialTitle ? (
                    <p className="mt-1 text-xs text-muted">on {entry.materialTitle}</p>
                  ) : null}
                </li>
              ))}
            </ol>
          </div>
        ) : null}
      </div>

      <div>
        <SectionHead
          eyebrow="Prompt"
          title="The brief the session received"
          sub="Rebuilt by the current brief builder (lib/materials/studio-brief.ts); the injected family context appears in the trace below."
        />
        <details className="mt-3 rounded-[var(--radius-md)] border border-border-subtle bg-card px-4 py-3">
          <summary className="cursor-pointer text-sm font-bold text-[var(--clay-600)]">
            Read the brief
          </summary>
          <pre className="mt-2 max-h-[360px] overflow-auto whitespace-pre-wrap rounded-md bg-page px-3.5 py-3 font-mono text-xs text-body">
            {brief}
          </pre>
        </details>
      </div>

      <div>
        <SectionHead
          eyebrow="Trace"
          title="What happened in between"
          sub="Injected context, the model's replies, and every tool call with its args and result, in the order the model lived them."
        />
        {sessionDetail ? (
          <>
            <SessionTrace detail={sessionDetail} timeZone={timeZone} />
            <p className="mt-3 text-[0.78rem]">
              <Link
                href={`/admin/sessions/${encodeURIComponent(run.sessionId ?? "")}`}
                className="font-semibold text-[var(--clay-600)] hover:underline"
              >
                Open in the session inspector (adds the token bill and deliveries)
              </Link>
            </p>
          </>
        ) : (
          <EmptyNote>
            No session started for this run, so there is no trace: it died before the agent
            woke.
          </EmptyNote>
        )}
      </div>
    </div>
  );
}
