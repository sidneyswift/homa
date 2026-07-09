"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { MONTH_PLAN_DOMAIN } from "@homa/core";

import { reportButtonClass } from "./report-button";

/**
 * The one button inside the note from Homa (founder ask 2026-07-08: the
 * month offer lives IN the note, and the note explains it). When the
 * month is already built this is a plain link; before that, the tap IS
 * the consent that builds the unified month and arms the 28-day
 * re-check email (email doctrine intact), then navigates straight to
 * it. Session-gated: a shared-link viewer gets the device hint, never a
 * plan built on someone else's family.
 */
export function MonthButton({
  childId,
  childName,
  planUrl,
}: {
  childId: string;
  childName: string;
  /** The built month's URL when one exists; null builds on tap. */
  planUrl: string | null;
}) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "busy" | "no-session">("idle");

  async function buildAndOpen() {
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

  if (planUrl) {
    return (
      <Link
        href={planUrl}
        className={reportButtonClass(
          "primary",
          "mt-3 inline-flex min-h-11 items-center px-5 py-2.5 text-sm font-semibold print:hidden",
        )}
      >
        Open {childName}&apos;s month {"\u2192"}
      </Link>
    );
  }

  if (state === "no-session") {
    return (
      <p
        className="mt-3 rounded-md px-3 py-2 text-xs font-semibold print:hidden"
        style={{ background: "var(--info-soft)", color: "var(--sky-600)" }}
      >
        Opening works from the signed-in device (or open your email link here once).
      </p>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void buildAndOpen()}
      disabled={state === "busy"}
      className={reportButtonClass(
        "primary",
        "mt-3 inline-flex min-h-11 items-center px-5 py-2.5 text-sm font-semibold disabled:opacity-50 print:hidden",
      )}
    >
      {state === "busy" ? `Building ${childName}'s month\u2026` : `Open ${childName}'s month \u2192`}
    </button>
  );
}
