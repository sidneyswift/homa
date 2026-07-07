"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * The one-tap month. The report ends with the offer instead of leaving
 * THE move buried inside a drawer; the tap is the explicit ask that lets
 * the 28-day retest email arm (email doctrine intact). Session-gated:
 * a shared-link viewer gets the device hint, never a plan built on
 * someone else's family.
 */
export function ConsentCard({
  childId,
  childName,
  domainId,
  subjectName,
}: {
  childId: string;
  childName: string;
  domainId: string;
  subjectName: string;
}) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "busy" | "no-session">("idle");

  async function consent() {
    setState("busy");
    try {
      const response = await fetch("/api/map/plan/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ childId, domainId }),
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
    <div className="mt-9 rounded-lg border border-sage/30 bg-[var(--accent-sage-soft)] p-5 print:hidden">
      <p className="font-display text-lg font-semibold text-strong">
        Want me to build {childName}&apos;s {subjectName.toLowerCase()} month?
      </p>
      <p className="mt-1 text-sm text-body">
        A four-week plan aimed at exactly where {subjectName.toLowerCase()} is growing, and one
        re-check email in four weeks so you can watch the number move. One tap, and it&apos;s
        yours to keep either way.
      </p>
      {state === "no-session" ? (
        <p className="mt-3 text-xs text-muted">
          This works on the device you used for the questionnaire, or open your email link here
          first.
        </p>
      ) : (
        <button
          type="button"
          onClick={() => void consent()}
          disabled={state === "busy"}
          className="mt-3 inline-flex min-h-11 items-center rounded-pill bg-brand px-5 py-2.5 text-sm font-semibold text-on-brand hover:bg-brand-hover disabled:opacity-50"
        >
          {state === "busy" ? "Building the month\u2026" : `Build ${subjectName.toLowerCase()}'s month + check back in 4 weeks`}
        </button>
      )}
    </div>
  );
}
