import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getFamilyDetail } from "../../../../lib/admin/family-detail-data";
import { requireFounder } from "../../../../lib/admin/gate";
import { ageYears, formatTokens, timeAgo, timeLabel, adminTimeZone } from "../../../../lib/admin/format";
import { STAGE_COPY } from "../../../../lib/admin/stage";
import { EmptyNote, Pill, SectionHead, Spark, statusTone } from "../../ui";
import { FamilyTabs } from "./family-tabs";

/**
 * /admin/families/[familyId]: one family's whole story (the lab drawer,
 * grown into a page). Journey timestamps, kids, send receipts, ledger
 * rows, and usage counts; message content stays out on purpose.
 */

export const metadata: Metadata = { title: "Family" };

export default async function AdminFamilyDetailPage({
  params,
}: {
  params: Promise<{ familyId: string }>;
}) {
  await requireFounder();
  const { familyId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(familyId)) notFound();
  const detail = await getFamilyDetail(familyId);
  if (!detail) notFound();

  const stage = STAGE_COPY[detail.stage];
  const timeZone = adminTimeZone();
  const journey: { label: string; at: string | null }[] = [
    { label: "Signed up", at: detail.createdAt },
    { label: "Family setup", at: detail.profileCompletedAt },
    { label: "First report", at: detail.kids.map((k) => k.reportAt).filter(Boolean).sort()[0] ?? null },
    { label: "Trial started", at: detail.trialStartedAt },
  ];

  return (
    <div>
      <Link href="/admin/families" className="text-sm font-semibold text-[var(--clay-600)] hover:underline">
        Back to families
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl font-bold text-strong">{detail.name}</h1>
        <Pill tone={stage.tone}>{stage.label}</Pill>
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
            <ul className="mt-2 flex flex-col gap-1.5 text-sm">
              {detail.kids.map((kid) => (
                <li key={kid.id} className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-strong">{kid.name}</span>
                  <span className="text-subtle">{ageYears(kid.birthDate)} yrs</span>
                  {kid.hasReport ? (
                    <Pill tone="sage">report {timeAgo(kid.reportAt)}</Pill>
                  ) : (
                    <Pill tone="gold">no report yet</Pill>
                  )}
                </li>
              ))}
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
          <p className="text-[0.72rem] font-bold text-muted">AI tokens 28d</p>
          <p className="mt-1 font-display text-xl font-semibold text-strong">{formatTokens(detail.tokens28d)}</p>
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
                  <span className="font-semibold text-body">{send.kind.replace(/_/g, " ")}</span>
                  <Pill tone={statusTone(send.status)}>{send.status}</Pill>
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
