import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getSessionDetail } from "../../../../lib/admin/sessions-data";
import { requireFounder } from "../../../../lib/admin/gate";
import {
  adminTimeZone,
  dayLabel,
  formatTokens,
  timeAgo,
  timeLabel,
} from "../../../../lib/admin/format";
import { formatUsd } from "../../../../lib/model-pricing";
import { AgentPromptButton } from "../../agent-prompt-button";
import { interleaveTraceEvents, SessionTrace } from "../../session-trace";
import { EmptyNote, Pill, SectionHead, statusTone } from "../../ui";

/**
 * /admin/sessions/[sessionId]: one run, turn by turn, in the order the
 * model lived it: injected context snapshots, the family's words, tool
 * calls with args and results, Homa's replies, then delivery receipts
 * and the token bill. Rows older than the capture layer show messages
 * and outcomes only; the trace cards say so instead of pretending.
 */

export const metadata: Metadata = { title: "Session" };

export default async function AdminSessionDetailPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  await requireFounder();
  const { sessionId: raw } = await params;
  const sessionId = decodeURIComponent(raw);
  if (sessionId.length < 6 || sessionId.length > 120) notFound();
  const detail = await getSessionDetail(sessionId);
  if (!detail) notFound();
  const timeZone = adminTimeZone();

  const events = interleaveTraceEvents(detail);
  const startedAt = events[0]?.at ?? detail.run?.startedAt ?? null;
  const totalTokensIn = detail.usage.reduce((sum, line) => sum + line.tokensIn, 0);
  const totalTokensOut = detail.usage.reduce((sum, line) => sum + line.tokensOut, 0);

  return (
    <div data-brand-surface="admin-session-detail" className="quiet-admin__child">
      <Link
        href="/admin/sessions"
        className="text-sm font-semibold text-[var(--homa-brand-text)] hover:underline"
      >
        All sessions
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <h1 className="font-display text-2xl font-bold text-strong">
          {detail.run ? detail.run.title : "Chat session"}
        </h1>
        {detail.run ? (
          <Pill tone={statusTone(detail.run.status)}>{detail.run.status.replace(/_/g, " ")}</Pill>
        ) : null}
      </div>
      <p className="mt-1 text-sm text-muted">
        {detail.familyName ? (
          <>
            <Link
              href={`/admin/families/${detail.familyId}`}
        className="font-semibold text-[var(--homa-brand-text)] hover:underline"
            >
              {detail.familyName}
            </Link>
            {" · "}
          </>
        ) : (
          "No family · "
        )}
        {startedAt ? `${dayLabel(startedAt, timeZone)} · ${timeLabel(startedAt, timeZone)} · ` : ""}
        {detail.messages.length} messages · {detail.toolCalls.length} tool calls ·{" "}
        {formatTokens(totalTokensIn)} in / {formatTokens(totalTokensOut)} out ·{" "}
        {formatUsd(detail.usageCost.estimatedUsd)}
      </p>
      <p className="mt-1 font-mono text-[0.62rem] text-subtle">{detail.sessionId}</p>

      {detail.run?.error ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 rounded-md border border-[var(--homa-error-ink)] bg-[var(--homa-error-tint)] px-3.5 py-2.5 text-sm font-semibold text-[var(--homa-error-ink)]">
          <div className="min-w-0">
            {detail.run.error}
            {detail.toolCalls.some((call) => call.status === "requested") ? (
              <span className="block font-normal">
                The trace below shows a tool call that never returned; that is where it died.
              </span>
            ) : null}
          </div>
          <div className="shrink-0">
            <AgentPromptButton source="task_run" sourceId={detail.run.id} />
          </div>
        </div>
      ) : null}

      <SectionHead eyebrow="Trace" title="Turn by turn, in model order" />
      <SessionTrace detail={detail} timeZone={timeZone} />

      <SectionHead
        eyebrow="Bill"
        title="What this session cost"
        sub={
          detail.priceBook.source === "gateway"
            ? `Estimates at the gateway's current prices, checked ${timeAgo(detail.priceBook.fetchedAt)}; the Gateway invoice is the source of truth.`
            : "Estimates from the pinned price book in lib/model-pricing.ts (live gateway prices unavailable right now); the Gateway invoice is the source of truth."
        }
      />
      {detail.usage.length === 0 ? (
        <EmptyNote>No model usage recorded on this session id.</EmptyNote>
      ) : (
        <>
          <ul className="mt-3 flex flex-col gap-1.5">
            {detail.usage.map((line, index) => (
              <li
                key={index}
                className="flex flex-wrap items-center gap-2 rounded-md border border-border-subtle bg-card px-3.5 py-2 text-sm shadow-sm"
              >
                <span className="font-semibold text-body">{line.surface}</span>
                <span className="font-mono text-xs text-subtle">{line.model}</span>
                <span className="ml-auto font-mono text-xs text-muted">
                  {line.calls} calls · {formatTokens(line.tokensIn)} in /{" "}
                  {formatTokens(line.tokensOut)} out ·{" "}
                  <span className="font-semibold text-body">
                    {line.estimatedUsd === null ? "no price on file" : formatUsd(line.estimatedUsd)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-sm font-semibold text-body">
            Estimated total · {formatUsd(detail.usageCost.estimatedUsd)}
            {detail.usageCost.unpricedModels.length > 0 ? (
              <span className="font-normal text-subtle">
                {" "}
                · not counted, no price on file: {detail.usageCost.unpricedModels.join(", ")}
              </span>
            ) : null}
          </p>
        </>
      )}

      {detail.run ? (
        <>
          <SectionHead eyebrow="Delivery" title="Where it went" />
          {detail.run.summary ? (
            <p className="mt-3 rounded-md border border-border-subtle bg-card px-3.5 py-2.5 text-sm text-body shadow-sm">
              {detail.run.summary}
            </p>
          ) : null}
          {detail.deliveries.length === 0 ? (
            <EmptyNote>No per-recipient delivery rows for this run.</EmptyNote>
          ) : (
            <ul className="mt-2 flex flex-col gap-1.5">
              {detail.deliveries.map((delivery, index) => (
                <li
                  key={index}
                  className="flex flex-wrap items-center gap-2 rounded-md border border-border-subtle bg-card px-3.5 py-2 text-sm shadow-sm"
                >
                  <span className="font-mono text-xs text-subtle">
                    {timeLabel(delivery.createdAt, timeZone)}
                  </span>
                  <span className="font-semibold text-body">{delivery.channel}</span>
                  <Pill tone={statusTone(delivery.status)}>{delivery.status}</Pill>
                  {delivery.repliedAt ? <Pill tone="sage">replied</Pill> : null}
                  {delivery.error ? <span className="text-subtle">· {delivery.error}</span> : null}
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}
    </div>
  );
}
