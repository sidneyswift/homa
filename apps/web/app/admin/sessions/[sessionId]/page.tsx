import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getSessionDetail } from "../../../../lib/admin/sessions-data";
import { requireFounder } from "../../../../lib/admin/gate";
import {
  adminTimeZone,
  dayLabel,
  formatInt,
  formatTokens,
  timeLabel,
} from "../../../../lib/admin/format";
import { EmptyNote, Pill, SectionHead, statusTone } from "../../ui";

/**
 * /admin/sessions/[sessionId]: one run, turn by turn, in the order the
 * model lived it: injected context snapshots, the family's words, tool
 * calls with args and results, Homa's replies, then delivery receipts
 * and the token bill. Rows older than the capture layer show messages
 * and outcomes only; the trace cards say so instead of pretending.
 */

export const metadata: Metadata = { title: "Session" };

interface TraceEvent {
  at: string;
  kind: "snapshot" | "message" | "tool";
  index: number;
}

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

  const events: TraceEvent[] = [
    ...detail.snapshots.map((snapshot, index) => ({
      at: snapshot.createdAt,
      kind: "snapshot" as const,
      index,
    })),
    ...detail.messages.map((message, index) => ({
      at: message.createdAt,
      kind: "message" as const,
      index,
    })),
    ...detail.toolCalls.map((call, index) => ({
      at: call.createdAt,
      kind: "tool" as const,
      index,
    })),
  ].sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : a.kind === "snapshot" ? -1 : 1));

  const startedAt = events[0]?.at ?? detail.run?.startedAt ?? null;
  const totalTokensIn = detail.usage.reduce((sum, line) => sum + line.tokensIn, 0);
  const totalTokensOut = detail.usage.reduce((sum, line) => sum + line.tokensOut, 0);

  return (
    <div>
      <Link
        href="/admin/sessions"
        className="text-sm font-semibold text-[var(--clay-600)] hover:underline"
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
              className="font-semibold text-[var(--clay-600)] hover:underline"
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
        {formatTokens(totalTokensIn)} in / {formatTokens(totalTokensOut)} out
      </p>
      <p className="mt-1 font-mono text-[0.62rem] text-subtle">{detail.sessionId}</p>

      {detail.run?.error ? (
        <div className="mt-3 rounded-md border border-[var(--rose-500)] bg-[var(--danger-soft)] px-3.5 py-2.5 text-sm font-semibold text-[var(--rose-600)]">
          {detail.run.error}
          {detail.toolCalls.some((call) => call.status === "requested") ? (
            <span className="block font-normal">
              The trace below shows a tool call that never returned; that is where it died.
            </span>
          ) : null}
        </div>
      ) : null}

      <SectionHead eyebrow="Trace" title="Turn by turn, in model order" />
      {events.length === 0 ? (
        <EmptyNote>
          No messages or captured steps for this session id. If this run predates the capture
          layer, only its outcome above exists.
        </EmptyNote>
      ) : (
        <ol className="mt-3 flex flex-col gap-2 border-l-2 border-border-default pl-4">
          {events.map((event, position) => {
            if (event.kind === "snapshot") {
              const snapshot = detail.snapshots[event.index];
              return (
                <li key={`snapshot-${position}`}>
                  <p className="font-mono text-[0.6rem] font-bold uppercase tracking-[0.11em] text-subtle">
                    {timeLabel(snapshot.createdAt, timeZone)} · injected context
                  </p>
                  <details className="mt-1 rounded-md border border-border-subtle bg-card px-3.5 py-2.5 shadow-sm">
                    <summary className="cursor-pointer text-sm font-semibold text-body">
                      The dynamic blocks this turn carried ·{" "}
                      {formatInt(snapshot.content.length)} chars
                    </summary>
                    <pre className="mt-2 max-h-[420px] overflow-auto whitespace-pre-wrap rounded-md bg-[var(--surface-sunken)] p-3 font-mono text-xs text-muted">
                      {snapshot.content}
                    </pre>
                  </details>
                </li>
              );
            }
            if (event.kind === "message") {
              const message = detail.messages[event.index];
              const mine = message.role === "user";
              return (
                <li key={`message-${position}`}>
                  <p className="font-mono text-[0.6rem] font-bold uppercase tracking-[0.11em] text-subtle">
                    {timeLabel(message.createdAt, timeZone)} ·{" "}
                    {mine ? message.memberName ?? "family" : "Homa"} · {message.channel}
                    {message.visibility === "internal" ? " · internal" : ""}
                  </p>
                  <div
                    className={
                      mine
                        ? "mt-1 rounded-md border border-[var(--clay-200)] bg-[var(--clay-50)] px-3.5 py-2.5"
                        : "mt-1 rounded-md border border-border-subtle bg-card px-3.5 py-2.5 shadow-sm"
                    }
                  >
                    <p className="whitespace-pre-wrap text-sm text-body">{message.content}</p>
                  </div>
                </li>
              );
            }
            const call = detail.toolCalls[event.index];
            const died = call.status === "requested" || call.status === "failed" || call.isError;
            return (
              <li key={`tool-${position}`}>
                <p className="font-mono text-[0.6rem] font-bold uppercase tracking-[0.11em] text-subtle">
                  {timeLabel(call.createdAt, timeZone)} · tool call
                </p>
                <div
                  className={
                    died
                      ? "mt-1 rounded-md border border-[var(--rose-500)] bg-[var(--pop-navy)] px-3.5 py-2.5"
                      : "mt-1 rounded-md bg-[var(--pop-navy)] px-3.5 py-2.5"
                  }
                >
                  <p className="break-words font-mono text-xs text-[#EAF0FF]">
                    {call.tool}({call.args ? JSON.stringify(call.args) : ""})
                  </p>
                  <p className="mt-1 break-words font-mono text-xs text-[#9FDCEC]">
                    {call.status === "requested"
                      ? "never returned"
                      : `${call.status}${call.isError ? " · tool errored" : ""} · ${
                          call.result ? JSON.stringify(call.result).slice(0, 600) : "no output"
                        }`}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <SectionHead eyebrow="Bill" title="What this session cost" />
      {detail.usage.length === 0 ? (
        <EmptyNote>No model usage recorded on this session id.</EmptyNote>
      ) : (
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
                {formatTokens(line.tokensOut)} out
              </span>
            </li>
          ))}
        </ul>
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
