import type { Metadata } from "next";
import Link from "next/link";

import { requireFounder } from "../../../lib/admin/gate";
import { getFunnelData } from "../../../lib/admin/funnel-data";
import { familyDisplayName, percent, timeAgo } from "../../../lib/admin/format";
import { EmptyNote, Pill, SectionHead } from "../ui";
import { DripPreview } from "./drip-preview";

/**
 * /admin/funnels: two conveyor belts (lab direction 4). The human funnel
 * from typed events, the machine pipeline from runs and deliveries, and
 * signup cohorts by weekly activity. Stage counts are era counts
 * (distinct families emitting the event in the window), stated on the
 * page so the numbers are never mistaken for one strict cohort.
 */

export const metadata: Metadata = { title: "Funnels" };

export default async function AdminFunnelsPage() {
  const founder = await requireFounder();
  const data = await getFunnelData(28);
  const max = Math.max(...data.stages.map((stage) => stage.count), 1);
  // Only cards anyone has reached yet: the event just shipped, so most read
  // zero until families flow through. An empty list says so rather than
  // printing eleven zero-rows.
  const reachedSteps = data.stepFunnel.filter((step) => step.count > 0);
  const stepMax = Math.max(...reachedSteps.map((step) => step.count), 1);

  return (
    <div>
      <p className="font-mono text-[0.64rem] font-bold uppercase tracking-[0.13em] text-subtle">
        Founder · funnels &amp; flows
      </p>
      <h1 className="mt-1 font-display text-2xl font-bold text-strong">
        Two conveyor belts, last {data.windowDays} days
      </h1>
      <p className="mt-1 max-w-2xl text-sm text-muted">
        Humans on top, the machine underneath. Each stage counts distinct families with that event in
        the window.
      </p>

      <SectionHead eyebrow="Humans" title="Signup to trial" />
      <p className="mt-1 max-w-2xl text-sm text-muted">
        &quot;Signup screen opened&quot; includes people who never finished Google or
        email/password. &quot;Signed up&quot; is a completed account. &quot;Setup done&quot; is
        create-your-family finished.
      </p>
      <div className="mt-3 flex flex-col gap-1.5">
        {data.stages.map((stage, index) => {
          const previous = index > 0 ? data.stages[index - 1].count : null;
          return (
            <div key={stage.key}>
              <div className="grid grid-cols-[minmax(120px,180px)_1fr_60px] items-center gap-3 rounded-md border border-border-subtle bg-card px-3.5 py-2 shadow-sm">
                <span>
                  <span className="text-sm font-bold text-strong">{stage.name}</span>
                  <span className="block font-mono text-[0.62rem] text-subtle">{stage.source}</span>
                </span>
                <span className="h-5 overflow-hidden rounded-md bg-[var(--surface-sunken)]">
                  <span
                    className="block h-full rounded-md"
                    style={{
                      width: `${Math.max(2, Math.round((stage.count / max) * 100))}%`,
                      background: "linear-gradient(90deg, var(--clay-300), var(--clay-500))",
                    }}
                  />
                </span>
                <span className="text-right font-mono text-sm font-bold text-strong">{stage.count}</span>
              </div>
              {previous !== null && previous > 0 ? (
                <p className="ml-[calc(min(180px,30%)+12px)] py-0.5 text-[0.7rem] text-subtle">
                  {percent(stage.count, previous)} of the previous stage
                </p>
              ) : null}
            </div>
          );
        })}
      </div>

      <SectionHead
        eyebrow="Humans"
        title="Per onboarding card"
        sub="Distinct families that reached each card, from map.step_viewed. This is where per-card drop-off finally shows up; the account card is the first one after signup."
      />
      {reachedSteps.length === 0 ? (
        <EmptyNote>
          No per-card data yet. This fills in as families move through onboarding
          after the map.step_viewed beacon ships.
        </EmptyNote>
      ) : (
        <div className="mt-3 flex flex-col gap-1.5">
          {reachedSteps.map((step, index) => {
            const previous = index > 0 ? reachedSteps[index - 1].count : null;
            return (
              <div key={step.step}>
                <div className="grid grid-cols-[minmax(120px,200px)_1fr_60px] items-center gap-3 rounded-md border border-border-subtle bg-card px-3.5 py-2 shadow-sm">
                  <span>
                    <span className="text-sm font-bold text-strong">{step.label}</span>
                    <span className="block font-mono text-[0.62rem] text-subtle">{step.step}</span>
                  </span>
                  <span className="h-5 overflow-hidden rounded-md bg-[var(--surface-sunken)]">
                    <span
                      className="block h-full rounded-md"
                      style={{
                        width: `${Math.max(2, Math.round((step.count / stepMax) * 100))}%`,
                        background: "linear-gradient(90deg, var(--sage-300), var(--sage-500))",
                      }}
                    />
                  </span>
                  <span className="text-right font-mono text-sm font-bold text-strong">{step.count}</span>
                </div>
                {previous !== null && previous > 0 ? (
                  <p className="ml-[calc(min(200px,30%)+12px)] py-0.5 text-[0.7rem] text-subtle">
                    {percent(step.count, previous)} of the previous card
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      <SectionHead
        eyebrow="Onboarding drip"
        title="Nudge previews (off by default)"
        sub="The stage-aware drip is wired but dark. Preview each nudge in your own inbox before it ships to anyone."
      />
      <DripPreview founderEmail={founder.email} />

      <SectionHead
        eyebrow="Parked right now"
        title="Who is stuck between stages"
        sub="Current state, not window-scoped: these are the families sitting between stages today."
      />
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {(
          [
            ["Signed up, setup not finished", data.stuck.accountNoSetup],
            ["Setup done, no report yet", data.stuck.setupNoReport],
          ] as const
        ).map(([label, families]) => (
          <div key={label} className="rounded-lg border border-border-subtle bg-card p-4 shadow-sm">
            <p className="text-[0.72rem] font-bold text-muted">{label}</p>
            {families.length === 0 ? (
              <p className="mt-2 text-sm text-subtle">Nobody is parked here.</p>
            ) : (
              <ul className="mt-2 flex flex-col gap-1.5 text-sm">
                {families.map((family) => (
                  <li key={family.id} className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/admin/families/${family.id}`}
                      className="font-bold text-strong hover:underline"
                    >
                      {familyDisplayName(family.name)}
                    </Link>
                    <span className="text-subtle">
                      joined {timeAgo(family.createdAt)} · {family.note}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>

      <SectionHead eyebrow="Machine" title="Scheduled sends" />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {data.pipeline.map((node, index) => (
          <span key={node.key} className="flex items-center gap-2">
            <span
              className="rounded-md border bg-card px-3.5 py-2 shadow-sm"
              style={{
                borderColor:
                  node.tone === "fail"
                    ? "var(--rose-500)"
                    : node.tone === "warn"
                      ? "var(--gold-300)"
                      : "var(--border-subtle)",
              }}
            >
              <b
                className="block font-display text-lg leading-tight"
                style={{
                  color:
                    node.tone === "fail"
                      ? "var(--rose-600)"
                      : node.tone === "warn"
                        ? "var(--gold-ink)"
                        : "var(--text-strong)",
                }}
              >
                {node.count}
              </b>
              <span className="text-xs font-semibold text-body">{node.label}</span>
              <span className="block font-mono text-[0.6rem] text-subtle">{node.source}</span>
            </span>
            {index < data.pipeline.length - 1 ? (
              <span aria-hidden="true" className="text-subtle">
                &rarr;
              </span>
            ) : null}
          </span>
        ))}
      </div>

      <SectionHead
        eyebrow="Cohorts"
        title="Families active each week after signup"
        sub="Active means at least one message that week. Dots are weeks that have not happened yet."
      />
      {data.cohorts.length === 0 ? (
        <EmptyNote>No signups in the last six weeks to build cohorts from.</EmptyNote>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full max-w-xl border-collapse text-sm">
            <thead>
              <tr>
                {["Cohort", "W1", "W2", "W3", "W4"].map((head) => (
                  <th
                    key={head}
                    className="border border-border-subtle bg-[var(--surface-sunken)] px-3 py-1.5 text-center font-mono text-[0.62rem] font-bold uppercase tracking-[0.08em] text-subtle"
                  >
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.cohorts.map((cohort) => (
                <tr key={cohort.weekStart}>
                  <td className="border border-border-subtle px-3 py-1.5 font-mono text-xs text-muted">
                    {cohort.weekStart} · {cohort.size} fam
                  </td>
                  {cohort.activeByWeek.map((value, index) => (
                    <td
                      key={index}
                      className="border border-border-subtle px-3 py-1.5 text-center"
                      style={
                        value === null
                          ? { color: "var(--text-subtle)" }
                          : value === cohort.size && cohort.size > 0
                            ? { background: "var(--sage-50)", color: "var(--sage-700)", fontWeight: 700 }
                            : { background: "var(--surface-sunken)" }
                      }
                    >
                      {value === null ? "\u00b7" : value}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-6">
        <Pill tone="stone">Map visits live in Vercel Analytics, outside this database</Pill>
      </div>
    </div>
  );
}
