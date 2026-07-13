import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getFamilyThread } from "../../../../../lib/admin/chats-data";
import { requireFounder } from "../../../../../lib/admin/gate";
import { adminTimeZone } from "../../../../../lib/admin/format";
import { ChatThread } from "../../../chats/thread";
import { EmptyNote } from "../../../ui";
import { FamilyShell, isUuid } from "../family-shell";

/**
 * The family file's Chats chapter: the whole cross-channel thread from
 * conversation_messages (founder chat access per ruling D-nm-2),
 * internal dispatch prompts included and labeled. Same reader component
 * as /admin/chats.
 */

export const metadata: Metadata = { title: "Family chats" };

const CHANNEL_FILTERS = [
  { value: null, label: "Everything" },
  { value: "web", label: "Web" },
  { value: "sms", label: "Text" },
  { value: "email", label: "Email" },
  { value: "dispatch", label: "Tasks" },
] as const;

export default async function AdminFamilyChatsPage({
  params,
  searchParams,
}: {
  params: Promise<{ familyId: string }>;
  searchParams: Promise<{ channel?: string; before?: string; xray?: string }>;
}) {
  await requireFounder();
  const { familyId } = await params;
  if (!isUuid(familyId)) notFound();
  const query = await searchParams;
  const channel = ["web", "sms", "email", "dispatch"].includes(query.channel ?? "")
    ? (query.channel as string)
    : null;
  const xray = query.xray === "1";

  const messages = await getFamilyThread(familyId, {
    limit: 200,
    channel,
    before: query.before ?? null,
  });
  const base = `/admin/families/${familyId}/chats`;
  const withParams = (next: { channel?: string | null; before?: string | null; xray?: boolean }) => {
    const params = new URLSearchParams();
    const channelValue = next.channel === undefined ? channel : next.channel;
    if (channelValue) params.set("channel", channelValue);
    if (next.before) params.set("before", next.before);
    if (next.xray ?? xray) params.set("xray", "1");
    const text = params.toString();
    return text ? `${base}?${text}` : base;
  };

  return (
    <FamilyShell
      familyId={familyId}
      title="· Chats"
      sub="Every channel, one thread. Dashed rows are the scheduler's own prompts to Homa, which the family never sees."
    >
      {() => (
        <div>
          <div className="flex flex-wrap items-center gap-1.5">
            {CHANNEL_FILTERS.map((filter) => (
              <Link
                key={filter.label}
                href={withParams({ channel: filter.value, before: null })}
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
              href={withParams({ xray: !xray, before: query.before ?? null })}
              className={
                xray
                  ? "ml-auto inline-flex min-h-9 items-center rounded-pill border border-[var(--gold-ink)] bg-[var(--gold-100)] px-3 py-1 font-mono text-xs font-bold text-[var(--gold-ink-strong)]"
                  : "ml-auto inline-flex min-h-9 items-center rounded-pill border border-border-subtle bg-card px-3 py-1 font-mono text-xs font-bold text-muted hover:border-[var(--gold-ink)]"
              }
            >
              X-ray: {xray ? "on" : "off"}
            </Link>
          </div>

          {messages.length >= 200 ? (
            <p className="mt-3 text-center">
              <Link
                href={withParams({ before: messages[0]?.createdAt ?? null })}
                className="text-sm font-semibold text-[var(--clay-600)] hover:underline"
              >
                Load older messages
              </Link>
            </p>
          ) : null}

          <div className="mx-auto mt-4 max-w-[780px]">
            {messages.length === 0 ? (
              <EmptyNote>Nothing on this filter yet.</EmptyNote>
            ) : (
              <ChatThread messages={messages} timeZone={adminTimeZone()} xray={xray} />
            )}
          </div>
        </div>
      )}
    </FamilyShell>
  );
}
