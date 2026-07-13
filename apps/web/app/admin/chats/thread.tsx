import Link from "next/link";

import type { ThreadMessage } from "../../../lib/admin/chats-data";
import { dayKey, dayLabel, timeLabel } from "../../../lib/admin/format";
import { MarkdownText } from "../../app/markdown-text";

/**
 * The founder chat reader's thread (one component behind two doors:
 * /admin/chats and the family file's Chats tab, plus her-screen's Chat
 * tab in family-visible mode). Day-grouped bubbles in the founder's
 * time zone; internal dispatch prompts render dashed and labeled so the
 * scheduler's words never read as the parent's. With xray on, every
 * bubble grows a session chip into the inspector.
 *
 * Each bubble reads as the parent experienced it: Homa's web replies
 * render through the same markdown component as the parent's chat;
 * texts, emails, the parent's own messages, and internal prompts are
 * delivered as raw text, so they stay verbatim.
 */

const CHANNEL_LABEL: Record<string, string> = {
  web: "web",
  sms: "text",
  email: "email",
  dispatch: "task",
};

export function ChatThread({
  messages,
  timeZone,
  xray = false,
}: {
  messages: ThreadMessage[];
  timeZone: string;
  xray?: boolean;
}) {
  if (messages.length === 0) {
    return (
      <p className="mt-3 rounded-md border border-dashed border-border-default bg-card px-3.5 py-3 text-sm text-subtle">
        No messages recorded yet on this scope.
      </p>
    );
  }

  const days: { key: string; label: string; rows: ThreadMessage[] }[] = [];
  for (const message of messages) {
    const key = dayKey(message.createdAt, timeZone);
    const bucket = days[days.length - 1];
    if (bucket && bucket.key === key) bucket.rows.push(message);
    else days.push({ key, label: dayLabel(message.createdAt, timeZone), rows: [message] });
  }

  return (
    <div className="flex flex-col gap-5">
      {days.map((day) => (
        <section key={day.key} aria-label={day.label}>
          <p className="sticky top-0 z-10 mx-auto w-fit rounded-pill border border-border-subtle bg-page px-3 py-1 font-mono text-[0.62rem] font-bold uppercase tracking-[0.1em] text-subtle">
            {day.label}
          </p>
          <div className="mt-2 flex flex-col gap-2">
            {day.rows.map((message) => {
              const mine = message.role === "user";
              const internal = message.visibility === "internal";
              // Web replies and family-visible task output (dispatch
              // rows delivered into the web transcript) rendered as
              // markdown for the parent, so they do here too. Texts and
              // emails arrived as raw characters; raw is what she saw,
              // and raw keeps an SMS markdown slip visible to the
              // founder. Internal prompts she never saw.
              const parentSawMarkdown =
                !mine &&
                !internal &&
                (message.channel === "web" || message.channel === "dispatch");
              return (
                <div
                  key={message.id}
                  className={mine ? "flex justify-end" : "flex justify-start"}
                >
                  <div
                    className={
                      internal
                        ? "max-w-[82%] rounded-2xl border border-dashed border-border-default bg-[var(--surface-sunken)] px-3.5 py-2.5"
                        : mine
                          ? "max-w-[82%] rounded-2xl rounded-br-md bg-[var(--clay-100)] px-3.5 py-2.5"
                          : "max-w-[82%] rounded-2xl rounded-bl-md border border-border-subtle bg-card px-3.5 py-2.5 shadow-sm"
                    }
                  >
                    {internal ? (
                      <p className="mb-1 font-mono text-[0.58rem] font-bold uppercase tracking-[0.1em] text-subtle">
                        internal · the task&apos;s prompt to Homa
                      </p>
                    ) : null}
                    {parentSawMarkdown ? (
                      <div className="text-sm text-body">
                        <MarkdownText text={message.content} />
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap text-sm text-body">{message.content}</p>
                    )}
                    <p className="mt-1.5 font-mono text-[0.62rem] text-subtle">
                      {timeLabel(message.createdAt, timeZone)}
                      {" · "}
                      {CHANNEL_LABEL[message.channel] ?? message.channel}
                      {mine && message.memberName ? ` · ${message.memberName}` : ""}
                      {!mine && !internal ? " · Homa" : ""}
                    </p>
                    {xray ? (
                      <p className="mt-1">
                        <Link
                          href={`/admin/sessions/${encodeURIComponent(message.sessionId)}`}
                          className="inline-flex rounded-pill border border-dashed border-[var(--gold-ink)] bg-[var(--gold-100)] px-2 py-0.5 font-mono text-[0.6rem] font-bold text-[var(--gold-ink-strong)] hover:underline"
                        >
                          session {message.sessionId.slice(0, 18)}... · open trace
                        </Link>
                      </p>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
