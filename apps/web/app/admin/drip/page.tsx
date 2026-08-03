import type { Metadata } from "next";
import Link from "next/link";

import { requireFounder } from "../../../lib/admin/gate";
import { getDripData } from "../../../lib/admin/drip-data";
import { familyDisplayName, percent, timeAgo } from "../../../lib/admin/format";
import { dripEnabled } from "../../../lib/drip/flag";
import { dripQueueSnapshot } from "../../../lib/drip/sweep";
import { EmptyNote, Pill, SectionHead, Tile, statusTone } from "../ui";

/**
 * /admin/drip: what the onboarding drip sent, why it picked that family,
 * whether it landed, and whether it worked.
 *
 * "Worked" is the nudge's own stated target (lib/drip/labels.ts) happening
 * inside the attribution window, and it is only scored once that window
 * closes. Everything still inside its window reads "waiting", never zero, so
 * a nudge sent an hour ago is never mistaken for one that failed.
 */

export const metadata: Metadata = { title: "Drip" };

export default async function AdminDripPage() {
  await requireFounder();
  const data = await getDripData();
  const queue = await dripQueueSnapshot();
  const live = dripEnabled();

  return (
    <div data-brand-surface="admin-drip" className="quiet-admin__child">
      <p className="font-mono text-[0.64rem] font-bold uppercase tracking-[0.13em] text-subtle">
        Founder · drip
      </p>
      <h1 className="mt-1 font-display text-2xl font-bold text-strong">
        What the drip sent, and whether it worked
      </h1>
      <p className="mt-1 max-w-2xl text-sm text-muted">
        Every nudge aims at one action. A send counts as working when that
        action happens within {data.attributionDays} days. That is correlation,
        not proof: there is no holdout, so a family who would have come back
        anyway still counts.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Pill tone={live ? "sage" : "stone"}>
          {live ? "Sending (HOMA_DRIP_ENABLED on)" : "Off (HOMA_DRIP_ENABLED unset)"}
        </Pill>
        <Pill tone="outline">{queue.considered} families scanned each tick</Pill>
        {queue.capped ? (
          <Pill tone="gold">Backlog: only 5 go out per hour</Pill>
        ) : null}
      </div>

      <SectionHead eyebrow="Totals" title="Every drip send so far" />
      <div className="mt-3 flex flex-wrap gap-2">
        <Tile label="Sent" value={String(data.totals.sent)} sub="to real families" />
        <Tile
          label="Delivered"
          value={String(data.totals.delivered)}
          sub={`${percent(data.totals.delivered, data.totals.sent)} of sent`}
          subTone="sage"
        />
        <Tile
          label="Failed"
          value={String(data.totals.failed)}
          sub={data.totals.failed > 0 ? "bounced or complained" : "none"}
          subTone={data.totals.failed > 0 ? "rose" : "muted"}
        />
        <Tile
          label="Worked"
          value={
            data.totals.settled > 0
              ? `${data.totals.worked}/${data.totals.settled}`
              : "too early"
          }
          sub={
            data.totals.settled > 0
              ? `${percent(data.totals.worked, data.totals.settled)} of settled`
              : `all ${data.totals.pending} still inside the window`
          }
          subTone={data.totals.settled > 0 ? "sage" : "muted"}
        />
        <Tile
          label="Unsubscribed"
          value={String(data.totals.unsubscribed)}
          sub={data.totals.unsubscribed > 0 ? "asked to stop" : "nobody yet"}
          subTone={data.totals.unsubscribed > 0 ? "gold" : "muted"}
        />
      </div>

      <SectionHead
        eyebrow="By nudge"
        title="Each nudge against the action it aims at"
        sub="Worked is counted only over settled sends, the ones whose window has closed."
      />
      <div className="mt-3 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              {["Nudge", "Aims at", "Sent", "Delivered", "Failed", "Worked", "Waiting", "Unsub"].map(
                (head) => (
                  <th
                    key={head}
                    className="border border-border-subtle bg-[var(--homa-canvas)] px-3 py-1.5 text-left font-mono text-[0.62rem] font-bold uppercase tracking-[0.08em] text-subtle"
                  >
                    {head}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {data.scorecard.map((row) => (
              <tr key={row.kind}>
                <td className="border border-border-subtle px-3 py-2">
                  <span className="font-bold text-strong">{row.label}</span>
                  <span className="block text-[0.7rem] text-subtle">{row.audience}</span>
                </td>
                <td className="border border-border-subtle px-3 py-2 text-[0.78rem] text-muted">
                  {row.target}
                </td>
                <td className="border border-border-subtle px-3 py-2 font-mono">{row.sent}</td>
                <td className="border border-border-subtle px-3 py-2 font-mono">{row.delivered}</td>
                <td
                  className="border border-border-subtle px-3 py-2 font-mono"
                  style={row.failed > 0 ? { color: "var(--homa-error-ink)", fontWeight: 700 } : undefined}
                >
                  {row.failed}
                </td>
                <td className="border border-border-subtle px-3 py-2 font-mono">
                  {row.settled > 0 ? (
                    <>
                      {row.worked}/{row.settled}
                      <span className="ml-1 text-[0.7rem] text-subtle">
                        {percent(row.worked, row.settled)}
                      </span>
                    </>
                  ) : (
                    <span className="text-subtle">too early</span>
                  )}
                </td>
                <td className="border border-border-subtle px-3 py-2 font-mono text-subtle">
                  {row.pending}
                </td>
                <td className="border border-border-subtle px-3 py-2 font-mono">
                  {row.unsubscribed}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <SectionHead
        eyebrow="Queue"
        title="Who the drip would email next"
        sub="Produced by the same planner that does the sending, so this is what will actually go out."
      />
      {queue.entries.length === 0 ? (
        <EmptyNote>Nobody is eligible right now. Every family is either served, quiet by choice, or too new.</EmptyNote>
      ) : (
        <ul className="mt-3 flex flex-col gap-1.5 text-sm">
          {queue.entries.map((entry) => (
            <li
              key={`${entry.familyId}-${entry.kind}`}
              className="flex flex-wrap items-center gap-2 rounded-md border border-border-subtle bg-card px-3.5 py-2 shadow-sm"
            >
              {entry.nextTick ? <Pill tone="sage">next hour</Pill> : <Pill tone="outline">queued</Pill>}
              <Link
                href={`/admin/families/${entry.familyId}`}
                className="font-bold text-strong hover:underline"
              >
                {entry.familyFirstName ?? "Family not set up"}
              </Link>
              <span className="text-subtle">{entry.reason}</span>
            </li>
          ))}
        </ul>
      )}

      <SectionHead
        eyebrow="Sends"
        title="Every send, and why that family got it"
        sub="The reason is recorded at send time, so it says why she was picked then, not what is true now."
      />
      {data.recent.length === 0 ? (
        <EmptyNote>
          No drip email has been sent to a family yet. Founder previews are excluded here on purpose.
        </EmptyNote>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                {["Family", "Nudge", "Why", "Delivery", "Outcome", "Sent"].map((head) => (
                  <th
                    key={head}
                    className="border border-border-subtle bg-[var(--homa-canvas)] px-3 py-1.5 text-left font-mono text-[0.62rem] font-bold uppercase tracking-[0.08em] text-subtle"
                  >
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.recent.map((row) => (
                <tr key={row.id}>
                  <td className="border border-border-subtle px-3 py-2">
                    <Link
                      href={`/admin/families/${row.familyId}`}
                      className="font-bold text-strong hover:underline"
                    >
                      {row.firstName ?? familyDisplayName(row.familyName ?? "")}
                    </Link>
                  </td>
                  <td className="border border-border-subtle px-3 py-2">{row.label}</td>
                  <td className="border border-border-subtle px-3 py-2 text-[0.78rem] text-muted">
                    {row.reason ?? "not recorded"}
                  </td>
                  <td className="border border-border-subtle px-3 py-2">
                    <Pill tone={statusTone(row.status)}>{row.status}</Pill>
                  </td>
                  <td className="border border-border-subtle px-3 py-2">
                    {row.worked ? (
                      <Pill tone="sage">worked</Pill>
                    ) : row.pending ? (
                      <Pill tone="outline">waiting</Pill>
                    ) : (
                      <Pill tone="stone">no change</Pill>
                    )}
                    {row.unsubscribed ? <Pill tone="gold">unsubscribed</Pill> : null}
                  </td>
                  <td className="border border-border-subtle px-3 py-2 text-subtle">
                    {timeAgo(row.sentAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-6">
        <Pill tone="stone">
          Opens and clicks are not tracked: no pixel, no rewritten links. Outcome is measured by what
          the family did.
        </Pill>
      </div>
    </div>
  );
}
