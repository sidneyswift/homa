import type { Metadata } from "next";
import Link from "next/link";

import { requireFounder } from "../../../lib/admin/gate";
import { timeAgo } from "../../../lib/admin/format";
import { getFamilySnapshots, type FamilySnapshot } from "../../../lib/admin/roster-data";
import { accountStatusCopy } from "../../../lib/admin/account-status-copy";
import { STAGE_COPY, STAGE_ORDER } from "../../../lib/admin/stage";
import { Pill, SectionHead, Spark, statusTone, EmptyNote } from "../ui";

/**
 * /admin/families: the roster (lab direction 2). One row per family with
 * a derived stage, 7-day rhythm, last-touch, and the latest built-in
 * send per kind. Filters and sort are links (server-rendered, no client
 * state); a row opens the family's own page.
 */

export const metadata: Metadata = { title: "Families" };

type Filter = "all" | "new" | "quiet" | "issues";
type Sort = "stage" | "recent" | "newest";

function applyFilter(snapshots: FamilySnapshot[], filter: Filter): FamilySnapshot[] {
  switch (filter) {
    case "new":
      return snapshots.filter((s) => s.stage === "new" || s.stage === "onboarding");
    case "quiet":
      return snapshots.filter((s) => s.stage === "quiet");
    case "issues":
      return snapshots.filter((s) =>
        Object.values(s.latestRuns).some(
          (run) => run && ["failed", "uncertain", "partial_uncertain", "partial"].includes(run.status),
        ),
      );
    default:
      return snapshots;
  }
}

function applySort(snapshots: FamilySnapshot[], sort: Sort): FamilySnapshot[] {
  const list = [...snapshots];
  if (sort === "recent") {
    list.sort((a, b) => (b.lastUserActivityAt ?? "").localeCompare(a.lastUserActivityAt ?? ""));
  } else if (sort === "newest") {
    list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } else {
    list.sort(
      (a, b) =>
        STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage) ||
        (b.lastUserActivityAt ?? "").localeCompare(a.lastUserActivityAt ?? ""),
    );
  }
  return list;
}

function chip(href: string, label: string, active: boolean) {
  return (
    <Link
      key={href}
      href={href}
      className={
        active
          ? "rounded-pill border border-[var(--clay-400)] bg-brand-soft px-3.5 py-1.5 text-sm font-bold text-[var(--clay-700)]"
          : "rounded-pill border border-border-default bg-card px-3.5 py-1.5 text-sm font-semibold text-body hover:border-[var(--clay-300)]"
      }
    >
      {label}
    </Link>
  );
}

export default async function AdminFamiliesPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; sort?: string }>;
}) {
  await requireFounder();
  const params = await searchParams;
  const filter: Filter = (["all", "new", "quiet", "issues"] as const).includes(params.filter as Filter)
    ? (params.filter as Filter)
    : "all";
  const sort: Sort = (["stage", "recent", "newest"] as const).includes(params.sort as Sort)
    ? (params.sort as Sort)
    : "stage";

  const snapshots = await getFamilySnapshots();
  const rows = applySort(applyFilter(snapshots, filter), sort);
  const totalKids = snapshots.reduce((sum, s) => sum + s.kidCount, 0);
  const active = snapshots.filter((s) => s.userMessages7d > 0).length;
  const issues = applyFilter(snapshots, "issues").length;
  const quiet = snapshots.filter((s) => s.stage === "quiet").length;

  const query = (nextFilter: Filter, nextSort: Sort) => {
    const parts: string[] = [];
    if (nextFilter !== "all") parts.push(`filter=${nextFilter}`);
    if (nextSort !== "stage") parts.push(`sort=${nextSort}`);
    return parts.length ? `/admin/families?${parts.join("&")}` : "/admin/families";
  };

  return (
    <div>
      <p className="font-mono text-[0.64rem] font-bold uppercase tracking-[0.13em] text-subtle">
        Founder · families
      </p>
      <h1 className="mt-1 font-display text-2xl font-bold text-strong">The roster, one row per family</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted">
        Stage is derived from timestamps (families.status is not trusted). Open a row for the whole story.
      </p>

      <div className="mt-4 flex flex-wrap gap-2 text-sm">
        {[
          [String(snapshots.length), "families"],
          [String(active), "active this week"],
          [String(quiet), "quiet 14d+"],
          [String(issues), "send issues"],
          [String(totalKids), "kids across the fleet"],
        ].map(([value, label]) => (
          <div key={label} className="rounded-md border border-border-subtle bg-card px-3 py-1.5 shadow-sm">
            <b className="font-display text-base text-strong">{value}</b>{" "}
            <span className="text-subtle">{label}</span>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {chip(query("all", sort), "All", filter === "all")}
        {chip(query("new", sort), "New + onboarding", filter === "new")}
        {chip(query("quiet", sort), "Quiet", filter === "quiet")}
        {chip(query("issues", sort), "Delivery issues", filter === "issues")}
        <span className="flex-1" />
        {chip(query(filter, "stage"), "By stage", sort === "stage")}
        {chip(query(filter, "recent"), "Last active", sort === "recent")}
        {chip(query(filter, "newest"), "Newest", sort === "newest")}
      </div>

      {rows.length === 0 ? (
        <EmptyNote>No families match this filter right now.</EmptyNote>
      ) : (
        <div className="mt-4 overflow-hidden rounded-lg border border-border-subtle bg-card shadow-sm">
          <div className="hidden grid-cols-[minmax(160px,1.5fr)_110px_60px_minmax(100px,1fr)_110px_110px] gap-3 border-b border-border-subtle bg-[var(--surface-sunken)] px-4 py-2 font-mono text-[0.6rem] font-bold uppercase tracking-[0.1em] text-subtle md:grid">
            <span>Family</span>
            <span>Account / stage</span>
            <span>Kids</span>
            <span>7-day rhythm</span>
            <span>Last active</span>
            <span>Latest sends</span>
          </div>
          <ul>
            {rows.map((s) => {
              const stage = STAGE_COPY[s.stage];
              const account = accountStatusCopy({
                status: s.status,
                profileCompletedAt: s.profileCompletedAt,
              });
              return (
                <li key={s.id} className="border-b border-border-subtle last:border-b-0">
                  <Link
                    href={`/admin/families/${s.id}`}
                    className="grid grid-cols-2 items-center gap-x-3 gap-y-1.5 px-4 py-3 text-sm hover:bg-page md:grid-cols-[minmax(160px,1.5fr)_140px_60px_minmax(100px,1fr)_110px_110px]"
                  >
                    <span className="col-span-2 md:col-span-1">
                      <span className="font-bold text-strong">{s.name}</span>
                      <span className="block text-xs text-subtle">
                        {s.parentName ?? "no display name"} · {s.usState ?? "state unknown"} · joined{" "}
                        {timeAgo(s.createdAt)}
                      </span>
                    </span>
                    <span className="flex flex-wrap gap-1">
                      <Pill tone={account.tone} title={account.hint}>{account.label}</Pill>
                      <Pill tone={stage.tone} title={stage.hint}>{stage.label}</Pill>
                      {s.sandbox ? <Pill tone="outline">Test</Pill> : null}
                    </span>
                    <span className="font-mono text-xs text-muted">
                      <span className="md:hidden">kids </span>
                      {s.kidCount}
                    </span>
                    <span>
                      <Spark values={s.activityByDay} width={92} height={22} />
                    </span>
                    <span className="font-mono text-xs text-subtle">{timeAgo(s.lastUserActivityAt)}</span>
                    <span className="flex flex-wrap gap-1">
                      {(["journal_prompt", "morning_brief"] as const).map((kind) => {
                        const run = s.latestRuns[kind];
                        if (!run) return null;
                        return (
                          <Pill key={kind} tone={statusTone(run.status)}>
                            {kind === "journal_prompt" ? "J" : "B"} {run.status.replace(/_/g, " ")}
                          </Pill>
                        );
                      })}
                      {s.journalOptOutAt ? <Pill tone="stone">email opt-out</Pill> : null}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <SectionHead
        eyebrow="Reading this page"
        title="What the pills mean"
        sub="J = latest journal prompt run, B = latest morning brief run. Uncertain means the provider never confirmed delivery; it is never folded into sent or failed."
      />
    </div>
  );
}
