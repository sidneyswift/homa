import type { Metadata } from "next";
import Link from "next/link";

import { requireFounder } from "../../lib/admin/gate";
import { getFleetOverview, type OverviewRange } from "../../lib/admin/overview-data";
import { formatInt, formatTokens, medianExact, percent, timeAgo } from "../../lib/admin/format";
import { formatUsd } from "../../lib/model-pricing";
import { QUIET_AFTER_DAYS } from "../../lib/admin/stage";
import { AlertRow, EmptyNote, Pill, SectionHead, Spark, statusTone, Tile } from "./ui";

/**
 * /admin: mission control (MJ-14 tile 1..12 shape, refit to the signals
 * that exist today). Alerts first, then the tiles, then the lists a
 * Monday morning actually needs: trouble, new signups, the call list.
 */

export const metadata: Metadata = { title: "Overview" };

export default async function AdminOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  await requireFounder();
  const params = await searchParams;
  const rangeDays: OverviewRange = params.range === "28d" ? 28 : 7;
  const data = await getFleetOverview(rangeDays);

  const runsOk = (data.runCounts.done ?? 0) + (data.runCounts.skipped ?? 0);
  const runsTotal = Object.values(data.runCounts).reduce((sum, n) => sum + n, 0);
  const runsBad = (data.runCounts.failed ?? 0);
  const runsShaky =
    (data.runCounts.uncertain ?? 0) +
    (data.runCounts.partial ?? 0) +
    (data.runCounts.partial_uncertain ?? 0);
  const deliveriesSent = data.deliveryCounts.sent ?? 0;
  const deliveriesFailed = data.deliveryCounts.failed ?? 0;
  const deliveriesUncertain = data.deliveryCounts.uncertain ?? 0;
  const quiet = data.snapshots.filter((s) => s.stage === "quiet");
  const midOnboarding = data.snapshots.filter((s) => s.stage === "new" || s.stage === "onboarding");
  const trials = data.snapshots.filter((s) => s.trialStartedAt !== null);
  const paying = data.snapshots.filter(
    (s) => s.subscriptionStatus === "active" || s.subscriptionStatus === "trialing",
  );
  const costPerFamily = data.snapshots.filter((s) => s.cost28dUsd > 0).map((s) => s.cost28dUsd);
  const emailSubmitted =
    (data.emailCounts.submitted ?? 0) + (data.emailCounts.delivered ?? 0);
  const emailTroubleCount =
    (data.emailCounts.rejected ?? 0) + (data.emailCounts.bounced ?? 0) + (data.emailCounts.complained ?? 0);
  const cronLate = data.cronLate;

  const rangeLabel = rangeDays === 7 ? "this week" : "last 4 weeks";

  return (
    <div>
      <p className="font-mono text-[0.64rem] font-bold uppercase tracking-[0.13em] text-subtle">
        Founder · fleet overview
      </p>
      <h1 className="mt-1 font-display text-2xl font-bold text-strong">
        {data.snapshots.length} families, one glance
      </h1>
      <div className="mt-3 inline-flex rounded-pill border border-border-subtle bg-card p-0.5 text-sm font-semibold">
        <Link
          href="/admin"
          className={`rounded-pill px-3.5 py-1.5 ${rangeDays === 7 ? "bg-[var(--stone-800)] text-white" : "text-muted"}`}
        >
          This week
        </Link>
        <Link
          href="/admin?range=28d"
          className={`rounded-pill px-3.5 py-1.5 ${rangeDays === 28 ? "bg-[var(--stone-800)] text-white" : "text-muted"}`}
        >
          Last 4 weeks
        </Link>
      </div>

      <div className="mt-4 flex flex-col gap-2">
        {data.deliveryTrouble.length === 0 && data.emailTrouble.length === 0 && data.runTrouble.length === 0 ? (
          <AlertRow tone="sky">
            <b>Deliveries look clean {rangeLabel}.</b> No failed or uncertain sends recorded.
          </AlertRow>
        ) : (
          <>
            {data.deliveryTrouble.slice(0, 4).map((t, index) => (
              <AlertRow key={`d-${index}`} tone={t.status === "failed" ? "rose" : "gold"}>
                <b>{t.status === "failed" ? "Failed" : "Uncertain"} {t.channel} send</b> ·{" "}
                {t.familyName} · {t.error ?? "no provider receipt"} · {timeAgo(t.at)}
              </AlertRow>
            ))}
            {data.runTrouble.slice(0, 4).map((t, index) => (
              <AlertRow key={`r-${index}`} tone={t.status === "failed" ? "rose" : "gold"}>
                <b>{t.kind.replace(/_/g, " ")} run {t.status.replace(/_/g, " ")}</b> ·{" "}
                {t.familyName ?? "fleet"} · {t.error ?? "no error recorded"} · {timeAgo(t.at)}
              </AlertRow>
            ))}
            {data.emailTrouble.slice(0, 3).map((t, index) => (
              <AlertRow key={`e-${index}`} tone="rose">
                <b>Email {t.status}</b> · {t.kind.replace(/_/g, " ")} · {t.error ?? "provider receipt"} ·{" "}
                {timeAgo(t.at)}
              </AlertRow>
            ))}
          </>
        )}
        {quiet.length > 0 ? (
          <AlertRow tone="sky">
            <b>
              {quiet.length} {quiet.length === 1 ? "family" : "families"} on the call list
            </b>{" "}
            ({QUIET_AFTER_DAYS}+ quiet days): {quiet.map((s) => s.name).join(", ")}. A call, not a nudge.
          </AlertRow>
        ) : null}
        {cronLate ? (
          <AlertRow tone="gold">
            <b>The hourly cron looks stale.</b> Last heartbeat {timeAgo(data.cronLastAt)}.
          </AlertRow>
        ) : null}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        <Tile
          label="Families active"
          value={`${data.activeFamilies} of ${data.snapshots.length}`}
          sub={`sent anything ${rangeLabel}`}
          subTone="sage"
        />
        <Tile
          label="New signups"
          value={String(data.newSignups.length)}
          sub={data.newSignups.length ? data.newSignups.map((s) => s.name).slice(0, 3).join(", ") : `none ${rangeLabel}`}
          subTone={data.newSignups.length ? "sage" : "muted"}
        />
        <Tile
          label="Mid-onboarding"
          value={String(midOnboarding.length)}
          sub="account open, report not reached"
          subTone={midOnboarding.length ? "gold" : "muted"}
        />
        <Tile
          label="Task runs"
          value={`${runsOk} of ${runsTotal || 0}`}
          sub={`${runsBad} failed · ${runsShaky} uncertain`}
          subTone={runsBad > 0 ? "rose" : runsShaky > 0 ? "gold" : "sage"}
        />
        <Tile
          label="Deliveries"
          value={String(deliveriesSent)}
          sub={`${deliveriesFailed} failed · ${deliveriesUncertain} uncertain`}
          subTone={deliveriesFailed > 0 ? "rose" : deliveriesUncertain > 0 ? "gold" : "sage"}
        />
        <Tile
          label="Replies to sends"
          value={percent(data.replies, deliveriesSent)}
          sub={`${data.replies} of ${deliveriesSent} sent`}
        />
        <Tile
          label="Quiet 14d+"
          value={String(quiet.length)}
          sub="the call list, never a nudge list"
          subTone={quiet.length ? "gold" : "sage"}
        />
        <div className="rounded-lg border border-border-subtle bg-card p-4 shadow-sm">
          <p className="text-[0.72rem] font-bold text-muted">Messages from families</p>
          <p className="mt-1 font-display text-[1.55rem] font-semibold leading-none text-strong">
            {formatInt(data.userMessages)}
          </p>
          <div className="mt-1.5">
            <Spark values={data.messagesByDay.length > 1 ? data.messagesByDay : [0, 0]} />
          </div>
        </div>
        <Tile label="Materials made" value={String(data.materialsCount)} sub="printables, all channels" />
        <Tile
          label="Hours logged"
          value={`${(data.hoursMinutes / 60).toFixed(1)}h`}
          sub="hours_log rows"
        />
        <Tile
          label="Trials + paying"
          value={`${trials.length}`}
          sub={
            paying.length > 0
              ? `${paying.length} with a live Stripe subscription`
              : "subscription mirror fills once the Stripe webhook is configured"
          }
          subTone={paying.length > 0 ? "sage" : "muted"}
        />
        <Tile
          label="AI cost (est)"
          value={formatUsd(data.modelCost.estimatedUsd)}
          sub={
            data.modelCost.unpricedModels.length > 0
              ? `no price on file: ${data.modelCost.unpricedModels.join(", ")} · add it to lib/model-pricing.ts`
              : `${formatTokens(data.modelTokens)} tokens · ${formatInt(data.modelCalls)} calls · P50 ${formatUsd(medianExact(costPerFamily))}/family (28d)`
          }
          subTone={data.modelCost.unpricedModels.length > 0 ? "gold" : "muted"}
        />
        <Tile
          label="Map emails"
          value={String(emailSubmitted)}
          sub={
            emailSubmitted + emailTroubleCount === 0
              ? "ledger live, next sends will land here"
              : `${emailTroubleCount} rejected or bounced`
          }
          subTone={emailTroubleCount > 0 ? "rose" : "muted"}
        />
        <Tile
          label="Cron heartbeat"
          value={data.cronLastAt ? timeAgo(data.cronLastAt) : "no ticks yet"}
          sub={
            data.cronLastAt
              ? data.cronLastOk
                ? "last tick ok"
                : "last tick errored"
              : "first heartbeat lands on the next hourly tick"
          }
          subTone={data.cronLastAt ? (data.cronLastOk && !cronLate ? "sage" : "rose") : "muted"}
        />
      </div>

      <SectionHead
        eyebrow="Needs a look first"
        title="Trouble, line by line"
        sub="Failed and uncertain sends with the family they belong to. Uncertain means the provider never confirmed; it is its own bucket on purpose."
      />
      {data.deliveryTrouble.length === 0 && data.emailTrouble.length === 0 && data.runTrouble.length === 0 ? (
        <EmptyNote>Nothing failed or went uncertain {rangeLabel}.</EmptyNote>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {data.deliveryTrouble.map((t, index) => (
            <li
              key={index}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-border-subtle bg-card px-3.5 py-2.5 text-sm shadow-sm"
            >
              <span className="font-bold text-strong">{t.familyName}</span>
              <Pill tone={statusTone(t.status)}>{t.status}</Pill>
              <span className="text-muted">
                {t.channel} · {t.error ?? "no provider receipt"} · {timeAgo(t.at)}
              </span>
            </li>
          ))}
          {data.runTrouble.map((t, index) => (
            <li
              key={`rt-${index}`}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-border-subtle bg-card px-3.5 py-2.5 text-sm shadow-sm"
            >
              <span className="font-bold text-strong">{t.familyName ?? "Fleet"}</span>
              <Pill tone={statusTone(t.status)}>{t.status.replace(/_/g, " ")}</Pill>
              <span className="text-muted">
                {t.kind.replace(/_/g, " ")} run · {t.error ?? "no error recorded"} · {timeAgo(t.at)}
              </span>
            </li>
          ))}
          {data.emailTrouble.map((t, index) => (
            <li
              key={`et-${index}`}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-border-subtle bg-card px-3.5 py-2.5 text-sm shadow-sm"
            >
              <span className="font-bold text-strong">{t.kind.replace(/_/g, " ")}</span>
              <Pill tone={statusTone(t.status)}>{t.status}</Pill>
              <span className="text-muted">{t.error ?? "provider receipt"} · {timeAgo(t.at)}</span>
            </li>
          ))}
        </ul>
      )}

      <SectionHead
        eyebrow="People"
        title="New and quiet"
        sub="Who arrived, and who is worth a call this week."
      />
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-border-subtle bg-card p-4 shadow-sm">
          <p className="text-[0.72rem] font-bold text-muted">New {rangeLabel}</p>
          {data.newSignups.length === 0 ? (
            <p className="mt-2 text-sm text-subtle">No new families {rangeLabel}.</p>
          ) : (
            <ul className="mt-2 flex flex-col gap-1.5 text-sm">
              {data.newSignups.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-2">
                  <Link href={`/admin/families/${s.id}`} className="font-bold text-strong hover:underline">
                    {s.name}
                  </Link>
                  <Pill tone={s.stage === "new" ? "sky" : s.stage === "onboarding" ? "gold" : "sage"}>
                    {s.stage}
                  </Pill>
                  <span className="text-subtle">joined {timeAgo(s.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-lg border border-border-subtle bg-card p-4 shadow-sm">
          <p className="text-[0.72rem] font-bold text-muted">The call list</p>
          {quiet.length === 0 ? (
            <p className="mt-2 text-sm text-subtle">Nobody has crossed {QUIET_AFTER_DAYS} quiet days.</p>
          ) : (
            <ul className="mt-2 flex flex-col gap-1.5 text-sm">
              {quiet.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-2">
                  <Link href={`/admin/families/${s.id}`} className="font-bold text-strong hover:underline">
                    {s.name}
                  </Link>
                  <span className="text-subtle">
                    last heard {timeAgo(s.lastUserActivityAt)} · joined {timeAgo(s.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
