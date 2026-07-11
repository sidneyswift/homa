"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { MONTH_PLAN_SUBJECT } from "@homa/core";

import { sendWallBeacon } from "../../../../components/billing/wall-beacon";
import { WALL_STALE_MONTH_LINE } from "../../../../components/billing/wall-copy";
import { WallModal } from "../../../../components/billing/wall-modal";
import type { WallCheckout } from "../../../../lib/billing/wall-types";
import { reportButtonClass } from "./report-button";

/**
 * The one button inside the note from Homa (founder ask 2026-07-08: the
 * month offer lives IN the note, and the note explains it). When the
 * month is already built this is a plain link; before that, the tap IS
 * the consent that builds the unified month and arms the 28-day
 * re-check email (email doctrine intact), then navigates straight to
 * it. Session-gated: a shared-link viewer gets the device hint, never a
 * plan built on someone else's family.
 *
 * The wall (plans/2026-07-11-the-wall.md, DARK behind
 * HOMA_WALL_ENABLED): building a NEW month is a door. A walled family's
 * tap opens the offer instead of building; a month that already exists
 * stays a plain link either way. Every build tap beacons
 * report.action_tapped, flag on or off, for baseline funnel data.
 */
export function MonthButton({
  childId,
  childName,
  planUrl,
  wall = null,
}: {
  childId: string;
  childName: string;
  /** The built month's URL when one exists; null builds on tap. */
  planUrl: string | null;
  /** Checkout URLs when this family is walled; null means the door is open. */
  wall?: WallCheckout | null;
}) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "busy" | "no-session" | "walled">("idle");
  const [wallOpen, setWallOpen] = useState(false);

  async function buildAndOpen() {
    sendWallBeacon({ kind: "door_tap", door: "month", childId });
    if (wall) {
      setWallOpen(true);
      return;
    }
    setState("busy");
    try {
      const response = await fetch("/api/map/plan/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ childId, subjectId: MONTH_PLAN_SUBJECT }),
      });
      if (response.status === 401) {
        setState("no-session");
        return;
      }
      if (response.status === 403) {
        // The wall went up between this page's render and the tap (rare
        // race); the refreshed page carries the offer.
        setState("walled");
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
        {/* ml-1, not a space: the button is inline-flex, which swallows
            whitespace-only text nodes between flex items. aria-hidden
            keeps the glyph out of the accessible name. */}
        Open {childName}&apos;s month{" "}
        <span aria-hidden="true" className="ml-1">
          {"\u2192"}
        </span>
      </Link>
    );
  }

  if (state === "no-session") {
    return (
      // Copy-kit shape, and the SAME wording as CallHomaPs's no-session
      // state: one failure, one vocabulary (editor gate, 2026-07-11).
      <p
        className="mt-3 rounded-md px-3 py-2 text-xs font-semibold print:hidden"
        style={{ background: "var(--info-soft)", color: "var(--sky-600)" }}
      >
        The month didn&apos;t open. I don&apos;t recognize this device yet. Open your email link
        on this device once, then try again.
      </p>
    );
  }

  if (state === "walled") {
    return (
      <p
        className="mt-3 rounded-md px-3 py-2 text-xs font-semibold print:hidden"
        style={{ background: "var(--info-soft)", color: "var(--sky-600)" }}
      >
        {WALL_STALE_MONTH_LINE}
      </p>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => void buildAndOpen()}
        disabled={state === "busy"}
        className={reportButtonClass(
          "primary",
          "mt-3 inline-flex min-h-11 items-center px-5 py-2.5 text-sm font-semibold disabled:opacity-50 print:hidden",
        )}
      >
        {state === "busy" ? (
          // "Opening", not "Building": the letter above already says the
          // month is made, and the reader gate (2026-07-11) caught the
          // contradiction. The lazy first-tap build stays; it is an
          // implementation detail she never asked about.
          `Opening ${childName}'s month\u2026`
        ) : (
          <>
            Open {childName}&apos;s month{" "}
            <span aria-hidden="true" className="ml-1">
              {"\u2192"}
            </span>
          </>
        )}
      </button>
      {wall ? (
        <WallModal
          door="month"
          childName={childName}
          checkout={wall}
          open={wallOpen}
          onClose={() => setWallOpen(false)}
        />
      ) : null}
    </>
  );
}
