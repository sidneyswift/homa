import type { Metadata } from "next";

import { requireFounder } from "../../../lib/admin/gate";
import { familyDisplayName } from "../../../lib/admin/format";
import { readFleetMakings } from "../../../lib/onboarding/makings";
import { mapDb } from "../../../lib/map/db";
import { EmptyNote, SectionHead } from "../ui";

/**
 * /admin/makings: what families actually make in a week.
 *
 * Counting, not metering. No allowance, no projected cutoff, no limit
 * anywhere in the code behind this page. Whether there should ever be
 * one is an open question
 * (docs/homa-planning/plans/2026-07-21-onboarding-open-decisions.md), and
 * putting a number on screen before it is answered would quietly turn a
 * guess into the default.
 *
 * The point of the page is the shape of the list: how far apart the
 * busiest and the typical family are, and whether a week is even the
 * right unit. That is what any later decision needs.
 */

export const metadata: Metadata = { title: "What families make" };

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

  // Exempt, trialing and test families are read separately: their
  // behavior cannot stand in for a family deciding whether to pay.
  const counted = readings.filter((reading) => reading.excluded === null);
  const sorted = counted.map((reading) => reading.made).sort((a, b) => a - b);
  const median = sorted.length > 0 ? sorted[Math.floor(sorted.length / 2)] : 0;
  const busiest = sorted.length > 0 ? sorted[sorted.length - 1] : 0;
  const total = counted.reduce((sum, reading) => sum + reading.made, 0);

  const tiles = [
    {
      label: "Families making",
      value: counted.length,
      note: "Excludes exempt, trialing, test.",
    },
    { label: "Median", value: median, note: "The typical family's week." },
    { label: "Busiest", value: busiest, note: "The most any one family made." },
    { label: "Total made", value: total, note: "Across counted families." },
  ];

  return (
    <div>
      <p className="font-mono text-[0.64rem] font-bold uppercase tracking-[0.13em] text-subtle">
        Founder · what families make
      </p>
      <h1 className="mt-1 font-display text-2xl font-bold text-strong">
        This week, Monday to Monday
      </h1>
      <p className="mt-1 max-w-2xl text-sm text-muted">
        Artifacts each family made: worksheets, coloring pages, lesson worksheets, month
        plans. Revisions of the same thing count once. Nothing here limits anything, and
        no number on this page is enforced anywhere in the product.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-4">
        {tiles.map((tile) => (
          <div
            key={tile.label}
            className="rounded-lg border border-border-subtle bg-card p-4"
          >
            <p className="text-xs font-bold uppercase tracking-wide text-subtle">
              {tile.label}
            </p>
            <p className="mt-1 font-display text-2xl font-bold text-strong">
              {tile.value}
            </p>
            <p className="mt-1 text-xs text-muted">{tile.note}</p>
          </div>
        ))}
      </div>

      <div className="mt-8">
        <SectionHead
          eyebrow="Per family"
          title="Busiest first"
          sub="Their week counts from that family's own signup, so a first week reads differently from a sixth."
        />
        {readings.length === 0 ? (
          <EmptyNote>Nobody has made anything since Monday.</EmptyNote>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <thead>
                <tr className="border-b border-border-subtle text-left text-xs uppercase tracking-wide text-subtle">
                  <th className="py-2 pr-3 font-semibold">Family</th>
                  <th className="py-2 pr-3 font-semibold">Their week</th>
                  <th className="py-2 pr-3 font-semibold">Made</th>
                  <th className="py-2 font-semibold">What</th>
                </tr>
              </thead>
              <tbody>
                {readings.map((reading) => (
                  <tr key={reading.familyId} className="border-b border-border-subtle/60">
                    <td className="py-2 pr-3 text-strong">
                      {familyDisplayName(names.get(reading.familyId) ?? "")}
                      {reading.excluded ? (
                        <span className="ml-2 text-xs text-subtle">
                          {reading.excluded.replace("_", " ")}
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2 pr-3 font-mono text-xs text-muted">
                      {reading.weekIndex + 1}
                    </td>
                    <td className="py-2 pr-3 font-mono text-strong">{reading.made}</td>
                    <td className="py-2 text-xs text-muted">
                      {reading.titles.slice(0, 3).join(" · ")}
                      {reading.titles.length > 3
                        ? ` and ${reading.titles.length - 3} more`
                        : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
