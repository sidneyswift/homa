import Link from "next/link";

import { effectiveTimeZone } from "../../lib/time-zone";

/**
 * The dashboard's greeting header: date eyebrow, time-of-day hello, and
 * the one primary action that exists today (talk to Homa). "Auto-plan
 * this week" from the template joins when the planner grows scheduling.
 *
 * Renders per request on the server in the family's own time zone
 * (migration #27, captured from the parent's device by TimeZoneSync);
 * Central time is the fallback middle for the moment before capture.
 */

function greetingLine(now: Date, timeZone: string): { eyebrow: string; hello: string } {
  const eyebrow = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone,
  }).format(now);
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hourCycle: "h23",
      timeZone,
    }).format(now),
  );
  const hello = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  return { eyebrow, hello };
}

export function Greeting({
  parentFirstName,
  timeZone,
}: {
  parentFirstName: string;
  /** The family's stored IANA zone, null before first capture. */
  timeZone: string | null;
}) {
  const { eyebrow, hello } = greetingLine(new Date(), effectiveTimeZone(timeZone));
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-subtle">
          {eyebrow}
        </p>
        <h1 className="mt-1.5 font-display text-[2rem] font-semibold leading-tight tracking-[-0.015em] text-strong">
          {hello}, {parentFirstName}
        </h1>
      </div>
      {/* Hidden on phones: the sticky top bar already carries Ask Homa. */}
      <Link
        href="/chat"
        className="hidden rounded-pill bg-brand px-6 py-3 text-base font-semibold text-on-brand shadow-sm transition-colors hover:bg-brand-hover lg:inline-flex"
      >
        Talk to Homa
      </Link>
    </header>
  );
}
