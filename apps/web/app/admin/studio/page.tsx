import type { Metadata } from "next";
import Link from "next/link";

import { requireFounder } from "../../../lib/admin/gate";
import { familyDisplayName, timeAgo } from "../../../lib/admin/format";
import {
  getStudioLedger,
  listSandboxFamilies,
  readSkillPackage,
  type FleetMaterialRow,
  type StudioRunRow,
} from "../../../lib/admin/studio-data";
import { EmptyNote, Pill, SectionHead } from "../ui";
import { StudioRunForm } from "./run-form";

/**
 * /admin/studio: the material studio, converged on the founder's lab
 * reply (2026-07-18, docs/homa-planning/plans/
 * 2026-07-18-material-studio-admin-directions.html): winning direction
 * 3 "Ledger", one interleaved timeline of lab runs and real fleet
 * output, filterable, with the composer folded into a "+ New lab run"
 * disclosure. The skill package stays below (the Ledger direction's
 * honest skip, kept deliberately: the founder's round-2 asks need the
 * skill X-ray on this surface) and carries the three Dossier steals:
 * reference images large beside the sections they teach, the
 * description framed as the routing contract, and a tool table naming
 * which SKILL.md sections drive each tool.
 */

export const metadata: Metadata = { title: "Material studio" };

type LedgerView = "all" | "lab" | "fleet";

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
        <Pill tone="clay">lab run</Pill>
        <Pill tone={runTone(run.status)}>{runLabel(run.status)}</Pill>
        {run.feedbackAt ? <Pill tone="outline">feedback left</Pill> : null}
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
          <Link
            href={`/admin/studio/runs/${run.id}`}
            className="font-bold text-[var(--clay-600)] hover:underline"
          >
            Open the run: trace, feedback, agent packet
          </Link>
          {run.sessionId ? (
            <Link
              href={`/admin/sessions/${run.sessionId}`}
              className="font-semibold text-[var(--clay-600)] hover:underline"
            >
              Session X-ray
            </Link>
          ) : null}
          <Link
            href={`/admin/chats?family=${run.familyId}`}
            className="font-semibold text-[var(--clay-600)] hover:underline"
          >
            Family thread
          </Link>
          <span className="text-subtle">started by {run.startedBy}</span>
        </p>
      </div>
    </details>
  );
}

function FleetRow({ material }: { material: FleetMaterialRow }) {
  return (
    <div className="flex flex-wrap items-center gap-2.5 rounded-[var(--radius-md)] border border-border-subtle bg-card px-4 py-2.5">
      <span className="min-w-[180px] flex-1 text-[0.84rem] font-semibold text-strong">
        {material.title}
      </span>
      <Pill tone="stone">fleet</Pill>
      {material.sandbox ? <Pill tone="outline">test family</Pill> : null}
      <Pill tone={material.reviewPassed ? "sage" : "gold"}>
        {material.reviewPassed ? "passed" : "flagged"}
      </Pill>
      <span className="text-[0.72rem] text-subtle">
        {familyDisplayName(material.familyName)} · {material.kind} ·{" "}
        {material.source} · {timeAgo(material.createdAt)}
      </span>
      {material.sessionId ? (
        <Link
          href={`/admin/sessions/${material.sessionId}`}
          className="text-[0.72rem] font-semibold text-[var(--clay-600)] hover:underline"
        >
          Session X-ray
        </Link>
      ) : null}
    </div>
  );
}

const LEDGER_FILTERS: { key: LedgerView; label: string }[] = [
  { key: "all", label: "Everything" },
  { key: "lab", label: "Lab runs" },
  { key: "fleet", label: "Fleet output" },
];

export default async function AdminStudioPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  await requireFounder();
  const query = await searchParams;
  const view: LedgerView =
    query.view === "lab" || query.view === "fleet" ? query.view : "all";
  // db.ts law: the console's pooler connection deadlocks on parallel
  // batches, so these reads stay sequential.
  const families = await listSandboxFamilies();
  const ledger = await getStudioLedger(30);
  const skillPackage = await readSkillPackage();

  const visible = ledger.entries.filter((entry) =>
    view === "all" ? true : view === "lab" ? entry.kind === "run" : entry.kind === "material",
  );

  return (
    <div className="flex flex-col gap-8">
      <div>
        <SectionHead
          eyebrow="Material studio"
          title="One timeline of everything the skill makes"
          sub="Lab runs are real agent sessions against a sandbox family: same skill, same tools, same quality check. Fleet rows are what real families got. Nothing here texts or emails anyone."
        />
        <details className="mt-3 rounded-[var(--radius-md)] border border-border-subtle bg-card">
          <summary className="cursor-pointer px-4 py-3 text-[0.9rem] font-bold text-[var(--clay-600)] [&::-webkit-details-marker]:hidden">
            + New lab run
          </summary>
          <div className="border-t border-border-subtle p-4">
            <StudioRunForm families={families} />
          </div>
        </details>

        <div className="mt-4 flex flex-wrap gap-1.5" role="group" aria-label="Ledger filter">
          {LEDGER_FILTERS.map((filter) => {
            const active = filter.key === view;
            const href = filter.key === "all" ? "/admin/studio" : `/admin/studio?view=${filter.key}`;
            return (
              <Link
                key={filter.key}
                href={href}
                aria-current={active ? "true" : undefined}
                className={
                  active
                    ? "rounded-pill border border-[var(--clay-300)] bg-brand-soft px-3.5 py-1.5 text-[0.78rem] font-bold text-[var(--clay-700)]"
                    : "rounded-pill border border-border-default bg-card px-3.5 py-1.5 text-[0.78rem] font-semibold text-muted hover:text-strong"
                }
              >
                {filter.label}
              </Link>
            );
          })}
          <span className="self-center text-[0.74rem] text-subtle">
            {ledger.labCount} lab · {ledger.fleetCount} fleet in this window
          </span>
        </div>

        {!ledger.runsAvailable ? (
          <div className="mt-3">
            <EmptyNote>
              The run ledger table is not in this database yet. Apply the
              materials_studio_runs migration (additive, safe to lead the
              deploy); fleet output still shows below.
            </EmptyNote>
          </div>
        ) : null}

        <div className="mt-3 flex flex-col gap-2">
          {visible.length === 0 ? (
            <EmptyNote>
              {view === "lab"
                ? "No test runs yet. Launch one with + New lab run."
                : "Nothing in this window yet."}
            </EmptyNote>
          ) : (
            visible.map((entry) =>
              entry.kind === "run" ? (
                <RunCard key={`run-${entry.run.id}`} run={entry.run} />
              ) : (
                <FleetRow key={`material-${entry.material.id}`} material={entry.material} />
              ),
            )
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
                Routing contract: when does this skill load?
              </p>
              <p className="mt-1 text-[0.76rem] text-muted">
                eve advertises this description every turn; the model loads
                the skill when the parent&apos;s ask matches it.
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

            <div className="rounded-[var(--radius-md)] border border-border-subtle bg-card p-4">
              <p className="font-mono text-[0.62rem] font-bold uppercase tracking-[0.12em] text-subtle">
                Tool surface: which sections drive each tool
              </p>
              <p className="mt-1 text-[0.76rem] text-muted">
                Parsed from SKILL.md itself, so this table cannot drift from
                what the skill actually instructs.
              </p>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-[0.78rem]">
                  <thead>
                    <tr className="border-b border-border-subtle text-left">
                      <th className="py-1.5 pr-3 font-mono text-[0.62rem] font-bold uppercase tracking-[0.11em] text-subtle">
                        Tool
                      </th>
                      <th className="py-1.5 pr-3 font-mono text-[0.62rem] font-bold uppercase tracking-[0.11em] text-subtle">
                        What it owns
                      </th>
                      <th className="py-1.5 font-mono text-[0.62rem] font-bold uppercase tracking-[0.11em] text-subtle">
                        Driven by
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {skillPackage.toolSurface.map((entry) => (
                      <tr key={entry.tool} className="border-b border-border-subtle align-top">
                        <td className="py-2 pr-3 font-mono text-[0.74rem] font-bold text-[var(--clay-700)]">
                          {entry.tool}
                        </td>
                        <td className="py-2 pr-3 text-muted">{entry.role}</td>
                        <td className="py-2 text-body">{entry.sections.join(" · ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-[var(--radius-md)] border border-border-subtle bg-card p-4">
              <p className="font-mono text-[0.62rem] font-bold uppercase tracking-[0.12em] text-subtle">
                Reference images, beside the sections they teach
              </p>
              {skillPackage.citations.length === 0 ? (
                <p className="mt-2 text-[0.8rem] text-muted">
                  SKILL.md cites no reference images.
                </p>
              ) : (
                <div className="mt-2.5 flex flex-col gap-4">
                  {skillPackage.citations.map((citation) => (
                    <div key={citation.file} className="flex flex-wrap items-start gap-4">
                      {citation.present ? (
                        <a
                          href={`/admin/studio/reference/${citation.file}`}
                          target="_blank"
                          rel="noreferrer"
                          className="shrink-0"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={`/admin/studio/reference/${citation.file}`}
                            alt={citation.file}
                            className="w-[240px] rounded-md border border-border-subtle"
                          />
                        </a>
                      ) : (
                        <div className="flex h-[160px] w-[240px] shrink-0 items-center justify-center rounded-md border border-dashed border-[var(--rose-500)] bg-[var(--danger-soft,#FBE9E4)] px-3 text-center text-[0.72rem] font-semibold text-[var(--rose-600)]">
                          Cited by the skill but not shipped in references/
                        </div>
                      )}
                      <div className="min-w-[240px] flex-1">
                        <p className="font-mono text-[0.68rem] font-bold text-body">{citation.file}</p>
                        <p className="mt-0.5 text-[0.78rem] font-semibold text-strong">
                          Teaches: {citation.section ?? "the package preamble"}
                        </p>
                        <p className="mt-1 text-[0.78rem] leading-relaxed text-muted">
                          {citation.excerpt}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {skillPackage.uncitedFiles.length > 0 ? (
                <p className="mt-3 text-[0.76rem] font-semibold text-[var(--gold-ink,#8A6410)]">
                  In references/ but cited nowhere: {skillPackage.uncitedFiles.join(", ")}
                </p>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
