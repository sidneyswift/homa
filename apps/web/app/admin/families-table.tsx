import Link from "next/link";

import type { FamilySnapshot } from "../../lib/admin/roster-data";
import { adminTimeZone, dayKey, familyDisplayName, timeAgo } from "../../lib/admin/format";
import { STAGE_COPY, STAGE_ORDER, type FamilyStage } from "../../lib/admin/stage";
import { Pill } from "./ui";

/**
 * One table for every family (founder ask 2026-07-23): name, funnel
 * stage, joined, last heard. Replaces the "New this week" and "The call
 * list" cards; quiet families are the Quiet filter, not a separate box.
 * All controls are links over searchParams, no client JS. Quiet rows use
 * gold ink, never red: family pace is not a failure (house rule).
 */

export type TableSort = "joined" | "stage" | "heard";
export type TableDir = "asc" | "desc";

export interface FamiliesTableState {
  stage: FamilyStage | null;
  sort: TableSort;
  dir: TableDir;
  allRows: boolean;
}

const ROW_CAP = 15;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const TWO_DAYS_MS = 48 * 60 * 60 * 1000;

function joinedLabel(createdAt: string, tz: string): string {
  const created = new Date(createdAt);
  if (Date.now() - created.getTime() < TWO_DAYS_MS) return timeAgo(createdAt);
  const [, month, day] = dayKey(created, tz).split("-");
  return `${MONTHS[Number(month) - 1]} ${Number(day)}`;
}

function compareSnapshots(sort: TableSort, dir: TableDir) {
  const flip = dir === "asc" ? -1 : 1;
  return (a: FamilySnapshot, b: FamilySnapshot): number => {
    let diff = 0;
    if (sort === "joined") {
      diff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    } else if (sort === "stage") {
      diff = STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage);
    } else {
      // Never-heard rows sort as oldest, so desc puts freshest voices first.
      const aAt = a.lastUserActivityAt ? new Date(a.lastUserActivityAt).getTime() : 0;
      const bAt = b.lastUserActivityAt ? new Date(b.lastUserActivityAt).getTime() : 0;
      diff = bAt - aAt;
    }
    if (diff === 0) diff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    return diff * flip;
  };
}

/** Rebuilds /admin?... keeping every non-default control. */
function buildHref(
  base: { rangeDays: number; includeTests: boolean },
  state: FamiliesTableState,
  overrides: Partial<FamiliesTableState>,
): string {
  const next = { ...state, ...overrides };
  const params = new URLSearchParams();
  if (base.rangeDays === 28) params.set("range", "28d");
  if (base.includeTests) params.set("families", "all");
  if (next.stage) params.set("stage", next.stage);
  if (next.sort !== "joined" || next.dir !== "desc") {
    params.set("sort", next.sort);
    params.set("dir", next.dir);
  }
  if (next.allRows) params.set("rows", "all");
  const query = params.toString();
  return query ? `/admin?${query}#families` : "/admin#families";
}

function HeaderLink({
  label,
  sort,
  base,
  state,
}: {
  label: string;
  sort: TableSort;
  base: { rangeDays: number; includeTests: boolean };
  state: FamiliesTableState;
}) {
  const active = state.sort === sort;
  const nextDir: TableDir = active && state.dir === "desc" ? "asc" : "desc";
  return (
    <Link
      href={buildHref(base, state, { sort, dir: nextDir })}
      className={active ? "text-strong" : "hover:text-strong"}
    >
      {label}
      {active ? (state.dir === "desc" ? " ↓" : " ↑") : null}
    </Link>
  );
}

export function FamiliesTable({
  snapshots,
  state,
  rangeDays,
  includeTests,
}: {
  snapshots: FamilySnapshot[];
  state: FamiliesTableState;
  rangeDays: number;
  includeTests: boolean;
}) {
  const tz = adminTimeZone();
  const base = { rangeDays, includeTests };
  const stageCounts = new Map<FamilyStage, number>();
  for (const s of snapshots) stageCounts.set(s.stage, (stageCounts.get(s.stage) ?? 0) + 1);

  const filtered = state.stage ? snapshots.filter((s) => s.stage === state.stage) : snapshots;
  const sorted = [...filtered].sort(compareSnapshots(state.sort, state.dir));
  const rows = state.allRows ? sorted : sorted.slice(0, ROW_CAP);

  return (
    <div id="families" className="mt-3 rounded-lg border border-border-subtle bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-1.5">
        <Link href={buildHref(base, state, { stage: null })}>
          <Pill tone={state.stage === null ? "clay" : "outline"}>All {snapshots.length}</Pill>
        </Link>
        {STAGE_ORDER.map((stage) => {
          const copy = STAGE_COPY[stage];
          const count = stageCounts.get(stage) ?? 0;
          return (
            <Link key={stage} href={buildHref(base, state, { stage })} title={copy.hint}>
              <Pill tone={state.stage === stage ? copy.tone : "outline"}>
                {copy.label} {count}
              </Pill>
            </Link>
          );
        })}
      </div>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-subtle">No families in this stage.</p>
      ) : (
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="border-b border-border-subtle text-left text-[0.72rem] font-bold text-muted">
              <th className="px-3 py-2 font-bold">Family</th>
              <th className="px-3 py-2 font-bold">
                <HeaderLink label="Stage" sort="stage" base={base} state={state} />
              </th>
              <th className="px-3 py-2 font-bold">
                <HeaderLink label="Joined" sort="joined" base={base} state={state} />
              </th>
              <th className="px-3 py-2 font-bold">
                <HeaderLink label="Last heard" sort="heard" base={base} state={state} />
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => {
              const stage = STAGE_COPY[s.stage];
              return (
                <tr key={s.id} className="border-b border-border-subtle last:border-0">
                  <td className="px-3 py-2">
                    <Link
                      href={`/admin/families/${s.id}`}
                      className="font-bold text-strong hover:underline"
                    >
                      {familyDisplayName(s.name)}
                    </Link>
                    {s.sandbox ? (
                      <span className="ml-2">
                        <Pill tone="outline">test</Pill>
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">
                    <Pill tone={stage.tone} title={stage.hint}>
                      {stage.label}
                    </Pill>
                  </td>
                  <td className="px-3 py-2 font-mono text-[0.78rem] text-muted">
                    {joinedLabel(s.createdAt, tz)}
                  </td>
                  <td className="px-3 py-2">
                    {s.lastUserActivityAt ? (
                      <span
                        className={
                          s.stage === "quiet"
                            ? "font-semibold text-[var(--gold-ink)]"
                            : "text-muted"
                        }
                      >
                        {timeAgo(s.lastUserActivityAt)}
                      </span>
                    ) : (
                      <span className="text-subtle">never</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {!state.allRows && sorted.length > ROW_CAP ? (
        <p className="mt-3 text-sm">
          <Link
            href={buildHref(base, state, { allRows: true })}
            className="font-semibold text-muted underline underline-offset-2 hover:text-strong"
          >
            Show all {sorted.length} families
          </Link>
        </p>
      ) : null}
    </div>
  );
}
