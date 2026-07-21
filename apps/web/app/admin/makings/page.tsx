import type { Metadata } from "next";

import { requireFounder } from "../../../lib/admin/gate";
import { familyDisplayName, timeAgo } from "../../../lib/admin/format";
import { MAKINGS_TAPER, readFleetMakings } from "../../../lib/onboarding/makings";
import { mapDb } from "../../../lib/map/db";
import { EmptyNote, Pill, SectionHead } from "../ui";

/**
 * /admin/makings: the meter, shadowed
 * (plans/2026-07-21-chat-first-onboarding.md §7.2).
 *
 * Nothing on this page is enforced anywhere. It answers one question
 * before anyone decides anything: if the meter were on at the specced
 * taper, which families would hit it, and when?
 *
 * That matters because turning the meter on supersedes four recorded
 * decisions, and a ruling that size deserves real numbers rather than a
 * guess about what a week's allowance should be. If most families never
 * come near the cap, the cap is theatre. If the busiest families hit it
 * on day two, the taper is wrong and the free period never installs a
 * rhythm.
 */

export const metadata: Metadata = { title: "Makings (shadow)" };

function formatWhen(iso: string | null): string {
  if (!iso) return "not at this pace";
  return timeAgo(iso);
}

export default async function AdminMakingsPage() {
  await requireFounder();
  const readings = await readFleetMakings(new Date(), 60);
  const sql = mapDb();
  const names = new Map<string, string>();
  if (readings.length > 0) {
    const rows = await sql<{ id: string; name: string }[]>`
      select id, name from public.families
      where id = any(${readings.map((reading) => reading.familyId)})
    `;
    for (const row of rows) names.set(row.id, row.name);
  }

  const counted = readings.filter((reading) => reading.exemption === null);
  const wouldLock = counted.filter((reading) => reading.remaining === 0);
  const median = counted.length
    ? [...counted].sort((a, b) => a.used - b.used)[Math.floor(counted.length / 2)].used
    : 0;

  return (
    <div>
      <p className="font-mono text-[0.64rem] font-bold uppercase tracking-[0.13em] text-subtle">
        Founder · the meter, shadowed
      </p>
      <h1 className="mt-1 font-display text-2xl font-bold text-strong">
        What the meter would say this week
      </h1>
      <p className="mt-1 max-w-2xl text-sm text-muted">
        Nothing here is enforced. No tool reads it, no family sees it. It counts the artifacts each
        family made in the current Monday-to-Monday window against the specced allowance
        ({MAKINGS_TAPER.join(" then ")} a week), so the ruling that turns the meter on can arrive
        with real numbers instead of a guess.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border-subtle bg-card p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-subtle">Families making</p>
          <p className="mt-1 font-display text-2xl font-bold text-strong">{counted.length}</p>
          <p className="mt-1 text-xs text-muted">Excludes exempt, trialing, and sandbox.</p>
        </div>
        <div className="rounded-lg border border-border-subtle bg-card p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-subtle">Median made</p>
          <p className="mt-1 font-display text-2xl font-bold text-strong">{median}</p>
          <p className="mt-1 text-xs text-muted">The number the allowance should be sized against.</p>
        </div>
        <div className="rounded-lg border border-border-subtle bg-card p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-subtle">Would be locked out</p>
          <p className="mt-1 font-display text-2xl font-bold text-strong">{wouldLock.length}</p>
          <p className="mt-1 text-xs text-muted">Already past the allowance in this window.</p>
        </div>
      </div>

      <div className="mt-8">
        <SectionHead
          eyebrow="Per family"
          title="This window"
          sub="Busiest first. A predicted date assumes the pace they have kept since Monday."
        />
        {readings.length === 0 ? (
          <EmptyNote>Nobody has made anything since Monday.</EmptyNote>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[46rem] text-sm">
              <thead>
                <tr className="border-b border-border-subtle text-left text-xs uppercase tracking-wide text-subtle">
                  <th className="py-2 pr-3 font-semibold">Family</th>
                  <th className="py-2 pr-3 font-semibold">Week</th>
                  <th className="py-2 pr-3 font-semibold">Made</th>
                  <th className="py-2 pr-3 font-semibold">Allowance</th>
                  <th className="py-2 pr-3 font-semibold">Would run out</th>
                  <th className="py-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {readings.map((reading) => {
                  const name = names.get(reading.familyId) ?? "";
                  return (
                    <tr key={reading.familyId} className="border-b border-border-subtle/60">
                      <td className="py-2 pr-3 text-strong">
                        {familyDisplayName(name)}
                      </td>
                      <td className="py-2 pr-3 font-mono text-xs text-muted">
                        {reading.weekIndex + 1}
                      </td>
                      <td className="py-2 pr-3 font-mono text-strong">{reading.used}</td>
                      <td className="py-2 pr-3 font-mono text-muted">{reading.allowance}</td>
                      <td className="py-2 pr-3 text-muted">
                        {reading.exemption
                          ? "n/a"
                          : formatWhen(reading.predictedLockoutAt)}
                      </td>
                      <td className="py-2">
                        {reading.exemption ? (
                          <Pill tone="stone">{reading.exemption.replace("_", " ")}</Pill>
                        ) : reading.remaining === 0 ? (
                          <Pill tone="gold">at the cap</Pill>
                        ) : (
                          <Pill tone="sage">{reading.remaining} left</Pill>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
