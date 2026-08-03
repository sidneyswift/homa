import type { Metadata } from "next";
import Link from "next/link";

import { requireFounder } from "../../../lib/admin/gate";
import { adminTimeZone, timeLabel } from "../../../lib/admin/format";
import { getPulseDays, type PulseCategory } from "../../../lib/admin/pulse-data";
import { EmptyNote } from "../ui";

/**
 * /admin/pulse: the operations diary (lab direction 3). Newest day on
 * top, a plain sentence per day, one line per thing that happened.
 * Failures render with their detail visible; nothing folds away.
 */

export const metadata: Metadata = { title: "Pulse" };

const CATEGORIES: { key: PulseCategory | "all"; label: string }[] = [
  { key: "all", label: "Everything" },
  { key: "signup", label: "Signups" },
  { key: "send", label: "Sends" },
  { key: "fail", label: "Failures" },
  { key: "usage", label: "Usage" },
  { key: "billing", label: "Billing" },
];

const DOT_COLOR: Record<PulseCategory, string> = {
  signup: "var(--homa-constructive-ink)",
  send: "var(--homa-info-ink)",
  fail: "var(--homa-error-ink)",
  usage: "color-mix(in srgb, var(--homa-ink) 46%, var(--homa-canvas))",
  billing: "var(--homa-highlight-ink)",
};

export default async function AdminPulsePage({
  searchParams,
}: {
  searchParams: Promise<{ cat?: string }>;
}) {
  await requireFounder();
  const params = await searchParams;
  const category = (CATEGORIES.some((c) => c.key === params.cat) ? params.cat : "all") as
    | PulseCategory
    | "all";
  const days = await getPulseDays(14);
  const timeZone = adminTimeZone();

  const filtered = days
    .map((day) => ({
      ...day,
      items: category === "all" ? day.items : day.items.filter((item) => item.category === category),
    }))
    .filter((day) => day.items.length > 0);

  return (
    <div data-brand-surface="admin-pulse" className="quiet-admin__child">
      <p className="font-mono text-[0.64rem] font-bold uppercase tracking-[0.13em] text-subtle">
        Founder · the pulse
      </p>
      <h1 className="mt-1 font-display text-2xl font-bold text-strong">
        What happened since you last looked
      </h1>
      <p className="mt-1 max-w-2xl text-sm text-muted">
        Written from events, task runs, deliveries, and the email ledger. Last 14 days, your time zone.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <Link
            key={c.key}
            href={c.key === "all" ? "/admin/pulse" : `/admin/pulse?cat=${c.key}`}
            className={
              category === c.key
                ? "rounded-pill border border-[var(--homa-midnight-action)] bg-[var(--homa-info-tint)] px-3.5 py-1.5 text-sm font-bold text-[var(--homa-info-ink)]"
                : "rounded-pill border border-border bg-card px-3.5 py-1.5 text-sm font-semibold text-body hover:border-[var(--homa-midnight-action)]"
            }
          >
            {c.label}
          </Link>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyNote>Nothing in this category over the last 14 days.</EmptyNote>
      ) : (
        filtered.map((day) => (
          <section key={day.key} className="mt-6">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 className="font-display text-lg font-bold text-strong">{day.label}</h2>
              <p className="font-serif text-sm italic text-muted">{day.digest}</p>
            </div>
            <ul className="mt-2.5 flex flex-col gap-1.5">
              {day.items.map((item, index) => (
                <li
                  key={index}
                  className="rounded-md border border-border-subtle bg-card px-3.5 py-2.5 text-sm shadow-sm"
                >
                  <div className="flex items-start gap-2.5">
                    <span
                      aria-hidden="true"
                      className="mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full"
                      style={{ background: DOT_COLOR[item.category] }}
                    />
                    <span className="min-w-16 pt-0.5 font-mono text-xs text-subtle">
                      {timeLabel(item.at, timeZone)}
                    </span>
                    <span className="text-body">
                      {item.text}
                      {item.detail ? (
                        <span className="mt-0.5 block text-xs text-subtle">{item.detail}</span>
                      ) : null}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
