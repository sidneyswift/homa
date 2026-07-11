"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { ageLabel, MAP_SUBJECTS } from "@homa/core";

import type { FlowChild } from "./flow-types";

/**
 * S4: the scoring beat. Deterministic and instant server-side; this screen
 * is a short beat of theater whose status lines teach what the report is
 * made of. Minimum display time scales with the line count (~2.2s for one
 * kid), then straight to the report, or, when the sitting was a subject
 * deep dive, straight into that subject's freshly rebuilt four-week plan
 * (the founder-expected payoff: deeper answers end in a curriculum, not
 * back where you started).
 *
 * Scores one kid or several: a family that answered for every kid before
 * looking (the next-kid choice) gets all the reports built in this one
 * beat, lands on the first kid's report, and finds the rest ready.
 */

const LINE_STAGGER_MS = 700;

function buildLines(kids: FlowChild[], planSubject: string | null): string[] {
  if (planSubject) {
    const kid = kids[0];
    return [
      `Re-checking ${kid.name}'s answers against national benchmarks\u2026`,
      `Updating ${kid.name}'s progress report\u2026`,
      "Building the four-week plan\u2026",
    ];
  }
  if (kids.length === 1) {
    const kid = kids[0];
    return [
      `Checking ${kid.name}'s answers against national benchmarks\u2026`,
      `Placing ${MAP_SUBJECTS.length} subjects for age ${ageLabel(kid.ageMonths)}\u2026`,
      `Finding ${kid.name}'s strengths\u2026`,
    ];
  }
  return kids.flatMap((kid) => [
    `Checking ${kid.name}'s answers against national benchmarks\u2026`,
    `Finding ${kid.name}'s strengths\u2026`,
  ]);
}

export function ScoringStep({
  kids,
  planSubject = null,
}: {
  /** Every kid to score this beat; the first one's report is the landing. */
  kids: FlowChild[];
  planSubject?: string | null;
}) {
  // Frozen at mount: the parent rebuilds this array every render, and
  // scoring is a one-shot whose effect must not re-fire on a new identity.
  const [frozenKids] = useState(kids);
  const [lineCount, setLineCount] = useState(1);
  const [failed, setFailed] = useState(false);
  const startedAt = useRef<number | null>(null);

  const lines = useMemo(() => buildLines(frozenKids, planSubject), [frozenKids, planSubject]);

  useEffect(() => {
    // Stamped in the effect, not at render (renders must stay pure); the
    // first run wins so a re-render never restarts the minimum-wait clock.
    startedAt.current ??= Date.now();
    const timers = Array.from({ length: lines.length - 1 }, (_, index) =>
      setTimeout(() => setLineCount(index + 2), (index + 1) * LINE_STAGGER_MS),
    );
    const minimumWait = (lines.length - 1) * LINE_STAGGER_MS + 800;

    let cancelled = false;
    void (async () => {
      try {
        // One scoring call per kid, in the order they finished; each call
        // upserts that kid's report and sends their report email once.
        let landingToken: string | null = null;
        for (const kid of frozenKids) {
          const response = await fetch("/api/map/score", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ childId: kid.id }),
          });
          const data = (await response.json()) as { ok: boolean; token?: string };
          if (!data.ok || !data.token) {
            if (!cancelled) setFailed(true);
            return;
          }
          landingToken ??= data.token;
        }
        if (landingToken === null) {
          if (!cancelled) setFailed(true);
          return;
        }
        const elapsed = Date.now() - (startedAt.current ?? Date.now());
        const wait = Math.max(0, minimumWait - elapsed);
        // A fresh report lands IN the app (founder ask 2026-07-10:
        // onboarding ends when the questions do; the report is the
        // app's home surface). The token URL stays the emailed/shared
        // door; deep-dive sittings still land on the rebuilt plan.
        const destination = planSubject
          ? `/onboarding/r/${landingToken}/plan/${planSubject}?rebuilt=1`
          : `/app/${frozenKids[0].id}/report?fresh=1`;
        setTimeout(() => {
          if (!cancelled) window.location.assign(destination);
        }, wait);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [frozenKids, planSubject, lines]);

  if (failed) {
    return (
      <div className="rounded-lg border border-border-subtle bg-card p-6 shadow-sm">
        <p className="font-display text-lg font-semibold text-strong">
          The report didn&apos;t build.
        </p>
        <p className="mt-2 text-body">
          Your answers are saved. Try again now, or come back later with the link in your inbox.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-4 min-h-11 rounded-pill bg-brand px-5 py-2.5 text-sm font-semibold text-on-brand hover:bg-brand-hover"
        >
          Try again
        </button>
      </div>
    );
  }

  const headline =
    frozenKids.length === 1
      ? `Building ${frozenKids[0].name}'s progress report\u2026`
      : "Building the progress reports\u2026";

  return (
    <div aria-busy="true">
      <h1 className="font-display text-3xl font-bold leading-tight text-strong">
        {headline}
      </h1>
      <div className="mt-6 rounded-lg border border-border-subtle bg-card p-6 shadow-sm">
        {/* Keyed by position: two kids can share a name, so the line text
            alone is not unique. The list itself never reorders. */}
        {lines.slice(0, lineCount).map((line, index) => (
          <p key={index} className="mt-2 flex items-center gap-2 text-body first:mt-0">
            <span className={index < lineCount - 1 ? "text-sage" : "text-subtle"} aria-hidden="true">
              {index < lineCount - 1 ? "\u2713" : "\u25cb"}
            </span>
            {line}
          </p>
        ))}
      </div>
      <p className="mt-4 font-hand text-xl text-sage">worth the wait {"\u270e"}</p>
    </div>
  );
}
