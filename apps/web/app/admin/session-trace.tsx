import { formatInt, timeLabel } from "../../lib/admin/format";
import type { SessionDetail } from "../../lib/admin/sessions-data";
import { EmptyNote } from "./ui";

/**
 * The turn-by-turn trace renderer, shared by /admin/sessions/[sessionId]
 * and the studio's run page (/admin/studio/runs/[runId], founder ask
 * 2026-07-18 evening: "read the traces of the models reasoning and what
 * it does inbetween user input and final output"). One implementation
 * on purpose: injected context snapshots, the inbound words, tool calls
 * with args and results, and the model's replies, in the order the
 * model lived them.
 */

interface TraceEvent {
  at: string;
  kind: "snapshot" | "message" | "tool";
  index: number;
}

export function interleaveTraceEvents(detail: SessionDetail): TraceEvent[] {
  return [
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
}

export function SessionTrace({
  detail,
  timeZone,
}: {
  detail: SessionDetail;
  timeZone: string;
}) {
  const events = interleaveTraceEvents(detail);
  if (events.length === 0) {
    return (
      <EmptyNote>
        No messages or captured steps for this session id. If this run predates the capture
        layer, only its outcome above exists.
      </EmptyNote>
    );
  }
  return (
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
  );
}
