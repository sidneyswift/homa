import type { Metadata } from "next";
import Link from "next/link";

import { requireFounder } from "../../../lib/admin/gate";
import { familyDisplayName, timeAgo } from "../../../lib/admin/format";
import {
  listRecentFleetMaterials,
  listSandboxFamilies,
  listStudioRuns,
  readSkillPackage,
  type StudioRunRow,
} from "../../../lib/admin/studio-data";
import { EmptyNote, Pill, SectionHead } from "../ui";
import { StudioRunForm } from "./run-form";

/**
 * /admin/studio: the material studio test bench (winning direction 1
 * "Bench" of docs/homa-planning/plans/
 * 2026-07-18-material-studio-admin-directions.html). Composer first
 * (the founder's job here is running tests), then the run ledger with
 * each run's materials and session X-ray link, then the skill package
 * read straight from the filesystem, then recent fleet materials so lab
 * output can be judged against what real families get.
 */

export const metadata: Metadata = { title: "Material studio" };

function runTone(status: StudioRunRow["status"]): "sage" | "gold" | "rose" {
  if (status === "completed") return "sage";
  if (status === "failed") return "rose";
  return "gold";
}

function runLabel(status: StudioRunRow["status"]): string {
  if (status === "completed") return "completed";
  if (status === "failed") return "failed";
  return "running";
}

function RunCard({ run }: { run: StudioRunRow }) {
  return (
    <details className="rounded-[var(--radius-md)] border border-border-subtle bg-card px-4 py-3">
      <summary className="flex cursor-pointer flex-wrap items-center gap-2.5 [&::-webkit-details-marker]:hidden">
        <span className="min-w-[200px] flex-1 text-[0.88rem] font-semibold text-strong">
          {run.request}
        </span>
        <Pill tone={runTone(run.status)}>{runLabel(run.status)}</Pill>
        <span className="text-[0.72rem] text-subtle">
          {familyDisplayName(run.familyName)}
          {run.childName ? ` · ${run.childName}` : ""} · {timeAgo(run.createdAt)}
        </span>
      </summary>
      <div className="mt-3 border-t border-border-subtle pt-3">
        {run.status === "started" ? (
          <p className="text-[0.8rem] text-muted">
            Building. The session loads the skill, designs the page, renders,
            and quality-checks it; refresh in a minute for the result.
          </p>
        ) : null}
        {run.error ? (
          <p className="text-[0.8rem] font-semibold text-[var(--rose-600)]">{run.error}</p>
        ) : null}
        {run.status === "completed" && run.materials.length === 0 ? (
          <p className="text-[0.8rem] text-muted">
            The session finished without creating a material. The session
            trace shows what it did instead.
          </p>
        ) : null}
        {run.materials.map((material) => (
          <div key={material.id} className="mt-2 flex flex-wrap items-start gap-3.5">
            {/* Blob preview JPEGs have no next/image loader config; plain img matches the chat card. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={material.previewUrl}
              alt={`${material.title} preview`}
              className="w-[92px] rounded-md border border-border-subtle"
            />
            <div className="min-w-[220px] flex-1 text-[0.8rem]">
              <p className="font-bold text-strong">{material.title}</p>
              <p className="mt-0.5 text-muted">
                {material.path ?? material.kind} path · {material.kind} ·{" "}
                {material.pageCount} {material.pageCount === 1 ? "page" : "pages"} ·{" "}
                {material.status}
              </p>
              <p className="mt-1">
                {material.reviewPassed ? (
                  <Pill tone="sage">quality check passed</Pill>
                ) : (
                  <Pill tone="gold" title={material.reviewIssues.join("; ")}>
                    quality check flagged
                  </Pill>
                )}
              </p>
              {!material.reviewPassed && material.reviewIssues.length > 0 ? (
                <p className="mt-1 text-[0.76rem] text-muted">
                  {material.reviewIssues.join("; ")}
                </p>
              ) : null}
              <p className="mt-1.5 flex flex-wrap gap-3">
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
        ))}
        <p className="mt-3 flex flex-wrap gap-4 text-[0.76rem]">
          {run.sessionId ? (
            <Link
              href={`/admin/sessions/${run.sessionId}`}
              className="font-semibold text-[var(--clay-600)] hover:underline"
            >
              Open the session X-ray
            </Link>
          ) : null}
          <Link
            href={`/admin/chats?family=${run.familyId}`}
            className="font-semibold text-[var(--clay-600)] hover:underline"
          >
            Open the family thread
          </Link>
          <span className="text-subtle">started by {run.startedBy}</span>
        </p>
      </div>
    </details>
  );
}

export default async function AdminStudioPage() {
  await requireFounder();
  // db.ts law: the console's pooler connection deadlocks on parallel
  // batches, so these reads stay sequential.
  const families = await listSandboxFamilies();
  const runs = await listStudioRuns(20);
  const fleet = await listRecentFleetMaterials(10);
  const skillPackage = await readSkillPackage();

  return (
    <div className="flex flex-col gap-8">
      <div>
        <SectionHead
          eyebrow="Material studio"
          title="Test the materials-studio skill"
          sub="Runs are real agent sessions against a sandbox family: same skill, same tools, same quality check. Nothing is texted or emailed to anyone."
        />
        <div className="mt-3 rounded-[var(--radius-md)] border border-border-subtle bg-card p-4">
          <StudioRunForm families={families} />
        </div>
      </div>

      <div>
        <SectionHead
          eyebrow="Runs"
          title="Test runs"
          sub="Each run links its session X-ray and the materials it produced, with the quality-check verdict."
        />
        <div className="mt-3 flex flex-col gap-2">
          {runs === null ? (
            <EmptyNote>
              The run ledger table is not in this database yet. Apply the
              materials_studio_runs migration (additive, safe to lead the
              deploy), then this list fills in.
            </EmptyNote>
          ) : runs.length === 0 ? (
            <EmptyNote>No test runs yet. Launch one above.</EmptyNote>
          ) : (
            runs.map((run) => <RunCard key={run.id} run={run} />)
          )}
        </div>
      </div>

      <div>
        <SectionHead
          eyebrow="Skill package"
          title="What the skill actually says"
          sub="Read from apps/web/agent/skills/materials-studio at runtime; this is the exact package eve loads."
        />
        {skillPackage === null ? (
          <EmptyNote>
            SKILL.md could not be read on this deployment. The package still
            ships with the code; check file tracing in next.config.ts.
          </EmptyNote>
        ) : (
          <div className="mt-3 flex flex-col gap-3">
            <div className="rounded-[var(--radius-md)] border border-border-subtle bg-card p-4">
              <p className="font-mono text-[0.62rem] font-bold uppercase tracking-[0.12em] text-subtle">
                Routing contract (the description eve advertises every turn)
              </p>
              <p className="mt-1.5 rounded-md bg-page px-3 py-2.5 text-[0.82rem] italic text-body">
                {skillPackage.description}
              </p>
              <p className="mt-2 text-[0.74rem] text-subtle">
                SKILL.md · {skillPackage.lineCount} lines ·{" "}
                {skillPackage.sections.length} sections ·{" "}
                {skillPackage.referenceImages.length} reference images
              </p>
              <details className="mt-3">
                <summary className="cursor-pointer text-[0.8rem] font-bold text-[var(--clay-600)]">
                  Read the full SKILL.md
                </summary>
                <pre className="mt-2 max-h-[540px] overflow-auto whitespace-pre-wrap rounded-md bg-page px-3.5 py-3 text-[0.74rem] leading-relaxed text-body">
                  {skillPackage.body}
                </pre>
              </details>
            </div>
            {skillPackage.referenceImages.length > 0 ? (
              <div className="rounded-[var(--radius-md)] border border-border-subtle bg-card p-4">
                <p className="font-mono text-[0.62rem] font-bold uppercase tracking-[0.12em] text-subtle">
                  Reference images the skill studies
                </p>
                <div className="mt-2.5 flex flex-wrap gap-3">
                  {skillPackage.referenceImages.map((file) => (
                    <a key={file} href={`/admin/studio/reference/${file}`} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/admin/studio/reference/${file}`}
                        alt={file}
                        className="w-[150px] rounded-md border border-border-subtle"
                      />
                      <span className="mt-1 block text-center font-mono text-[0.62rem] text-subtle">
                        {file}
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>

      <div>
        <SectionHead
          eyebrow="Fleet"
          title="Recent materials across families"
          sub="What the skill is doing for real families right now, so lab results are judged against reality."
        />
        <div className="mt-3 flex flex-col gap-1.5">
          {fleet.length === 0 ? (
            <EmptyNote>No materials yet.</EmptyNote>
          ) : (
            fleet.map((material) => (
              <div
                key={material.id}
                className="flex flex-wrap items-center gap-2.5 rounded-[var(--radius-md)] border border-border-subtle bg-card px-4 py-2.5"
              >
                <span className="min-w-[180px] flex-1 text-[0.84rem] font-semibold text-strong">
                  {material.title}
                </span>
                {material.sandbox ? <Pill tone="outline">test family</Pill> : null}
                <Pill tone={material.reviewPassed ? "sage" : "gold"}>
                  {material.reviewPassed ? "passed" : "flagged"}
                </Pill>
                <span className="text-[0.72rem] text-subtle">
                  {familyDisplayName(material.familyName)} · {material.kind} ·{" "}
                  {material.source} · {timeAgo(material.createdAt)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
