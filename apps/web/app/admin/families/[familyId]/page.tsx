import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getFamilyDetail, type FamilyDetailKid } from "../../../../lib/admin/family-detail-data";
import { requireFounder } from "../../../../lib/admin/gate";
import { dripLabel } from "../../../../lib/drip/labels";
import { ageYears, familyDisplayName, formatTokens, timeAgo, timeLabel, adminTimeZone } from "../../../../lib/admin/format";
import { founderPhoneHome } from "../../../../lib/family-phone";
import { formatUsd } from "../../../../lib/model-pricing";
import { accountStatusCopy } from "../../../../lib/admin/account-status-copy";
import { STAGE_COPY } from "../../../../lib/admin/stage";
import { EmptyNote, Pill, SectionHead, Spark, statusTone, type PillTone } from "../../ui";
import { BuildReportButton } from "./build-report-button";
import { FamilyTabs } from "./family-tabs";
import { PhoneLendControls } from "./phone-lend-controls";
import { TestFamilyControls } from "./test-family-controls";

/**
 * /admin/families/[familyId]: one family's whole story (the lab drawer,
 * grown into a page). Journey timestamps, kids, send receipts, ledger
 * rows, and usage counts; message content stays out on purpose.
 */

export const metadata: Metadata = { title: "Family" };

// The build-report action's background phase holds an uncapped narrative
// model call plus the report email (the same work /api/map/score does,
// same 300s room); server actions run under their page's segment config.
export const maxDuration = 300;

/**
 * One pill + one small line per kid, answering the stuck-family
 * questions in order: is there a report, and if not, is it the questions
 * that stopped (how many left) or did she finish them and just never
 * reach scoring (report can build now).
 */
function kidChecklistState(kid: FamilyDetailKid): { tone: PillTone; pill: string; line: string } {
  if (kid.hasReport) {
    const opened = kid.reportViewedAt
      ? `opened ${timeAgo(kid.reportViewedAt)}`
      : "not opened yet";
    const emailed = kid.reportEmailedAt ? "emailed" : "not emailed";
    return { tone: "sage", pill: `report ${timeAgo(kid.reportAt)}`, line: `${emailed} · ${opened}` };
  }
  if (!kid.inScoredBand) {
    return {
      tone: "stone",
      pill: "outside checklist ages",
      line: "the checklist covers ages 2 to 16 · under-2s get the band-ready email when they age in",
    };
  }
  if (kid.answered === 0) {
    return { tone: "stone", pill: "questions not started", line: "no checklist answers saved yet" };
  }
  if (kid.readyToScore) {
    return {
      tone: "clay",
      pill: "questions done · report can build now",
      line: `all ${kid.answered} answers saved · scores automatically when she returns · last answer ${timeAgo(kid.lastAnswerAt)}`,
    };
  }
  return {
    tone: "gold",
    pill: `${kid.answered} answered · ${kid.questionsLeft} left`,
    line: `mid checklist · last answer ${timeAgo(kid.lastAnswerAt)}`,
  };
}

export default async function AdminFamilyDetailPage({
  params,
}: {
  params: Promise<{ familyId: string }>;
}) {
  const founder = await requireFounder();
  const { familyId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(familyId)) notFound();
  const detail = await getFamilyDetail(familyId);
  if (!detail) notFound();
  // The lend-and-return switch needs the founder's real family (source
  // and home for their number); loaded only where it can render.
  const phoneHome = detail.sandbox ? await founderPhoneHome(founder.userId) : null;

  const stage = STAGE_COPY[detail.stage];
  const account = accountStatusCopy({
    status: detail.status,
    profileCompletedAt: detail.profileCompletedAt,
  });
  const timeZone = adminTimeZone();
  const journey: { label: string; at: string | null }[] = [
    { label: "Signed up", at: detail.createdAt },
    { label: "Setup done", at: detail.profileCompletedAt },
    { label: "First report", at: detail.kids.map((k) => k.reportAt).filter(Boolean).sort()[0] ?? null },
    { label: "Trial started", at: detail.trialStartedAt },
  ];

  return (
    <div>
      <Link href="/admin/families" className="text-sm font-semibold text-[var(--clay-600)] hover:underline">
        Back to families
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl font-bold text-strong">{familyDisplayName(detail.name)}</h1>
        <Pill tone={account.tone} title={account.hint}>{account.label}</Pill>
        <Pill tone={stage.tone} title={stage.hint}>{stage.label}</Pill>
        {detail.sandbox ? <Pill tone="outline">Test family</Pill> : null}
        {detail.billingExempt ? <Pill tone="stone">Comped</Pill> : null}
        {detail.trialStartedAt && !detail.billingExempt ? <Pill tone="clay">Trial</Pill> : null}
        {detail.subscriptionStatus ? (
          <Pill tone={statusTone(detail.subscriptionStatus)}>Stripe: {detail.subscriptionStatus}</Pill>
        ) : null}
        {detail.journalOptOutAt ? <Pill tone="stone">Email opt-out</Pill> : null}
      </div>
      <p className="mt-1 text-sm text-muted">
        {detail.parentName ?? "No display name"} · {detail.usState ?? "state unknown"} ·{" "}
        {detail.email ?? "no email"} · {detail.phone ?? "no phone"} ·{" "}
        {detail.timeZone ?? "no time zone"}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <TestFamilyControls familyId={detail.id} sandbox={detail.sandbox} />
        {detail.sandbox ? (
          <PhoneLendControls
            familyId={detail.id}
            linkedPhones={detail.linkedPhones}
            homeFamilyName={phoneHome?.familyName ?? null}
            homePhones={phoneHome?.phoneNumbers ?? []}
          />
        ) : null}
      </div>
      <FamilyTabs familyId={detail.id} />

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-border-subtle bg-card p-4 shadow-sm">
          <p className="text-[0.72rem] font-bold text-muted">Journey</p>
          <ul className="mt-2 flex flex-col gap-1.5 text-sm">
            {journey.map((step) => (
              <li key={step.label} className="flex items-baseline gap-2">
                <span className="min-w-24 font-mono text-xs text-subtle">
                  {step.at ? timeAgo(step.at) : "not yet"}
                </span>
                <span className={step.at ? "text-body" : "text-subtle"}>{step.label}</span>
              </li>
            ))}
            <li className="flex items-baseline gap-2">
              <span className="min-w-24 font-mono text-xs text-subtle">{timeAgo(detail.lastUserActivityAt)}</span>
              <span className="text-body">Last heard from</span>
            </li>
          </ul>
        </div>
        <div className="rounded-lg border border-border-subtle bg-card p-4 shadow-sm">
          <p className="text-[0.72rem] font-bold text-muted">Kids</p>
          {detail.kids.length === 0 ? (
            <p className="mt-2 text-sm text-subtle">No kids added yet.</p>
          ) : (
            <ul className="mt-2 flex flex-col gap-2 text-sm">
              {detail.kids.map((kid) => {
                const state = kidChecklistState(kid);
                return (
                  <li key={kid.id}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-strong">{kid.name}</span>
                      <span className="text-subtle">{ageYears(kid.birthDate)} yrs</span>
                      <Pill tone={state.tone}>{state.pill}</Pill>
                      {kid.hasReport ? (
                        <Link
                          href={`/admin/families/${detail.id}/report/${kid.id}`}
                          className="text-xs font-semibold text-[var(--clay-600)] hover:underline"
                        >
                          view report
                        </Link>
                      ) : null}
                      {kid.readyToScore ? (
                        <BuildReportButton
                          familyId={detail.id}
                          childId={kid.id}
                          childName={kid.name}
                        />
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-xs text-subtle">{state.line}</p>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-3 text-[0.72rem] font-bold text-muted">Adults</p>
          <ul className="mt-1 flex flex-col gap-1 text-sm">
            {detail.members.map((member, index) => (
              <li key={index} className="text-body">
                {member.displayName ?? member.email ?? "unnamed"}{" "}
                <span className="text-subtle">
                  · {member.role} · last sign-in {timeAgo(member.lastSignInAt)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-lg border border-border-subtle bg-card p-4 shadow-sm">
          <p className="text-[0.72rem] font-bold text-muted">Messages 28d</p>
          <p className="mt-1 font-display text-xl font-semibold text-strong">{detail.messages28d}</p>
          <Spark values={detail.messagesByDay14.map((d) => d.n).length > 1 ? detail.messagesByDay14.map((d) => d.n) : [0, 0]} />
        </div>
        <div className="rounded-lg border border-border-subtle bg-card p-4 shadow-sm">
          <p className="text-[0.72rem] font-bold text-muted">Hours logged 28d</p>
          <p className="mt-1 font-display text-xl font-semibold text-strong">
            {(detail.hoursMinutes28d / 60).toFixed(1)}h
          </p>
        </div>
        <div className="rounded-lg border border-border-subtle bg-card p-4 shadow-sm">
          <p className="text-[0.72rem] font-bold text-muted">Memories saved</p>
          <p className="mt-1 font-display text-xl font-semibold text-strong">{detail.memoriesCount}</p>
        </div>
        <div className="rounded-lg border border-border-subtle bg-card p-4 shadow-sm">
          <p className="text-[0.72rem] font-bold text-muted">AI cost 28d (est)</p>
          <p className="mt-1 font-display text-xl font-semibold text-strong">{formatUsd(detail.cost28dUsd)}</p>
          <p className="mt-1 text-[0.72rem] text-subtle">{formatTokens(detail.tokens28d)} tokens</p>
        </div>
      </div>

      <SectionHead eyebrow="Machine" title="Task runs and deliveries" sub="The newest first. Uncertain stays its own bucket." />
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <div className="rounded-lg border border-border-subtle bg-card p-4 shadow-sm">
          <p className="text-[0.72rem] font-bold text-muted">Runs</p>
          {detail.runs.length === 0 ? (
            <p className="mt-2 text-sm text-subtle">No proactive runs yet.</p>
          ) : (
            <ul className="mt-2 flex flex-col gap-1.5 text-sm">
              {detail.runs.map((run, index) => (
                <li key={index} className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-subtle">{timeAgo(run.startedAt)}</span>
                  <span className="font-semibold text-body">{run.kind.replace(/_/g, " ")}</span>
                  <Pill tone={statusTone(run.status)}>{run.status.replace(/_/g, " ")}</Pill>
                  {run.deliveredChannel ? <span className="text-subtle">{run.deliveredChannel}</span> : null}
                  {run.error ? <span className="text-subtle">· {run.error}</span> : null}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-lg border border-border-subtle bg-card p-4 shadow-sm">
          <p className="text-[0.72rem] font-bold text-muted">Deliveries</p>
          {detail.deliveries.length === 0 ? (
            <p className="mt-2 text-sm text-subtle">No per-recipient deliveries recorded yet.</p>
          ) : (
            <ul className="mt-2 flex flex-col gap-1.5 text-sm">
              {detail.deliveries.map((delivery, index) => (
                <li key={index} className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-subtle">{timeAgo(delivery.createdAt)}</span>
                  <span className="font-semibold text-body">{delivery.channel}</span>
                  <Pill tone={statusTone(delivery.status)}>{delivery.status}</Pill>
                  {delivery.repliedAt ? <Pill tone="sage">replied</Pill> : null}
                  {delivery.error ? <span className="text-subtle">· {delivery.error}</span> : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <SectionHead eyebrow="Paper trail" title="Map emails, materials, recent events" />
      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <div className="rounded-lg border border-border-subtle bg-card p-4 shadow-sm">
          <p className="text-[0.72rem] font-bold text-muted">Map emails</p>
          {detail.emailSends.length === 0 ? (
            <p className="mt-2 text-sm text-subtle">
              Ledger is live; this family&apos;s next map email lands here.
            </p>
          ) : (
            <ul className="mt-2 flex flex-col gap-1.5 text-sm">
              {detail.emailSends.map((send, index) => (
                <li key={index} className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-subtle">{timeAgo(send.createdAt)}</span>
                  <span className="font-semibold text-body">{dripLabel(send.kind)}</span>
                  <Pill tone={statusTone(send.status)}>{send.status}</Pill>
                  {send.reason ? (
                    <span className="basis-full text-[0.72rem] text-subtle">{send.reason}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-lg border border-border-subtle bg-card p-4 shadow-sm">
          <p className="text-[0.72rem] font-bold text-muted">Materials</p>
          {detail.materials.length === 0 ? (
            <p className="mt-2 text-sm text-subtle">No printables yet.</p>
          ) : (
            <ul className="mt-2 flex flex-col gap-1.5 text-sm">
              {detail.materials.map((material, index) => (
                <li key={index} className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-subtle">{timeAgo(material.createdAt)}</span>
                  <span className="truncate font-semibold text-body">{material.title}</span>
                  <Pill tone="stone">{material.kind}</Pill>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-lg border border-border-subtle bg-card p-4 shadow-sm">
          <p className="text-[0.72rem] font-bold text-muted">Recent events</p>
          {detail.recentEvents.length === 0 ? (
            <p className="mt-2 text-sm text-subtle">No analytics events for this family yet.</p>
          ) : (
            <ul className="mt-2 flex flex-col gap-1.5 text-sm">
              {detail.recentEvents.map((event, index) => (
                <li key={index} className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-subtle">
                    {timeLabel(event.createdAt, timeZone)}
                  </span>
                  <span className="font-mono text-xs text-body">{event.name}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {detail.subscriptionPeriodEnd ? (
        <EmptyNote>
          Stripe period ends {timeAgo(detail.subscriptionPeriodEnd)} from the webhook mirror.
        </EmptyNote>
      ) : null}
    </div>
  );
}
