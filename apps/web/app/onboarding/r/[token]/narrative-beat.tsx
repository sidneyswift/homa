"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";

import { Doodle } from "../../../../components/marketing/Doodle";

/**
 * The honest writing beat (D8 overturn, founder ruling: quality over
 * speed, NO countdown, NO cap). Lives on the report's permanent URL so a
 * refresh and the emailed link are both safe: it polls the token-scoped
 * status endpoint until the narrative leaves "writing", then refreshes
 * the server component, which renders the finished report. The rotating
 * lines are real facts about this report, never invented progress.
 *
 * Delight pass (2026-07-07, founder: "add a delightful waiting animation,
 * make the whole experience more exciting"). The wait is now a small
 * scene rather than a static status line: each honest line rises in and
 * a hand-drawn underline writes itself beneath it (the report is being
 * WRITTEN, so the motif is a pen stroke), while brand doodles drift and
 * twinkle behind it. All motion is CSS in globals.css (.nb-*), tokens
 * only, and fully disabled under reduced-motion. The doodles are pure
 * decoration (aria-hidden); the status line stays an aria-live region so
 * the experience is unchanged for a screen reader.
 */

const POLL_MS = 2500;
const ROTATE_MS = 3600;

/** Ambient doodles, kept to the top and right band so they never sit
 * under the left-aligned status text or the "worth the wait" note.
 * Colors are accent tokens; the playful set is the brand's own device. */
const DOODLES: ReadonlyArray<{
  name: "sparkle" | "star" | "flower" | "cloud";
  color: string;
  size: number;
  position: CSSProperties;
  floatDelay: string;
  twinkleDelay: string;
  rotate?: number;
}> = [
  { name: "sparkle", color: "var(--gold-400)", size: 22, position: { top: "16px", right: "20px" }, floatDelay: "0ms", twinkleDelay: "0ms" },
  { name: "star", color: "var(--clay-300)", size: 15, position: { top: "46%", right: "16px" }, floatDelay: "700ms", twinkleDelay: "500ms", rotate: 12 },
  { name: "flower", color: "var(--sage-300)", size: 19, position: { bottom: "18px", right: "30px" }, floatDelay: "1300ms", twinkleDelay: "1000ms" },
  { name: "sparkle", color: "var(--sky-500)", size: 12, position: { top: "30px", right: "78px" }, floatDelay: "400ms", twinkleDelay: "1500ms" },
];

/** After this long, the beat admits the wait is unusual and offers a
 * manual refresh (read-through: the live plan build appeared to stall
 * with no way out; the self-heal keeps working underneath either way). */
const LONG_WAIT_MS = 90 * 1000;

export function NarrativeBeat({
  token,
  subjectId,
  lines,
}: {
  token: string;
  /** Set on the plan page's beat; the report beat omits it. */
  subjectId?: string;
  /** Honest rotating status lines, first one shown immediately. */
  lines: string[];
}) {
  const router = useRouter();
  const [lineIndex, setLineIndex] = useState(0);
  const [longWait, setLongWait] = useState(false);
  const settled = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => setLongWait(true), LONG_WAIT_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const rotate = setInterval(() => {
      setLineIndex((current) => (current + 1) % lines.length);
    }, ROTATE_MS);
    return () => clearInterval(rotate);
  }, [lines.length]);

  useEffect(() => {
    let cancelled = false;
    const query = subjectId
      ? `token=${encodeURIComponent(token)}&subject=${encodeURIComponent(subjectId)}`
      : `token=${encodeURIComponent(token)}`;

    async function poll() {
      try {
        const response = await fetch(`/api/map/narrative-status?${query}`);
        const data = (await response.json()) as { ok: boolean; status?: string };
        if (cancelled || settled.current) return;
        if (data.ok && data.status && data.status !== "writing" && data.status !== "none") {
          settled.current = true;
          router.refresh();
        }
      } catch {
        // Transient poll failure: the next tick retries; the report is
        // not blocked on this request ever succeeding.
      }
    }

    const timer = setInterval(() => void poll(), POLL_MS);
    void poll();
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [token, subjectId, router]);

  return (
    <div
      aria-busy="true"
      className="relative overflow-hidden rounded-lg border border-border-subtle bg-card p-6 shadow-sm"
    >
      {/* Ambient doodle layer: decoration only, never announced, never
          intercepts taps. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        {DOODLES.map((doodle, index) => (
          <span
            key={index}
            className="nb-float absolute inline-block"
            style={{ ...doodle.position, animationDelay: doodle.floatDelay }}
          >
            <span className="nb-twinkle inline-block" style={{ animationDelay: doodle.twinkleDelay }}>
              <Doodle name={doodle.name} size={doodle.size} color={doodle.color} rotate={doodle.rotate} />
            </span>
          </span>
        ))}
      </div>

      <div className="relative">
        {/* Stable live region wraps a keyed child: the wrapper announces
            the change for screen readers, the keyed child remounts so the
            rise-in and self-drawing underline replay on every new line. */}
        <div aria-live="polite" aria-atomic="true">
          <div key={lineIndex}>
            <p className="nb-line font-display text-lg font-semibold text-strong">
              {lines[lineIndex]}
            </p>
            {/* Self-writing pen stroke: pathLength=1 lets the dash draw
                run without measuring the squiggle's real geometry. */}
            <svg
              aria-hidden="true"
              className="mt-1.5 h-2.5 w-44 max-w-full"
              viewBox="0 0 160 10"
              fill="none"
              preserveAspectRatio="none"
            >
              <path
                className="nb-draw"
                d="M2 7 Q 40 1 80 6 T 158 4"
                pathLength={1}
                stroke="var(--clay-400)"
                strokeWidth={2.5}
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>

        <p className="mt-4 text-sm text-muted">
          This takes as long as good writing takes, usually under a minute. The page updates
          itself; leaving and coming back is safe too.
        </p>
        {longWait ? (
          <p className="mt-2 text-sm text-muted">
            This one is taking longer than usual. Nothing is lost:{" "}
            <button
              type="button"
              onClick={() => router.refresh()}
              className="font-semibold text-brand underline underline-offset-2"
            >
              refresh now
            </button>{" "}
            or come back in a minute.
          </p>
        ) : null}
        <p className="mt-4 font-hand text-xl text-sage">worth the wait {"\u270e"}</p>
      </div>
    </div>
  );
}
