import Link from "next/link";

import { ageLabel, type ReportStaleness } from "@homa/core";

import { reportButtonClass } from "./report-button";

/**
 * The self-renewing report: the permanent URL knows the child has grown
 * (staleness is DERIVED at render from birth date + generation time +
 * the bank, never stored, so it can never rot). Growing older is good
 * news and the banner says so: an offer, never an alarm, per the
 * anti-guilt display laws.
 */
export function StalenessBanner({
  childId,
  childName,
  staleness,
}: {
  childId: string;
  childName: string;
  staleness: ReportStaleness;
}) {
  return (
    <div
      data-brand-layer="report-staleness"
      className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[var(--homa-radius-control)] px-4 py-3 print:hidden"
      style={{ background: "var(--homa-info-tint)" }}
    >
      <p className="text-sm" style={{ color: "var(--homa-info-ink)" }}>
        <span className="font-semibold">
          {childName} was {ageLabel(staleness.ageThenMonths)} when you answered these; they&apos;re{" "}
          {ageLabel(staleness.ageNowMonths)} now.
        </span>{" "}
        {staleness.newBenchmarks > 0
          ? `${staleness.newBenchmarks} new ${staleness.newBenchmarks === 1 ? "checkpoint has" : "checkpoints have"} come into season since.`
          : "A quick re-check would bring every number up to date."}
      </p>
      <Link
        href={`/onboarding?start=${childId}`}
        className={reportButtonClass(
          "primary",
          "inline-flex min-h-9 items-center whitespace-nowrap px-4 py-1.5 text-xs font-semibold",
        )}
      >
        Re-check what&apos;s new {"\u2192"}
      </Link>
    </div>
  );
}
