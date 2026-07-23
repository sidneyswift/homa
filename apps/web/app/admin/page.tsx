import type { Metadata } from "next";
import Link from "next/link";

import { requireFounder } from "../../lib/admin/gate";
import { getFleetOverview, type OverviewRange } from "../../lib/admin/overview-data";
import type { HandledAlert } from "../../lib/admin/alert-acks";
import { familyDisplayName, formatInt, formatTokens, medianExact, timeAgo } from "../../lib/admin/format";
import { formatUsd } from "../../lib/model-pricing";
import { QUIET_AFTER_DAYS, type FamilyStage } from "../../lib/admin/stage";
import { AgentPromptButton } from "./agent-prompt-button";
import { AlertAckButton } from "./alert-ack-button";
import { FamiliesTable, type FamiliesTableState, type TableDir, type TableSort } from "./families-table";
import { GrowthChart } from "./growth-chart";
import { MorningOfferFunnel } from "./morning-offer-funnel";
import { AlertRow, SectionHead, Spark, Tile } from "./ui";

/**
 * /admin: the founder's overview, rebuilt 2026-07-23 around five
 * questions in order: is anyone waiting on us, is the fleet growing, are
 * real families getting value, is the morning brief working, and who
 * should I call. Test families are out of every count by default
 * (?families=all widens them back in). Customer choices are never
 * alerts: STOP opt-outs live in the quiet "Stopped texting" list, and
 * engineering signals (task runs, cron, email plumbing) live in the
 * "System health" footnote, both at the bottom on purpose.
 * Every failure row keeps its Mark handled and Prompt for agent chips
 * (founder asks, 2026-07-13).
 */

export const metadata: Metadata = { title: "Overview" };

/** One line for a handled alert, matching the live alerts' wording. */
function handledAlertText(item: HandledAlert): string {
  const status = item.status.replace(/_/g, " ");
  const descriptor = item.descriptor.replace(/_/g, " ");
  switch (item.source) {
    case "task_run":
      return `${descriptor} run ${status} · ${item.familyName ?? "fleet"}`;
    case "delivery":
      return `${status} ${descriptor} send · ${item.familyName}`;
    case "email_send":
      return `Email ${status} · ${descriptor}`;
    case "inbound_receipt":
      return `${descriptor} turn never answered · ${item.familyName ?? "unlinked"}`;
    default: {
      const exhausted: never = item.source;
      return String(exhausted);
    }
  }
}

const STAGE_PARAMS: FamilyStage[] = ["new", "onboarding", "activated", "steady", "quiet"];

export default async function AdminOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{
    range?: string;
    handled?: string;
    families?: string;
    stage?: string;
    sort?: string;
    dir?: string;
    rows?: string;
  }>;
}) {
  await requireFounder();
  const params = await searchParams;
  const rangeDays: OverviewRange = params.range === "28d" ? 28 : 7;
  const includeTests = params.families === "all";
  const showHandled = params.handled === "1";
  const data = await getFleetOverview(rangeDays, { includeTests });

  const baseParams = new URLSearchParams();
  if (rangeDays === 28) baseParams.set("range", "28d");
  if (includeTests) baseParams.set("families", "all");
  const withParam = (key: string, value: string | null): string => {
    const next = new URLSearchParams(baseParams);
    if (value === null) next.delete(key);
    else next.set(key, value);
    const query = next.toString();
    return query ? `/admin?${query}` : "/admin";
  };

  const tableState: FamiliesTableState = {
    stage: STAGE_PARAMS.includes(params.stage as FamilyStage)
      ? (params.stage as FamilyStage)
      : null,
    sort: params.sort === "stage" || params.sort === "heard" ? (params.sort as TableSort) : "joined",
    dir: params.dir === "asc" ? ("asc" as TableDir) : "desc",
    allRows: params.rows === "all",
  };

  const runsOk = (data.runCounts.done ?? 0) + (data.runCounts.skipped ?? 0);
  const runsTotal = Object.values(data.runCounts).reduce((sum, n) => sum + n, 0);
  const runsBad = data.runCounts.failed ?? 0;
  const runsShaky =
    (data.runCounts.uncertain ?? 0) +
    (data.runCounts.partial ?? 0) +
    (data.runCounts.partial_uncertain ?? 0);
  const deliveriesSent = data.deliveryCounts.sent ?? 0;
  const quiet = data.snapshots.filter((s) => s.stage === "quiet");
  const costPerFamily = data.snapshots.filter((s) => s.cost28dUsd > 0).map((s) => s.cost28dUsd);
  const emailSubmitted =
    (data.emailCounts.submitted ?? 0) + (data.emailCounts.delivered ?? 0);
  const emailTroubleCount =
    (data.emailCounts.rejected ?? 0) + (data.emailCounts.bounced ?? 0) + (data.emailCounts.complained ?? 0);
  const sentTotal = deliveriesSent + emailSubmitted;
  const briefCount = data.morningOfferFunnel.deliveredOffers;
  const messagesPerActiveDay =
    data.activeFamilies > 0 ? data.userMessages / (data.activeFamilies * rangeDays) : null;

  const rangeLabel = rangeDays === 7 ? "this week" : "last 4 weeks";
  const waitingOnUs =
    data.offerTrouble.length > 0 ||
    data.inboundTrouble.length > 0 ||
    data.deliveryTrouble.length > 0 ||
    data.emailTrouble.length > 0;

  return (
    <div>
      <p className="font-mono text-[0.64rem] font-bold uppercase tracking-[0.13em] text-subtle">
        Founder · fleet overview
      </p>
      <h1 className="mt-1 font-display text-2xl font-bold text-strong">
        {data.snapshots.length} families
      </h1>
      <p className="mt-1 text-sm text-muted">
        {data.newSignups.length === 0
          ? `Nobody new joined ${rangeLabel}.`
          : `${data.newSignups.length} joined ${rangeLabel}.`}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-pill border border-border-subtle bg-card p-0.5 text-sm font-semibold">
          <Link
            href={includeTests ? "/admin?families=all" : "/admin"}
            className={`rounded-pill px-3.5 py-1.5 ${rangeDays === 7 ? "bg-[var(--stone-800)] text-white" : "text-muted"}`}
          >
            This week
          </Link>
          <Link
            href={includeTests ? "/admin?range=28d&families=all" : "/admin?range=28d"}
            className={`rounded-pill px-3.5 py-1.5 ${rangeDays === 28 ? "bg-[var(--stone-800)] text-white" : "text-muted"}`}
          >
            Last 4 weeks
          </Link>
        </div>
        <div className="inline-flex rounded-pill border border-border-subtle bg-card p-0.5 text-sm font-semibold">
          <Link
            href={rangeDays === 28 ? "/admin?range=28d" : "/admin"}
            className={`rounded-pill px-3.5 py-1.5 ${!includeTests ? "bg-[var(--stone-800)] text-white" : "text-muted"}`}
          >
            Customers
          </Link>
          <Link
            href={rangeDays === 28 ? "/admin?range=28d&families=all" : "/admin?families=all"}
            className={`rounded-pill px-3.5 py-1.5 ${includeTests ? "bg-[var(--stone-800)] text-white" : "text-muted"}`}
          >
            Everyone
          </Link>
        </div>
        <p className="text-xs text-subtle">
          {includeTests
            ? "Test families included. Counts are not customer truth."
            : `${data.sandboxCount} test families hidden.`}
        </p>
      </div>

      <div className="mt-4 flex flex-col gap-2">
        {!waitingOnUs ? (
          <AlertRow tone="sky">
            <b>Nobody is waiting on us {rangeLabel}.</b>{" "}
            {data.handledAlerts.length > 0
              ? `Everything that failed is marked handled (${data.handledAlerts.length}).`
              : "No family is missing a text, an email, or a promised worksheet."}
          </AlertRow>
        ) : (
          <>
            {data.offerTrouble.slice(0, 3).map((t) => (
              <AlertRow key={`o-${t.id}`} tone="rose">
                <b>{t.familyName} said yes and never got their material</b> · accepted{" "}
                {timeAgo(t.at)}, nothing was made
              </AlertRow>
            ))}
            {data.inboundTrouble.slice(0, 3).map((t) => (
              <AlertRow
                key={`i-${t.id}`}
                tone="rose"
                action={
                  <span className="inline-flex flex-wrap items-center justify-end gap-1.5">
                    <AlertAckButton source="inbound_receipt" sourceId={t.id} />
                  </span>
                }
              >
                <b>{t.familyName ?? "A family"} texted and never got an answer</b> · {t.channel}{" "}
                turn claimed {timeAgo(t.at)}
              </AlertRow>
            ))}
            {data.deliveryTrouble.slice(0, 4).map((t) => (
              <AlertRow
                key={`d-${t.id}`}
                tone={t.status === "failed" ? "rose" : "gold"}
                action={
                  <span className="inline-flex flex-wrap items-center justify-end gap-1.5">
                    <AgentPromptButton source="delivery" sourceId={t.id} />
                    <AlertAckButton source="delivery" sourceId={t.id} />
                  </span>
                }
              >
                <b>Can&apos;t reach {t.familyName}</b> · {t.channel} send{" "}
                {t.status === "failed" ? "failed" : "unconfirmed"} ·{" "}
                {t.error ?? "no provider receipt"} · {timeAgo(t.at)}
              </AlertRow>
            ))}
            {data.emailTrouble.slice(0, 3).map((t) => (
              <AlertRow
                key={`e-${t.id}`}
                tone="rose"
                action={
                  <span className="inline-flex flex-wrap items-center justify-end gap-1.5">
                    <AgentPromptButton source="email_send" sourceId={t.id} />
                    <AlertAckButton source="email_send" sourceId={t.id} />
                  </span>
                }
              >
                <b>
                  An email to {t.familyName ? familyDisplayName(t.familyName) : "a family"}{" "}
                  {t.status}
                </b>{" "}
                · {t.kind.replace(/_/g, " ")} · {timeAgo(t.at)}
              </AlertRow>
            ))}
          </>
        )}
        {quiet.length > 0 ? (
          <AlertRow tone="sky">
            <b>
              {quiet.length} {quiet.length === 1 ? "family" : "families"} on the call list
            </b>{" "}
            ({QUIET_AFTER_DAYS}+ quiet days): {quiet.map((s) => familyDisplayName(s.name)).join(", ")}. A call, not a nudge.
          </AlertRow>
        ) : null}
        {data.cronLate || data.cronLastOk === false ? (
          <AlertRow
            tone={data.cronLastOk === false ? "rose" : "gold"}
            action={<AgentPromptButton source="cron" sourceId="map_cron" />}
          >
            <b>Morning briefs may not go out.</b> The hourly cron{" "}
            {data.cronLastOk === false ? "errored on its last tick" : "looks stale"}; last
            heartbeat {timeAgo(data.cronLastAt)}.
          </AlertRow>
        ) : null}
        {data.handledAlerts.length > 0 ? (
          <p className="px-1 text-xs text-subtle">
            {data.handledAlerts.length} handled{" "}
            {data.handledAlerts.length === 1 ? "alert" : "alerts"} hidden {rangeLabel}.{" "}
            <Link
              href={showHandled ? withParam("handled", null) : `${withParam("handled", "1")}#handled`}
              className="font-semibold text-muted underline underline-offset-2 hover:text-strong"
            >
              {showHandled ? "Hide them" : "Show them"}
            </Link>
          </p>
        ) : null}
        {showHandled && data.handledAlerts.length > 0 ? (
          <ul id="handled" className="mt-1 flex flex-col gap-2">
            {data.handledAlerts.map((item) => (
              <li
                key={`h-${item.source}-${item.sourceId}`}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-dashed border-border-default bg-card px-3.5 py-2.5 text-sm"
              >
                <span className="font-semibold text-muted">{handledAlertText(item)}</span>
                <span className="text-subtle">
                  {item.error ?? "no error recorded"} · failed {timeAgo(item.at)} · handled{" "}
                  {timeAgo(item.handledAt)}
                </span>
                <span className="ml-auto inline-flex flex-wrap items-center justify-end gap-1.5">
                  {item.source !== "inbound_receipt" ? (
                    <AgentPromptButton source={item.source} sourceId={item.sourceId} />
                  ) : null}
                  <AlertAckButton source={item.source} sourceId={item.sourceId} mode="undo" />
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="mt-5 rounded-lg border border-border-subtle bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p className="text-[0.72rem] font-bold text-muted">Families over time</p>
          <p className="text-xs text-subtle">
            Every real signup, who opened an account, and who finished setup by adding a kid.
            The gaps are the funnel leaks.
          </p>
        </div>
        <div className="mt-2">
          <GrowthChart series={data.growth} />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile
          label="Families active"
          value={`${data.activeFamilies} of ${data.snapshots.length}`}
          sub={`messaged Homa ${rangeLabel}`}
          subTone="sage"
        />
        <div className="rounded-lg border border-border-subtle bg-card p-4 shadow-sm">
          <p className="text-[0.72rem] font-bold text-muted">Heard from families</p>
          <p className="mt-1 font-display text-[1.55rem] font-semibold leading-none text-strong">
            {formatInt(data.userMessages)}
          </p>
          <p className="mt-1.5 text-[0.72rem] text-subtle">
            {messagesPerActiveDay !== null
              ? `messages · about ${messagesPerActiveDay.toFixed(1)} a day per active family`
              : "messages"}
          </p>
          <div className="mt-1.5">
            <Spark values={data.messagesByDay.length > 1 ? data.messagesByDay : [0, 0]} />
          </div>
        </div>
        <Tile
          label="Sent to families"
          value={formatInt(sentTotal)}
          sub={
            data.undeliveredCount > 0
              ? `${data.undeliveredCount} did not arrive ${rangeLabel}`
              : `texts and emails · ${briefCount} morning briefs among them`
          }
          subTone={data.undeliveredCount > 0 ? "rose" : "muted"}
        />
        <Tile
          label="AI cost (est)"
          value={formatUsd(data.modelCost.estimatedUsd)}
          sub={
            data.modelCost.unpricedModels.length > 0
              ? `no price on file: ${data.modelCost.unpricedModels.join(", ")} · add it to lib/model-pricing.ts`
              : `${formatTokens(data.modelTokens)} tokens · ${formatInt(data.modelCalls)} calls · P50 ${formatUsd(medianExact(costPerFamily))}/family (28d) · ${
                  data.priceBook.source === "gateway" ? "gateway prices" : "pinned prices"
                }`
          }
          subTone={data.modelCost.unpricedModels.length > 0 ? "gold" : "muted"}
        />
      </div>

      <div className="mt-3">
        <MorningOfferFunnel
          summary={data.morningOfferFunnel}
          possibleInterest={data.possibleMorningBriefInterest}
          rangeLabel={rangeLabel}
        />
      </div>

      <SectionHead
        eyebrow="People"
        title="Every family"
        sub="Where each family is in the funnel, and when we last heard from them."
      />
      <FamiliesTable
        snapshots={data.snapshots}
        state={tableState}
        rangeDays={rangeDays}
        includeTests={includeTests}
      />

      <div className="mt-6 grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-border-subtle bg-card p-4 shadow-sm">
          <p className="text-[0.72rem] font-bold text-muted">Stopped texting</p>
          {data.optOuts.length === 0 ? (
            <p className="mt-2 text-sm text-subtle">Nobody has texted STOP {rangeLabel}.</p>
          ) : (
            <ul className="mt-2 flex flex-col gap-1.5 text-sm">
              {data.optOuts.map((o) => (
                <li key={o.familyId}>
                  <Link
                    href={`/admin/families/${o.familyId}`}
                    className="font-semibold text-muted hover:underline"
                  >
                    {familyDisplayName(o.familyName)}
                  </Link>{" "}
                  <span className="text-subtle">· {timeAgo(o.at)}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-subtle">
            Replying STOP is a choice, honored automatically. Reach out another way only if you
            know them.
          </p>
        </div>
        <div className="rounded-lg border border-border-subtle bg-card p-4 shadow-sm">
          <p className="text-[0.72rem] font-bold text-muted">System health</p>
          <ul className="mt-2 flex flex-col gap-1.5 text-sm text-muted">
            <li>
              Task runs · <span className="font-mono">{runsOk}</span> of{" "}
              <span className="font-mono">{runsTotal}</span> clean
              {runsBad + runsShaky > 0 ? (
                <>
                  {" "}
                  ·{" "}
                  <span className="font-semibold text-[var(--rose-600)]">
                    {runsBad} failed, {runsShaky} uncertain
                  </span>
                </>
              ) : null}
            </li>
            <li>
              Report emails · <span className="font-mono">{emailSubmitted}</span> sent
              {emailTroubleCount > 0 ? (
                <>
                  {" "}
                  ·{" "}
                  <span className="font-semibold text-[var(--rose-600)]">
                    {emailTroubleCount} rejected or bounced
                  </span>
                </>
              ) : null}
            </li>
            <li>
              Cron · last tick {timeAgo(data.cronLastAt)},{" "}
              {data.cronLastOk === false ? (
                <span className="font-semibold text-[var(--rose-600)]">errored</span>
              ) : (
                "ok"
              )}
            </li>
          </ul>
          {data.runTrouble.length > 0 ? (
            <ul className="mt-3 flex flex-col gap-1.5 border-t border-border-subtle pt-3 text-[0.78rem] text-subtle">
              {data.runTrouble.slice(0, 4).map((t) => (
                <li key={`rt-${t.id}`} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span>
                    {t.kind.replace(/_/g, " ")} run {t.status.replace(/_/g, " ")} ·{" "}
                    {t.familyName ? familyDisplayName(t.familyName) : "fleet"} ·{" "}
                    {t.error ?? "no error recorded"} · {timeAgo(t.at)}
                  </span>
                  <span className="ml-auto inline-flex flex-wrap items-center justify-end gap-1.5">
                    <AgentPromptButton source="task_run" sourceId={t.id} />
                    <AlertAckButton source="task_run" sourceId={t.id} />
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </div>
  );
}
