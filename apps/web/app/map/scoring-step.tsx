"use client";

import { useEffect, useRef, useState } from "react";

import { ageLabel } from "@homa/core";

import type { FlowChild } from "./flow-types";

/**
 * S4: "drawing the map." Scoring is deterministic and instant server-side;
 * this screen is a short beat of theater whose status lines teach what the
 * map is made of. Minimum display time ~2.2s, then straight to the report.
 */
export function ScoringStep({ child }: { child: FlowChild }) {
  const [lineCount, setLineCount] = useState(1);
  const [failed, setFailed] = useState(false);
  const startedAt = useRef(Date.now());

  const lines = [
    `Checking ${child.name}'s answers against national benchmarks\u2026`,
    `Placing 15 subjects for age ${ageLabel(child.ageMonths)}\u2026`,
    `Finding ${child.name}'s strengths\u2026`,
  ];

  useEffect(() => {
    const timers = [
      setTimeout(() => setLineCount(2), 700),
      setTimeout(() => setLineCount(3), 1400),
    ];

    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/map/score", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ childId: child.id }),
        });
        const data = (await response.json()) as { ok: boolean; token?: string };
        if (!data.ok || !data.token) {
          if (!cancelled) setFailed(true);
          return;
        }
        const elapsed = Date.now() - startedAt.current;
        const wait = Math.max(0, 2_200 - elapsed);
        setTimeout(() => {
          if (!cancelled) window.location.assign(`/map/r/${data.token}?fresh=1`);
        }, wait);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [child.id, child.name]);

  if (failed) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
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

  return (
    <div aria-busy="true">
      <h1 className="font-display text-3xl font-bold leading-tight text-strong">
        Building {child.name}&apos;s progress report{"\u2026"}
      </h1>
      <div className="mt-6 rounded-lg border border-border bg-card p-6 shadow-sm">
        {lines.slice(0, lineCount).map((line, index) => (
          <p key={line} className="mt-2 flex items-center gap-2 text-body first:mt-0">
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
