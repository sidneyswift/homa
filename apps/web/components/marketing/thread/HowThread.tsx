"use client";

import { Fragment, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

import { Logo } from "../../brand/Logo";
import { Eyebrow } from "../dividers";
import { Doodle } from "../Doodle";
import { CheckVignette, KidsVignette, ProofVignette, WeekVignette } from "./vignettes";

/**
 * The story thread, ported from docs/homa-design/ui_kits/landing/
 * LandingPage.jsx and reworked in the AAA pass: Homa's margin-rule gone for a
 * wander. A squiggly clay path down a ruled notebook page that inks in as you
 * scroll, the Homa mark riding the curve (a white badge so the brand-colored
 * house never blends into the brand-colored ink), and a waypoint per chapter
 * that checks off as the story passes it. Notebook furniture completes the
 * sheet: hole punches down the far-left edge, sticker doodles and Caveat
 * margin notes hanging off the waypoints, and a torn deckle edge into the
 * blush band below (a ruled sheet should not end in a perfect sine).
 *
 * Motion notes (review-animations skill): scroll-driven progress
 * (rAF-throttled, passive listener) writes stroke-dashoffset and the marker
 * transform imperatively through refs, so the 4-step subtree never re-renders
 * per frame; only the four "passed" booleans live in React state. The whole
 * scroll engine is gated on matchMedia(min-width: 881px), so phones (where
 * the kit CSS hides the gutter/thread/marker) never attach the listener.
 * Under prefers-reduced-motion the ink renders fully drawn, the riding marker
 * hides, and waypoint transitions are cut; checked/unchecked state stays the
 * sole progress signal.
 */

type StepDecor =
  | { kind: "sticker"; node: ReactNode; style: CSSProperties }
  | { kind: "note"; text: string; className: string };

const STEPS: ReadonlyArray<{ n: string; title: string; body: string; vignette: ReactNode; decor?: StepDecor }> = [
  {
    n: "01",
    title: "Your family setup",
    body: "Ages, grades, goals, and a typical week give Homa the starting point.",
    vignette: <KidsVignette />,
    decor: {
      kind: "sticker",
      node: <Doodle name="star" size={17} color="var(--gold-400)" rotate={14} />,
      style: { left: 36, top: -12 },
    },
  },
  {
    n: "02",
    title: "Your weekly plan",
    body: "Your curriculum and schedule shape the plan for each child. Homa can revise later lessons after a sick day, field trip, or lighter morning.",
    vignette: <WeekVignette />,
    decor: {
      kind: "note",
      text: "plans can bend",
      className: "ht-note-plan",
    },
  },
  {
    n: "03",
    title: "Your lesson record",
    body: "After a lesson, you can check it off, send a few words, or snap a photo. Homa keeps what you share in the record. A lighter day is still part of the week.",
    vignette: <CheckVignette />,
    decor: {
      kind: "sticker",
      node: <Doodle name="sparkle" size={14} color="var(--sky-500)" rotate={8} />,
      style: { left: -26, top: 26 },
    },
  },
  {
    n: "04",
    title: "Your progress report",
    body: "The first report begins with the five-minute questionnaire. Later notes and check-ins add new answers. The report shows what looks solid and what comes next. Homa can use that next step in a new practice page.",
    vignette: <ProofVignette />,
    decor: {
      kind: "note",
      text: "it all adds up",
      className: "ht-note-adds",
    },
  },
];

/* Irregular deckle: generated once (seeded quads, 22-56px wide, 8-14px deep),
   then hand-roughened: a dozen bumps became sharp two-segment facets and four
   of those bite deeper (y 20-23), so the whole edge, the x=0 corner included,
   reads as a tear, not trim. */
const DECKLE_D =
  "M0 15 L 9 7.8 L 18 13.6 L 37 6.8 L 51 14.3 L 76 6.9 L 84 16.0 L 112 6.2 L 124 20.8 L 160 5.1 L 174 21.6 Q 197 7.5 220 10.4 Q 243 6.3 265 17.4 L 301 4.6 L 314 14.1 Q 341 7.4 367 15.2 Q 388 8.6 409 17.3 L 434 5.4 L 444 16.7 Q 461 4.8 477 12.4 Q 496 5.5 514 17.5 Q 535 7.6 555 17.0 L 572 5.0 L 579 14.5 Q 599 6.1 618 11.5 Q 645 4.3 671 12.9 L 694 6.6 L 705 22.4 Q 725 4.8 745 13.2 Q 761 5.8 777 13.4 Q 794 6.7 810 14.9 Q 825 8.5 840 13.7 Q 866 7.2 891 15.1 L 919 6.2 L 931 15.5 Q 958 6.0 985 15.7 Q 1001 6.9 1016 12.8 L 1041 5.7 L 1049 16.4 Q 1075 4.6 1101 16.6 Q 1114 6.0 1126 11.2 Q 1139 9.0 1151 11.8 Q 1173 4.7 1195 13.7 Q 1216 4.7 1237 17.4 L 1274 7.7 L 1289 22.8 Q 1316 7.8 1342 12.2 Q 1353 5.2 1364 10.6 Q 1375 7.1 1386 11.9 Q 1410 6.4 1433 15.5 Q 1448 8.4 1440 11.9 L 1440 56 L 0 56 Z";

const HT_CSS = `
.ht-step {
  display: grid;
  grid-template-columns: 1fr 420px;
  gap: 64px;
  align-items: start;
  padding: 0 16px min(12vh, 88px) 44px;
  min-height: min(40vh, 360px);
}
/* Step 03's short copy made it the one row where min-height, not content,
   set the exit interval (154px of bare band vs the 88px the others
   breathe). Releasing min-height there hands the gap back to the shared
   padding, so all three intervals land on the same rhythm. */
.ht-step-3 { min-height: 0; }
.ht-step-last { padding-bottom: 40px; min-height: 0; }
.ht-vig { display: flex; justify-content: center; margin-top: 12px; }
/* nowrap keeps the emphasized phrase one unbreakable unit on wide screens;
   balance then lands the break before it at every measure. Narrow screens
   release it below, before it outgrows the viewport. */
.ht-h2-em { color: var(--clay-600); white-space: nowrap; }
/* Notes anchor to the stable gutter cell, never the waypoint span: the
   scroll engine slides each waypoint onto the squiggle (up to ~20px of
   sideways swing) and pops it between scale(0.9) and scale(1), so a note
   parented there inherits an unpredictable x and clips against the
   section's overflow: hidden on laptop widths. */
.ht-note {
  position: absolute;
  top: -4px;
  right: 84px;
  display: block;
  width: 120px;
  font-family: var(--font-hand);
  font-weight: 600;
  font-size: 1.4rem;
  line-height: 1.02;
  text-align: right;
  color: var(--sage-700);
  white-space: normal;
  pointer-events: none;
}
/* Waypoint 02 rides the squiggle ~14px left of gutter center, so the plan
   note gets a tighter right edge than the adds note to clear the circle. */
.ht-note-plan { right: 90px; transform: rotate(-5deg); }
.ht-note-adds { top: 0; transform: rotate(-4deg); }
/* Tablet-band stand-in for the margin notes: same Caveat voice, set inline
   beside the step numeral where the hidden gutter can no longer carry it. */
.ht-note-inline {
  display: none;
  font-family: var(--font-hand);
  font-weight: 600;
  font-size: 1.25rem;
  line-height: 1;
  letter-spacing: normal;
  color: var(--sage-700);
  transform: rotate(-4deg);
  transform-origin: left bottom;
  pointer-events: none;
}
.ht-sticker { position: absolute; display: block; pointer-events: none; }
@media (min-width: 881px) and (max-width: 1100px) {
  /* The fixed 420px vignette track plus the 64px gap starved the copy column
     to a ~160px measure here (one-word h3 lines, 3-4 word body rags). A
     narrower artifact and gap hand the band back to the text; the 110px
     .ht-grid gutter stays untouched (the squiggle cx=55 depends on it). */
  .ht-step { grid-template-columns: 1fr 340px; gap: 36px; }
  .ht-step h3 { font-size: clamp(1.45rem, 3vw, 1.8rem) !important; }
}
@media (max-width: 1380px) {
  /* Under ~56px of container side margin the single-line note would poke
     past the section's overflow: hidden and amputate mid-word. This tier
     wraps each note to two natural lines ("plans can / bend"), which the
     side margin still affords down to ~1265px. */
  .ht-note { width: 92px; }
  .ht-note-plan { width: 86px; }
  /* 68px sits between "adds up" (58px) and "it all adds" (75px), so the
     note breaks "it all / adds up" instead of stranding "up" alone. */
  .ht-note-adds { width: 68px; }
}
@media (max-width: 1264px) {
  /* No spare margin left: bound the note box on both sides instead of
     trusting width math. left: -34px pins the box's left edge 6px inside
     the section (gutter-left sits at the container's 40px pad here), so no
     font-metric or user font-size change can amputate a line. Width
     resolves to ~60px (54px for the plan note via its right: 90px), the
     compact right-aligned tower. */
  .ht-note { left: -34px; width: auto; }
}
@media (min-width: 561px) and (max-width: 880px) {
  /* The kit CSS hides the gutter/thread here, which flattened the band into
     a left-stacked list over dead ruled paper. Hang the taped artifacts on
     the right rail (copy rags left, cards rag right: the two-rail tension
     the thread carried). */
  .ht-step .ht-vig { justify-content: flex-end !important; }
}
@media (min-width: 401px) and (max-width: 880px) {
  /* Keep the hand-written notes alive inline all the way down to phones:
     below 561 they were hidden with the gutter, stripping the section's two
     most human lines exactly where warmth is scarcest. Off below 401 where
     the numeral row tightens (the 400px block reworks step padding). */
  .ht-note-inline { display: inline-block; margin-left: 14px; vertical-align: -0.1em; }
}
@media (max-width: 880px) {
  /* Phones drop the desktop scroll geometry entirely: no viewport-tall
     steps, no asymmetric gutters. A slim static clay rule keeps a whisper
     of the thread where the kit CSS hides .ht-line. */
  .ht-grid { border-left: 3px solid var(--clay-200); }
  /* Same vertical collapse .lp-section gives the other sections; this one
     ends at 0 (the wave below owns the exit), so only the top shrinks. */
  .ht-head { padding-top: 64px !important; }
}
@media (max-width: 430px) {
  /* Release the h2's unbreakable accent phrase only once the measure truly
     cannot hold it (~430px): releasing earlier let the browser split "plans
     and records" mid-unit at 430-560 even though the whole phrase fit. Below
     here, kept whole, it would clip against the section's overflow: hidden. */
  .ht-h2-em { white-space: normal; }
}
@media (max-width: 400px) {
  .ht-step { min-height: 0; padding: 0 4px 60px 18px; gap: 24px; }
  .ht-step-last { padding-bottom: 28px; }
  .ht-vig { margin-top: 0; }
  .ht-punch { display: none; }
}
@media (max-width: 360px) {
  /* One step under the finale clamp's 2.2rem floor: at 320-360 the freed
     phrase otherwise rebalances into a stack that strands "together." as a
     one-word closing line. */
  .ht-head h2 { font-size: 2rem; }
}
@media (prefers-reduced-motion: reduce) {
  .ht-ink { stroke-dashoffset: 0 !important; }
  .ht-marker { display: none !important; }
  .ht-node { transition: none !important; }
}
`;

export function HowThread() {
  const gridRef = useRef<HTMLDivElement | null>(null);
  const stepRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const trackRef = useRef<SVGPathElement | null>(null);
  const inkRef = useRef<SVGPathElement | null>(null);
  const markerRef = useRef<HTMLDivElement | null>(null);
  const [engaged, setEngaged] = useState(false);
  const [passed, setPassed] = useState<boolean[]>([false, false, false, false]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 881px)");
    const sync = () => setEngaged(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!engaged) return;
    let lastH = 0;
    let len = 0;
    let pathEndY = 0;
    let raf: number | null = null;

    /* A gentle S-curve every ~300px, swinging side to side around x=55.
       The ink ends AT the final waypoint's center, never dangling past it:
       the thread finishes where the story does. */
    const buildPath = (h: number, endY: number) => {
      const cx = 55,
        amp = 26,
        y0 = 12,
        y1 = Math.max(y0 + 200, Math.min(endY, h - 20));
      const n = Math.max(2, Math.round((y1 - y0) / 300));
      const seg = (y1 - y0) / n;
      let d = `M ${cx} ${y0}`;
      for (let i = 0; i < n; i++) {
        const a = amp * (i % 2 ? -1 : 1);
        const ys = y0 + seg * i;
        d += ` C ${cx + a} ${(ys + seg * 0.3).toFixed(1)}, ${cx + a} ${(ys + seg * 0.7).toFixed(1)}, ${cx} ${(ys + seg).toFixed(1)}`;
      }
      return d;
    };
    /* Where the squiggle sits at a given height, so waypoints snap onto it. */
    const xAtY = (path: SVGPathElement, total: number, y: number) => {
      let lo = 0,
        hi = total;
      for (let k = 0; k < 18; k++) {
        const mid = (lo + hi) / 2;
        if (path.getPointAtLength(mid).y < y) lo = mid;
        else hi = mid;
      }
      return path.getPointAtLength((lo + hi) / 2).x;
    };

    const measure = () => {
      raf = null;
      const grid = gridRef.current,
        track = trackRef.current,
        ink = inkRef.current,
        svg = svgRef.current,
        markerEl = markerRef.current;
      if (!grid || !track || !ink || !svg || !markerEl) return;
      const r = grid.getBoundingClientRect();
      if (!(r.height > 0)) return; /* not laid out yet; retry timers catch up */
      const anchor = window.innerHeight * 0.55;
      const h = Math.round(r.height);
      if (h !== lastH) {
        lastH = h;
        const last = stepRefs.current[STEPS.length - 1];
        const endY = last ? last.getBoundingClientRect().top - r.top + 17 : h - 110;
        const d = buildPath(h, endY);
        track.setAttribute("d", d);
        ink.setAttribute("d", d);
        svg.setAttribute("height", String(h));
        len = track.getTotalLength();
        if (!(len > 0) || !isFinite(len)) {
          lastH = 0; /* stale geometry; remeasure on the next tick */
          return;
        }
        pathEndY = endY;
        ink.style.strokeDasharray = String(len);
        for (const s of stepRefs.current) {
          if (!s) continue;
          const y = s.getBoundingClientRect().top - r.top + 17;
          s.style.left = `${xAtY(track, len, y) - 55}px`;
        }
      }
      if (!(len > 0)) return;
      /* Progress is measured against the path's real end (waypoint 04), so
         the ink completes exactly as the last chapter checks off. */
      const prog = Math.max(0, Math.min(1, (anchor - r.top) / (pathEndY > 0 ? pathEndY : h)));
      if (!isFinite(prog)) return;
      ink.style.strokeDashoffset = String(len * (1 - prog));
      const pt = track.getPointAtLength(len * prog);
      markerEl.style.transform = `translate(${pt.x.toFixed(1)}px, ${pt.y.toFixed(1)}px) translate(-50%, -50%)`;
      markerEl.style.opacity = "1";
      const next = stepRefs.current.map((s) => !!s && s.getBoundingClientRect().top < anchor);
      setPassed((prev) => (next.every((v, i) => v === prev[i]) ? prev : next));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(measure);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    measure();
    const t1 = setTimeout(measure, 400);
    const t2 = setTimeout(measure, 1400);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [engaged]);

  return (
    <section
      id="how"
      style={{
        background: "var(--bg-page-warm)",
        backgroundImage: "var(--bg-paper)",
        position: "relative",
        zIndex: 1,
        overflow: "hidden",
        /* The deckle below supersedes the page-level Wave seam into the blush
           band: this pull-down lets the deckle's solid body cover that 44px
           strip, so the torn edge IS the seam. */
        marginBottom: -44,
      }}
    >
      <style>{HT_CSS}</style>

      {/* Notebook hole punches down the far-left edge. */}
      {["16%", "50%", "84%"].map((top) => (
        <span
          key={top}
          className="ht-punch"
          aria-hidden="true"
          style={{
            position: "absolute",
            left: 26,
            top,
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: "var(--border-subtle)",
            boxShadow: "var(--shadow-inset)",
          }}
        />
      ))}

      {/* 40px side padding, not 68: every other section's rail is the
          1200/40 master container, and a private gutter dissolved the grid
          the top half establishes. Top padding 72, not 104: stacked with
          the report section's bottom padding and the seam wave it made the
          page's largest cream void (2026-07-26 composition pass). */}
      <div className="lp-pad ht-head" style={{ maxWidth: 1200, margin: "0 auto", padding: "72px 40px 0" }}>
        <div data-reveal="" style={{ textAlign: "center", maxWidth: 640, margin: "0 auto 64px" }}>
          <Eyebrow>How Homa works</Eyebrow>
          <h2 className="lp-h2 lp-h2-finale" style={{ color: "var(--text-strong)", margin: "12px 0 0" }}>
            How Homa keeps <span className="ht-h2-em">plans and records</span> together.
          </h2>
          <p style={{ color: "var(--text-muted)", fontSize: "1.1rem", lineHeight: 1.6, margin: "18px auto 0", maxWidth: 460 }}>
            After you share what the week needs, Homa builds the plan. You can send a few words or a photo after a lesson. Homa keeps the plan and record together.
          </p>
        </div>

        <div className="ht-grid" ref={gridRef} style={{ position: "relative", display: "grid", gridTemplateColumns: "110px 1fr" }}>
          <svg
            ref={svgRef}
            className="ht-line"
            width="110"
            height="0"
            aria-hidden="true"
            style={{ position: "absolute", left: 0, top: 0, overflow: "visible", pointerEvents: "none" }}
          >
            {/* clay-200, not 100: the un-inked thread is wayfinding for the
                whole band and has to survive the tan paper at reading
                distance, especially across the empty inter-step intervals. */}
            <path ref={trackRef} fill="none" stroke="var(--clay-200)" strokeWidth="6" strokeLinecap="round" />
            <path ref={inkRef} className="ht-ink" fill="none" stroke="var(--brand)" strokeWidth="6" strokeLinecap="round" />
          </svg>

          <div
            ref={markerRef}
            className="ht-marker"
            aria-hidden="true"
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              zIndex: 3,
              opacity: 0,
              width: 30,
              height: 30,
              borderRadius: "50%",
              background: "#fff",
              border: "3px solid var(--brand)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "var(--shadow-sm)",
              pointerEvents: "none",
            }}
          >
            <Logo variant="mark" size={17} />
          </div>

          {STEPS.map((s, i) => (
            <Fragment key={s.n}>
              <div className="ht-gutter" style={{ position: "relative", display: "flex", justifyContent: "center", alignItems: "flex-start" }}>
                <span
                  ref={(el) => {
                    stepRefs.current[i] = el;
                  }}
                  className="ht-node"
                  style={{
                    position: "relative",
                    zIndex: 2,
                    width: 34,
                    height: 34,
                    borderRadius: "50%",
                    marginTop: 2,
                    background: passed[i] ? "var(--sage-500)" : "var(--surface-card)",
                    border: passed[i] ? "2px solid var(--sage-500)" : "2px solid var(--border-default)",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: passed[i] ? "var(--shadow-sm)" : "var(--shadow-xs)",
                    transform: passed[i] ? "scale(1)" : "scale(0.9)",
                    transition:
                      "background var(--dur-base) var(--ease-out), border-color var(--dur-base) var(--ease-out), transform var(--dur-base) var(--ease-out)",
                  }}
                >
                  {passed[i] ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 12.5 L9.5 18 L20 6.5" />
                    </svg>
                  ) : (
                    /* Empty ring, not a repeated step number: the copy-column
                       eyebrow already carries the numeral at legible size. */
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--border-default)" }} />
                  )}
                  {s.decor?.kind === "sticker" && (
                    <span className="ht-sticker" aria-hidden="true" style={s.decor.style}>
                      {s.decor.node}
                    </span>
                  )}
                </span>
                {s.decor?.kind === "note" && (
                  <span className={`ht-note ${s.decor.className}`} aria-hidden="true">
                    {s.decor.text}
                  </span>
                )}
              </div>
              <div data-reveal="" className={`ht-step${i === 2 ? " ht-step-3" : ""}${i === STEPS.length - 1 ? " ht-step-last" : ""}`}>
                <div>
                  {/* clay-700, not 600: this band is warmer than bg-page, and
                    600 lands at 4.18:1 there (AA needs 4.5 at this size). */}
                <div style={{ fontFamily: "var(--font-mono)", color: "var(--clay-700)", fontSize: "0.85rem", fontWeight: 600, letterSpacing: "0.14em" }}>
                    {s.n}
                    {s.decor?.kind === "note" && (
                      <span className="ht-note-inline" aria-hidden="true">
                        {s.decor.text}
                      </span>
                    )}
                  </div>
                  <h3
                    style={{
                      fontFamily: "var(--font-display)",
                      fontSize: "clamp(1.7rem, 4vw, 2.2rem)",
                      fontWeight: 600,
                      letterSpacing: "0",
                      color: "var(--text-strong)",
                      margin: "10px 0 14px",
                      lineHeight: 1.12,
                    }}
                  >
                    {s.title}
                  </h3>
                  <p style={{ color: "var(--text-muted)", lineHeight: 1.62, fontSize: "1.05rem", margin: 0, maxWidth: 470 }}>{s.body}</p>
                </div>
                <div className="ht-vig">{s.vignette}</div>
              </div>
            </Fragment>
          ))}
        </div>
      </div>

      {/* Torn deckle edge into the blush band below: a ruled sheet should not
          end in a perfect sine. */}
      <svg viewBox="0 0 1440 56" preserveAspectRatio="none" aria-hidden="true" style={{ display: "block", width: "100%", height: 56, marginTop: -20 }}>
        <path d={DECKLE_D} fill="var(--band-blush)" />
      </svg>
    </section>
  );
}
