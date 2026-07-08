"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { MONTH_PLAN_DOMAIN } from "@homa/core";

/**
 * The one-tap month, now UNIFIED (read-through ruling: one four-week
 * plan for the whole child, not sixteen buttons). Sits right under the
 * note so the growth focus is the first actionable thing after the
 * celebration. The tap is the explicit ask that lets the 28-day retest
 * email arm (email doctrine intact). Session-gated: a shared-link
 * viewer gets the device hint, never a plan built on someone else's
 * family.
 */
export function ConsentCard({
  childId,
  childName,
  focusLine,
}: {
  childId: string;
  childName: string;
  /** Code-computed: the focus subjects, e.g. "self care and gross motor". */
  focusLine: string;
}) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "busy" | "no-session">("idle");

  async function consent() {
    setState("busy");
    try {
      const response = await fetch("/api/map/plan/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ childId, domainId: MONTH_PLAN_DOMAIN }),
      });
      if (response.status === 401) {
        setState("no-session");
        return;
      }
      const data = (await response.json()) as { ok: boolean; url?: string };
      if (data.ok && data.url) {
        router.push(data.url);
        return;
      }
      setState("idle");
    } catch {
      setState("idle");
    }
  }

  return (
    <div className="mt-4 rounded-lg border border-sage/30 bg-[var(--accent-sage-soft)] p-5 print:hidden">
      <p className="font-display text-lg font-semibold text-strong">
        Want me to build {childName}&apos;s month?
      </p>
      <p className="mt-1 text-sm text-body">
        One four-week plan for the whole picture, leaning into {focusLine}, with a favorite
        strength sprinkled in for joy. It adds to what you already do, it never replaces it,
        and I&apos;ll check back in four weeks so you can watch the numbers move.
      </p>
      {state === "no-session" ? (
        <p className="mt-3 rounded-md px-3 py-2 text-xs font-semibold" style={{ background: "var(--info-soft)", color: "var(--sky-600)" }}>
          Building works from the signed-in device (or open your email link here once).
        </p>
      ) : (
        <button
          type="button"
          onClick={() => void consent()}
          disabled={state === "busy"}
          className="mt-3 inline-flex min-h-11 items-center rounded-pill bg-brand px-5 py-2.5 text-sm font-semibold text-on-brand hover:bg-brand-hover disabled:opacity-50"
        >
          {state === "busy" ? "Building the month\u2026" : `Build ${childName}'s month + check back in 4 weeks`}
        </button>
      )}
    </div>
  );
}
