"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { sendWallBeacon } from "../../../../components/billing/wall-beacon";
import { reportButtonClass } from "../../../onboarding/r/[token]/report-button";

/**
 * The unlock's landing moment (plans/2026-07-18-report-lock.md): the
 * confirm route sends a fresh trial back to the child's report with
 * ?welcome=1, and this sheet turns the open report into one default
 * next step: pick the subject the first four-week plan comes from.
 * The verified funnel's break is the decision point after the report
 * (five equal choices, no default), so the trial's first minute gets
 * exactly one.
 *
 * Same scrim-and-card recipe and escape hatches as WallModal: Escape,
 * tap outside, and a plain "I'll explore on my own" all close it, and
 * closing costs nothing (offers never commands).
 */
export function WelcomeChooser({
  childId,
  childName,
  token,
  subjects,
}: {
  childId: string;
  childName: string;
  token: string;
  subjects: { id: string; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();

  function dismiss() {
    router.replace(pathname, { scroll: false });
  }

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") router.replace(pathname, { scroll: false });
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router, pathname]);

  return (
    <div className="wall-overlay" onClick={dismiss}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${childName}'s full report is open`}
        className="wall-card"
        onClick={(event) => event.stopPropagation()}
      >
        <p
          className="font-mono text-[0.65rem] uppercase tracking-widest"
          style={{ color: "var(--sage-700)" }}
        >
          Your 30 free days started
        </p>
        <h2 className="mt-2 font-display text-2xl font-bold leading-tight text-strong">
          {childName}&apos;s full report is open.
        </h2>
        <p className="mt-3 text-body">
          Every subject is yours now. If you like, choose where {childName}&apos;s first week
          starts and Homa builds the four-week plan. You can switch anytime.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          {subjects.map((subject) => (
            <Link
              key={subject.id}
              href={`/onboarding/r/${token}/plan/${subject.id}`}
              onClick={() => sendWallBeacon({ kind: "door_tap", door: "plan", childId })}
              className={reportButtonClass(
                "secondary",
                "inline-flex min-h-10 items-center px-4 py-2 text-xs font-semibold",
              )}
            >
              {subject.name}
            </Link>
          ))}
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="mt-5 text-sm text-muted underline underline-offset-2 transition-colors duration-(--dur-fast) ease-out hover:text-strong"
        >
          I&apos;ll explore on my own
        </button>
      </div>
    </div>
  );
}
