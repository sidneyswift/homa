import type { Metadata } from "next";
import Link from "next/link";

import { listSessions } from "../../../lib/admin/sessions-data";
import { requireFounder } from "../../../lib/admin/gate";
import { adminTimeZone, dayKey, formatTokens, timeLabel } from "../../../lib/admin/format";
import { EmptyNote, Pill, statusTone } from "../ui";

/**
 * /admin/sessions: every agent run across the fleet, newest first (deep
 * view direction 2). Chat sessions come from conversation_messages;
 * proactive runs merge in from homa_task_runs so a run that died before
 * eve ever started still gets a row here, which is exactly when the
 * founder needs it.
 */

export const metadata: Metadata = { title: "Sessions" };

const CHANNEL_FILTERS = [
  { value: null, label: "Everything" },
  { value: "web", label: "Web" },
  { value: "sms", label: "Text" },
  { value: "email", label: "Email" },
  { value: "dispatch", label: "Tasks" },
] as const;

export default async function AdminSessionsPage({
  searchParams,
}: {
  searchParams: Promise<{ channel?: string; family?: string; failed?: string }>;
}) {
  await requireFounder();
  const query = await searchParams;
  const channel = ["web", "sms", "email", "dispatch"].includes(query.channel ?? "")
    ? (query.channel as string)
    : null;
  const familyId =
    query.family && /^[0-9a-f-]{36}$/i.test(query.family) ? query.family : null;
  const failedOnly = query.failed === "1";

  const sessions = await listSessions({ channel, familyId, failedOnly, limit: 60 });
  const timeZone = adminTimeZone();

  const href = (next: { channel?: string | null; failed?: boolean }) => {
    const params = new URLSearchParams();
    const channelValue = next.channel === undefined ? channel : next.channel;
    if (channelValue) params.set("channel", channelValue);
    if (familyId) params.set("family", familyId);
    if (next.failed ?? failedOnly) params.set("failed", "1");
    const text = params.toString();
    return text ? `/admin/sessions?${text}` : "/admin/sessions";
  };

  return (
    <div>
      <p className="font-mono text-[0.64rem] font-bold uppercase tracking-[0.13em] text-subtle">
        Founder · session inspector
      </p>
      <h1 className="mt-0.5 font-display text-2xl font-bold text-strong">
        Every agent run, newest first
      </h1>
      <p className="mt-1 max-w-2xl text-sm text-muted">
        {familyId ? "Scoped to one family. " : ""}
        Open any row for the turn-by-turn trace: injected context, tool calls, replies, cost.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        {CHANNEL_FILTERS.map((filter) => (
          <Link
            key={filter.label}
            href={href({ channel: filter.value })}
            className={
              channel === filter.value
                ? "inline-flex min-h-9 items-center rounded-pill border border-[var(--clay-400)] bg-brand-soft px-3 py-1 text-sm font-bold text-[var(--clay-700)]"
                : "inline-flex min-h-9 items-center rounded-pill border border-border-subtle bg-card px-3 py-1 text-sm font-medium text-muted hover:border-[var(--clay-300)]"
            }
          >
            {filter.label}
          </Link>
        ))}
        <Link
          href={href({ failed: !failedOnly })}
          className={
            failedOnly
              ? "inline-flex min-h-9 items-center rounded-pill border border-[var(--rose-500)] bg-[var(--danger-soft)] px-3 py-1 text-sm font-bold text-[var(--rose-600)]"
              : "inline-flex min-h-9 items-center rounded-pill border border-border-subtle bg-card px-3 py-1 text-sm font-medium text-muted hover:border-[var(--rose-500)]"
          }
        >
          Trouble only
        </Link>
        {familyId ? (
          <Link
            href="/admin/sessions"
            className="inline-flex min-h-9 items-center rounded-pill border border-border-subtle bg-card px-3 py-1 text-sm font-medium text-muted hover:text-body"
          >
            Clear family scope
          </Link>
        ) : null}
      </div>

      {sessions.length === 0 ? (
        <EmptyNote>Nothing on this filter yet.</EmptyNote>
      ) : (
        <div className="mt-4 flex flex-col gap-1.5">
          {sessions.map((session) => {
            const inner = (
              <>
                <span className="min-w-[130px] font-mono text-xs text-subtle">
                  {dayKey(session.endedAt, timeZone)} · {timeLabel(session.endedAt, timeZone)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-strong">
                    {session.familyName ?? "No family"} ·{" "}
                    {session.run ? session.run.title : "chat"}
                  </span>
                  <span className="block font-mono text-[0.66rem] text-subtle">
                    {session.messageCount} messages · {session.toolCallCount} tool calls ·{" "}
                    {formatTokens(session.tokensIn)} in / {formatTokens(session.tokensOut)} out
                    {session.run?.error ? ` · ${session.run.error}` : ""}
                  </span>
                </span>
                <span className="flex flex-wrap items-center justify-end gap-1.5">
                  {session.channels.map((channelName) => (
                    <Pill key={channelName} tone="stone">
                      {channelName}
                    </Pill>
                  ))}
                  {session.run ? (
                    <Pill tone={statusTone(session.run.status)}>
                      {session.run.status.replace(/_/g, " ")}
                    </Pill>
                  ) : null}
                </span>
              </>
            );
            const className =
              "flex w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-border-subtle bg-card px-3.5 py-2.5 text-left shadow-sm transition-colors hover:border-[var(--clay-300)]";
            return session.sessionId ? (
              <Link
                key={session.key}
                href={`/admin/sessions/${encodeURIComponent(session.sessionId)}`}
                className={className}
              >
                {inner}
              </Link>
            ) : (
              <div key={session.key} className={className.replace(" hover:border-[var(--clay-300)]", "")}>
                {inner}
                <span className="w-full font-mono text-[0.62rem] text-subtle">
                  no eve session ever started for this run; the error above is the whole story
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
