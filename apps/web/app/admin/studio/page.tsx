import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";

import { requireFounder } from "../../../lib/admin/gate";
import { familyDisplayName, timeAgo } from "../../../lib/admin/format";
import { readCosmoFunnel, type CosmoFunnelView } from "../../../lib/admin/cosmo-data";
import {
  getRecipeUsageRollup,
  getStudioLedger,
  getStudioOutputStats,
  listSandboxFamilies,
  listSkillRecipeSlugs,
  readSkillPackage,
  type FleetMaterialRow,
  type RecipeUsageRollup,
  type StudioOutputStats,
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
    <details className="rounded-[var(--homa-radius-control)] border border-border-subtle bg-card px-4 py-3">
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
          <p className="text-[0.8rem] font-semibold text-[var(--homa-error-ink)]">{run.error}</p>
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
                  className="font-semibold text-[var(--homa-brand-text)] hover:underline"
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
            className="font-bold text-[var(--homa-brand-text)] hover:underline"
          >
            Open the run: trace, feedback, agent packet
          </Link>
          {run.sessionId ? (
            <Link
              href={`/admin/sessions/${run.sessionId}`}
              className="font-semibold text-[var(--homa-brand-text)] hover:underline"
            >
              Session X-ray
            </Link>
          ) : null}
          <Link
            href={`/admin/chats?family=${run.familyId}`}
              className="font-semibold text-[var(--homa-brand-text)] hover:underline"
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
    <div className="flex flex-wrap items-center gap-2.5 rounded-[var(--homa-radius-control)] border border-border-subtle bg-card px-4 py-2.5">
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
          className="text-[0.72rem] font-semibold text-[var(--homa-brand-text)] hover:underline"
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

function FunnelStageCard({
  step,
  title,
  headline,
  children,
}: {
  step: string;
  title: string;
  headline: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-[var(--homa-radius-control)] border border-border-subtle bg-card p-4">
      <p className="font-mono text-[0.62rem] font-bold uppercase tracking-[0.12em] text-subtle">
        {step} · {title}
      </p>
      <p className="mt-1.5 font-display text-[1.05rem] font-bold text-strong">{headline}</p>
      <div className="mt-1.5 flex flex-col gap-1 text-[0.78rem] text-muted">{children}</div>
    </div>
  );
}

/**
 * The inspo funnel (founder ask 2026-07-19): the whole pipeline on one
 * surface. Stage 1 is Cosmo's intake (.cosmo analysis corpus from
 * #homa-inspo drops), stage 2 is what graduated into the skill package
 * and format registry, stage 3 is what families actually received. The
 * open-gaps list is the graduation backlog, straight from the analysis
 * JSONs, so a drop that never made the skill stays visible instead of
 * silently resting in a folder.
 */
function CosmoFunnel({
  cosmo,
  skillSectionCount,
  output,
}: {
  cosmo: CosmoFunnelView | null;
  skillSectionCount: number | null;
  output: StudioOutputStats;
}) {
  if (cosmo === null) {
    return (
      <EmptyNote>
        The .cosmo corpus could not be read on this deployment. The
        analysis files ship with the code; check the .cosmo entries under
        outputFileTracingIncludes in next.config.ts.
      </EmptyNote>
    );
  }
  const { intake, coverage } = cosmo;
  const flaggedTotal = coverage.coveredCount + coverage.openCount;
  const openRows = coverage.rows.filter((row) => !row.covered);
  const coveredRows = coverage.rows.filter((row) => row.covered);
  const passRate =
    output.last30Days > 0
      ? Math.round((100 * output.last30DaysPassed) / output.last30Days)
      : null;
  return (
    <div className="mt-3 flex flex-col gap-3">
      <div className="grid gap-3 md:grid-cols-3">
        <FunnelStageCard
          step="1"
          title="Intake: #homa-inspo drops"
          headline={`${intake.referenceCount} references · ${intake.curriculumCount} curriculums`}
        >
          <p>
            {intake.byDropper
              .map(({ dropper, count }) => `${dropper} ${count}`)
              .join(" · ") || "no drops yet"}
          </p>
          <p>
            {intake.latestDropAt
              ? `latest drop ${timeAgo(intake.latestDropAt)}`
              : "waiting on the first drop"}
            {" · "}
            {intake.matchedReferenceCount} matched an existing recipe on arrival
          </p>
        </FunnelStageCard>
        <FunnelStageCard
          step="2"
          title="Graduation: into the skill"
          headline={
            skillSectionCount === null
              ? `${cosmo.registryCount} registry formats`
              : `${skillSectionCount} skill sections · ${cosmo.registryCount} registry formats`
          }
        >
          <p>
            {coverage.coveredCount} of {flaggedTotal} flagged formats now have a
            recipe or registry entry
          </p>
          <p>
            {coverage.openCount === 0 ? (
              "no open gaps"
            ) : (
              <>
                <span className="font-semibold text-[var(--homa-highlight-ink)]">
                  {coverage.openCount} open
                </span>{" "}
                in the graduation backlog below
              </>
            )}
            {" · "}
            <a href="#skill-package" className="font-semibold text-[var(--homa-brand-text)] hover:underline">
              read the skill package
            </a>
          </p>
        </FunnelStageCard>
        <FunnelStageCard
          step="3"
          title="Output: what families got"
          headline={`${output.totalMaterials} materials · ${output.familiesReached} families`}
        >
          <p>
            {output.last7Days} in the last 7 days
            {passRate !== null
              ? ` · ${passRate}% passed the quality check (30 days)`
              : ""}
          </p>
          <p>
            <a href="#ledger" className="font-semibold text-[var(--homa-brand-text)] hover:underline">
              see every run and material in the ledger
            </a>
          </p>
        </FunnelStageCard>
      </div>

      <details className="rounded-[var(--homa-radius-control)] border border-border-subtle bg-card px-4 py-3">
        <summary className="cursor-pointer text-[0.85rem] font-bold text-[var(--homa-brand-text)] [&::-webkit-details-marker]:hidden">
          Latest drops through the analyzer
        </summary>
        <div className="mt-2.5 flex flex-col gap-1.5 border-t border-border-subtle pt-2.5">
          {intake.latestDrops.map((drop) => (
            <div
              key={`${drop.kind}-${drop.entry.id}`}
              className="flex flex-wrap items-center gap-2.5 text-[0.8rem]"
            >
              <span className="min-w-[220px] flex-1 font-semibold text-strong">
                {drop.kind === "reference" ? drop.entry.title : drop.entry.name}
              </span>
              <Pill tone={drop.kind === "reference" ? "sky" : "stone"}>
                {drop.kind}
              </Pill>
              <span className="text-[0.72rem] text-subtle">
                {drop.entry.droppedBy}
                {drop.kind === "reference"
                  ? ` · ${[drop.entry.subject, drop.entry.format].filter(Boolean).join(" · ")}`
                  : drop.entry.methodology
                    ? ` · ${drop.entry.methodology}`
                    : ""}
                {" · "}
                {timeAgo(drop.entry.droppedAt)}
              </span>
            </div>
          ))}
        </div>
      </details>

      <details className="rounded-[var(--homa-radius-control)] border border-border-subtle bg-card px-4 py-3">
        <summary className="cursor-pointer text-[0.85rem] font-bold text-[var(--homa-brand-text)] [&::-webkit-details-marker]:hidden">
          Format gaps: {coverage.openCount} open · {coverage.coveredCount} covered
        </summary>
        <div className="mt-2.5 border-t border-border-subtle pt-2.5">
          <p className="text-[0.74rem] text-muted">
            Formats Cosmo flagged that no recipe could produce at analysis
            time. Open ones are the graduation backlog; covered ones now
            have a SKILL.md recipe or an activity-formats.md entry.
          </p>
          {openRows.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {openRows.map((row) => (
                <Pill key={row.slug} tone="gold">
                  {row.slug}
                  {row.count > 1 ? ` ×${row.count}` : ""}
                </Pill>
              ))}
            </div>
          ) : null}
          {coveredRows.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {coveredRows.map((row) => (
                <Pill key={row.slug} tone="sage">
                  {row.slug}
                </Pill>
              ))}
            </div>
          ) : null}
        </div>
      </details>

      {cosmo.tasteModel ? (
        <details className="rounded-[var(--homa-radius-control)] border border-border-subtle bg-card px-4 py-3">
          <summary className="cursor-pointer text-[0.85rem] font-bold text-[var(--homa-brand-text)] [&::-webkit-details-marker]:hidden">
            Read the taste model
            {cosmo.catalogStatuses.length > 0
              ? ` · catalog: ${cosmo.catalogStatuses
                  .map(({ status, count }) => `${count} ${status}`)
                  .join(", ")}`
              : ""}
          </summary>
          <pre className="mt-2 max-h-[420px] overflow-auto whitespace-pre-wrap rounded-md bg-page px-3.5 py-3 text-[0.74rem] leading-relaxed text-body">
            {cosmo.tasteModel}
          </pre>
          {cosmo.inspoCatalog ? (
            <details className="mt-2">
              <summary className="cursor-pointer text-[0.78rem] font-bold text-[var(--homa-brand-text)]">
                Read the inspo catalog
              </summary>
              <pre className="mt-2 max-h-[420px] overflow-auto whitespace-pre-wrap rounded-md bg-page px-3.5 py-3 text-[0.74rem] leading-relaxed text-body">
                {cosmo.inspoCatalog}
              </pre>
            </details>
          ) : null}
        </details>
      ) : null}
    </div>
  );
}

/**
 * Which recipe each recent material recorded (create_printable's recipe
 * input, stored as generation.input.recipe) and how many passed the
 * quality check. Every shipped recipe rows in, zero included: a format
 * nobody builds from is a fact about the library, not a missing row.
 */
function RecipeUsageTable({ usage }: { usage: RecipeUsageRollup }) {
  const used = usage.rows.filter((row) => row.made > 0);
  const unused = usage.rows.length - used.length;
  return (
    <div className="rounded-[var(--homa-radius-control)] border border-border-subtle bg-card p-4">
      <p className="font-mono text-[0.62rem] font-bold uppercase tracking-[0.12em] text-subtle">
        Recipe use · last {usage.windowDays} days
      </p>
      <p className="mt-1 text-[0.76rem] text-muted">
        The recipe each material recorded at creation, and how many of those
        versions passed the quality check. The column the reviewer checklist
        is measured by.
      </p>
      {used.length === 0 ? (
        <p className="mt-2 text-[0.8rem] text-muted">
          No material in this window recorded a recipe yet.
        </p>
      ) : (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-[0.78rem]">
            <thead>
              <tr className="border-b border-border-subtle text-left">
                <th className="py-1.5 pr-3 font-mono text-[0.62rem] font-bold uppercase tracking-[0.11em] text-subtle">
                  Recipe
                </th>
                <th className="py-1.5 pr-3 text-right font-mono text-[0.62rem] font-bold uppercase tracking-[0.11em] text-subtle">
                  Made
                </th>
                <th className="py-1.5 text-right font-mono text-[0.62rem] font-bold uppercase tracking-[0.11em] text-subtle">
                  Passed check
                </th>
              </tr>
            </thead>
            <tbody>
              {[...used, ...usage.unknown].map((row) => (
                <tr key={row.recipe} className="border-b border-border-subtle">
                  <td className="py-1.5 pr-3 font-mono text-[0.74rem] text-body">
                    {row.recipe}
                    {usage.unknown.includes(row) ? (
                      <span className="ml-2 font-sans text-[0.7rem] text-subtle">
                        (no shipped recipe by this name)
                      </span>
                    ) : null}
                  </td>
                  <td className="py-1.5 pr-3 text-right tabular-nums text-body">{row.made}</td>
                  <td className="py-1.5 text-right tabular-nums text-body">{row.passed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-2 text-[0.74rem] text-subtle">
        {unused} of {usage.rows.length} shipped recipes unused in this window
        {" · "}
        {usage.unattributed} material{usage.unattributed === 1 ? "" : "s"} recorded
        no recipe
      </p>
    </div>
  );
}

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
  const output = await getStudioOutputStats();
  const skillPackage = await readSkillPackage();
  // Recipes ship as sibling files now, not SKILL.md sections, so gap
  // coverage matches against both the section headings and the recipe slugs.
  const recipeSlugs = await listSkillRecipeSlugs();
  // Which recipe each recent material recorded, zero-filled against the
  // shipped slugs (one pooler read, still sequential).
  const recipeUsage = await getRecipeUsageRollup(recipeSlugs);
  // Filesystem, not the pooler: safe after the db reads.
  const cosmo = await readCosmoFunnel([
    ...(skillPackage?.sections ?? []),
    ...recipeSlugs,
  ]);

  const visible = ledger.entries.filter((entry) =>
    view === "all" ? true : view === "lab" ? entry.kind === "run" : entry.kind === "material",
  );

  return (
    <div data-brand-surface="admin-studio" className="quiet-admin__child flex flex-col gap-8">
      <div>
        <SectionHead
          eyebrow="Inspo funnel"
          title="From a Slack drop to a family's printer"
          sub="Stage 1: Cosmo analyzes every #homa-inspo drop into the .cosmo corpus. Stage 2: patterns graduate into the materials-studio skill and the format registry. Stage 3: the skill makes real pages for real families."
        />
        <CosmoFunnel
          cosmo={cosmo}
          skillSectionCount={skillPackage?.sections.length ?? null}
          output={output}
        />
      </div>

      <div id="ledger">
        <SectionHead
          eyebrow="Material studio"
          title="One timeline of everything the skill makes"
          sub="Lab runs are real agent sessions against a sandbox family: same skill, same tools, same quality check. Fleet rows are what real families got. Nothing here texts or emails anyone."
        />
        <details className="mt-3 rounded-[var(--homa-radius-control)] border border-border-subtle bg-card">
          <summary className="cursor-pointer px-4 py-3 text-[0.9rem] font-bold text-[var(--homa-brand-text)] [&::-webkit-details-marker]:hidden">
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
                    ? "rounded-pill border border-[var(--homa-midnight-action)] bg-[var(--homa-info-tint)] px-3.5 py-1.5 text-[0.78rem] font-bold text-[var(--homa-info-ink)]"
                    : "rounded-pill border border-border bg-card px-3.5 py-1.5 text-[0.78rem] font-semibold text-muted hover:text-strong"
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

      <div id="skill-package">
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
            <div className="rounded-[var(--homa-radius-control)] border border-border-subtle bg-card p-4">
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
                {skillPackage.recipes.length} recipes ·{" "}
                {skillPackage.subjects.length} subjects ·{" "}
                {skillPackage.approaches.length} approaches ·{" "}
                {skillPackage.anchors.length} golden anchors
              </p>
              <details className="mt-3">
                <summary className="cursor-pointer text-[0.8rem] font-bold text-[var(--homa-brand-text)]">
                  Read the full SKILL.md
                </summary>
                <pre className="mt-2 max-h-[540px] overflow-auto whitespace-pre-wrap rounded-md bg-page px-3.5 py-3 text-[0.74rem] leading-relaxed text-body">
                  {skillPackage.body}
                </pre>
              </details>
            </div>

            <div className="rounded-[var(--homa-radius-control)] border border-border-subtle bg-card p-4">
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
                        <td className="py-2 pr-3 font-mono text-[0.74rem] font-bold text-[var(--homa-info-ink)]">
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

            <div className="rounded-[var(--homa-radius-control)] border border-border-subtle bg-card p-4">
              <p className="font-mono text-[0.62rem] font-bold uppercase tracking-[0.12em] text-subtle">
                Golden anchors · the reference images the model rides on
              </p>
              {skillPackage.anchors.length === 0 ? (
                <p className="mt-2 text-[0.8rem] text-muted">
                  No golden anchors registered.
                </p>
              ) : (
                <div className="mt-2.5 flex flex-col gap-4">
                  {skillPackage.anchors.map((anchor) => (
                    <div key={anchor.id} className="flex flex-wrap items-start gap-4">
                      <a
                        href={`/admin/studio/anchor/${anchor.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="shrink-0"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`/admin/studio/anchor/${anchor.id}`}
                          alt={anchor.title}
                          className="w-[240px] rounded-md border border-border-subtle"
                        />
                      </a>
                      <div className="min-w-[240px] flex-1">
                        <p className="font-mono text-[0.68rem] font-bold text-body">
                          {anchor.id}{" "}
                          <span className="font-sans font-semibold text-subtle">
                            ({anchor.register})
                          </span>
                        </p>
                        <p className="mt-0.5 text-[0.78rem] font-semibold text-strong">
                          {anchor.title}
                        </p>
                        <p className="mt-1 text-[0.78rem] leading-relaxed text-muted">
                          Use when {anchor.useWhen}.
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <p className="mt-5 font-mono text-[0.62rem] font-bold uppercase tracking-[0.12em] text-subtle">
                Shipped reference docs
              </p>
              <p className="mt-2 text-[0.78rem] leading-relaxed text-muted">
                <span className="font-semibold text-strong">
                  Recipes ({skillPackage.recipes.length}):
                </span>{" "}
                {skillPackage.recipes.join(", ")}
              </p>
              <p className="mt-1.5 text-[0.78rem] leading-relaxed text-muted">
                <span className="font-semibold text-strong">
                  Subjects ({skillPackage.subjects.length}):
                </span>{" "}
                {skillPackage.subjects.join(", ")}
              </p>
              <p className="mt-1.5 text-[0.78rem] leading-relaxed text-muted">
                <span className="font-semibold text-strong">
                  Approaches ({skillPackage.approaches.length}):
                </span>{" "}
                {skillPackage.approaches.join(", ")}
              </p>
            </div>

            <RecipeUsageTable usage={recipeUsage} />
          </div>
        )}
      </div>
    </div>
  );
}
