import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getFamilyThread, listChatFamilies } from "../../../lib/admin/chats-data";
import { requireFounder } from "../../../lib/admin/gate";
import { adminTimeZone, timeAgo } from "../../../lib/admin/format";
import { EmptyNote, Pill } from "../ui";
import { ChatThread } from "./thread";

/**
 * /admin/chats: the founder chat reader (ruling D-nm-2; the night
 * manager plan's page, landed with the deep view build). Family picker
 * on the left, the whole cross-channel thread on the right; the same
 * thread component the family file's Chats tab mounts.
 */

export const metadata: Metadata = { title: "Chats" };

export default async function AdminChatsPage({
  searchParams,
}: {
  searchParams: Promise<{ family?: string; before?: string; xray?: string }>;
}) {
  await requireFounder();
  const query = await searchParams;
  const families = await listChatFamilies();
  const xray = query.xray === "1";

  const selectedId =
    query.family && /^[0-9a-f-]{36}$/i.test(query.family)
      ? query.family
      : families[0]?.id ?? null;
  if (query.family && !families.some((family) => family.id === selectedId)) notFound();
  const selected = families.find((family) => family.id === selectedId) ?? null;

  const messages = selectedId
    ? await getFamilyThread(selectedId, { limit: 150, before: query.before ?? null })
    : [];

  return (
    <div>
      <p className="font-mono text-[0.64rem] font-bold uppercase tracking-[0.13em] text-subtle">
        Founder · chat reader
      </p>
      <h1 className="mt-0.5 font-display text-2xl font-bold text-strong">
        Every conversation, every channel
      </h1>
      <p className="mt-1 max-w-2xl text-sm text-muted">
        Dashed rows are the scheduler&apos;s own prompts to Homa, which the family never sees.
        Turn x-ray on to jump from any bubble into its session trace.
      </p>

      <div className="mt-5 grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside aria-label="Families" className="flex flex-col gap-1.5">
          {families.length === 0 ? <EmptyNote>No families yet.</EmptyNote> : null}
          {families.map((family) => (
            <Link
              key={family.id}
              href={`/admin/chats?family=${family.id}${xray ? "&xray=1" : ""}`}
              aria-current={family.id === selectedId ? "page" : undefined}
              className={
                family.id === selectedId
                  ? "rounded-md border border-[var(--clay-400)] bg-brand-soft px-3 py-2 shadow-sm"
                  : "rounded-md border border-border-subtle bg-card px-3 py-2 shadow-sm transition-colors hover:border-[var(--clay-300)]"
              }
            >
              <p className="truncate text-sm font-bold text-strong">{family.name}</p>
              <p className="font-mono text-[0.62rem] text-subtle">
                {family.messagesTotal} messages · {family.messages7d} this week · last{" "}
                {timeAgo(family.lastMessageAt)}
              </p>
            </Link>
          ))}
        </aside>

        <section aria-label="Thread" className="min-w-0">
          {selected ? (
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <h2 className="font-display text-lg font-bold text-strong">{selected.name}</h2>
              <Pill tone="stone">{selected.messagesTotal} messages</Pill>
              <Link
                href={`/admin/families/${selected.id}/chats`}
                className="text-sm font-semibold text-[var(--clay-600)] hover:underline"
              >
                Open in the family file
              </Link>
              <Link
                href={`/admin/chats?family=${selected.id}${xray ? "" : "&xray=1"}`}
                className={
                  xray
                    ? "ml-auto inline-flex min-h-9 items-center rounded-pill border border-[var(--gold-ink)] bg-[var(--gold-100)] px-3 py-1 font-mono text-xs font-bold text-[var(--gold-ink-strong)]"
                    : "ml-auto inline-flex min-h-9 items-center rounded-pill border border-border-subtle bg-card px-3 py-1 font-mono text-xs font-bold text-muted hover:border-[var(--gold-ink)]"
                }
              >
                X-ray: {xray ? "on" : "off"}
              </Link>
            </div>
          ) : null}
          {messages.length >= 150 && selectedId ? (
            <p className="mb-3 text-center">
              <Link
                href={`/admin/chats?family=${selectedId}&before=${encodeURIComponent(messages[0]?.createdAt ?? "")}${xray ? "&xray=1" : ""}`}
                className="text-sm font-semibold text-[var(--clay-600)] hover:underline"
              >
                Load older messages
              </Link>
            </p>
          ) : null}
          {selectedId ? (
            <ChatThread messages={messages} timeZone={adminTimeZone()} xray={xray} />
          ) : (
            <EmptyNote>Pick a family to read their thread.</EmptyNote>
          )}
        </section>
      </div>
    </div>
  );
}
