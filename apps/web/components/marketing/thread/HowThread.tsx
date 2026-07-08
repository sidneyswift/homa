"use client";

import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowRight } from "lucide-react";

import { Logo } from "../../brand/Logo";
import { Button } from "../ds/Button";
import { Eyebrow } from "../dividers";
import { CheckVignette, KidsVignette, ProofVignette, WeekVignette } from "./vignettes";

/**
 * The story thread, ported verbatim from
 * docs/homa-design/ui_kits/landing/LandingPage.jsx: Homa's margin-rule gone
 * for a wander. A squiggly clay path down a ruled notebook page that inks in
 * as you scroll, the Homa mark riding the curve (a white badge so the
 * brand-colored house never blends into the brand-colored ink), and a
 * waypoint per chapter that checks off as the story passes it. The marker
 * is plain HTML positioned over the SVG rather than a foreignObject, same
 * coordinate space (no viewBox scaling), simpler and better supported.
 * Motion notes (review-animations skill):
 * scroll-driven progress (rAF-throttled, passive listener), stroke-dashoffset
 * on SVG paint, waypoint transitions animate background/border/transform at
 * --dur-base --ease-out. Under 880px the gutter/thread hide entirely (kit
 * CSS), which also serves reduced-motion phone users.
 */

type Geom = { d: string; h: number; len: number };
type ThreadState = {
  prog: number;
  passed: boolean[];
  marker: { x: number; y: number } | null;
  geom: Geom | null;
  wpx: number[];
};

const STEPS: ReadonlyArray<{ n: string; title: string; body: string; vignette: ReactNode; action?: ReactNode }> = [
  {
    n: "01",
    title: "Tell Homa about your kids",
    body: "Ages, grades, what you want the year to cover, and how your days actually flow. A few minutes of questions, so the very first week already fits your family.",
    vignette: <KidsVignette />,
  },
  {
    n: "02",
    title: "Sunday night, the week is waiting",
    body: "A balanced draft for every child, shaped around your family\u2019s rhythm. Tweak anything with a tap or a message, Homa keeps the balance for you.",
    vignette: <WeekVignette />,
    action: (
      <Button variant="secondary" href="/onboarding" iconRight={<ArrowRight size={16} aria-hidden="true" />}>
        Get your free progress report
      </Button>
    ),
  },
  {
    n: "03",
    title: "Teach, tap, done",
    body: "Check off lessons as you go, each one lands with a small celebration. When life happens, tell Homa and she reshuffles. A lighter day is still a good day.",
    vignette: <CheckVignette />,
  },
  {
    n: "04",
    title: "Watch the needle move",
    body: "A gentle questionnaire maps each child against your state\u2019s standards. Then Homa targets practice at what\u2019s growing and shows the work paying off.",
    vignette: <ProofVignette />,
  },
];

export function HowThread() {
  const gridRef = useRef<HTMLDivElement | null>(null);
  const stepRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const measRef = useRef<SVGPathElement | null>(null);
  const geomRef = useRef<Geom | null>(null);
  const wpxRef = useRef<number[]>([]);
  const lastH = useRef(0);
  const [st, setSt] = useState<ThreadState>({ prog: 0, passed: [false, false, false, false], marker: null, geom: null, wpx: [] });

  useEffect(() => {
    const ns = "http://www.w3.org/2000/svg";
    const measSvg = document.createElementNS(ns, "svg");
    measSvg.setAttribute("width", "0");
    measSvg.setAttribute("height", "0");
    measSvg.style.cssText = "position:absolute;left:-9999px;top:0;";
    const measPath = document.createElementNS(ns, "path");
    measSvg.appendChild(measPath);
    document.body.appendChild(measSvg);
    measRef.current = measPath;

    /* A gentle S-curve every ~300px, swinging side to side around x=55. */
    const buildPath = (h: number) => {
      const cx = 55,
        amp = 26,
        y0 = 12,
        y1 = Math.max(y0 + 200, h - 110);
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
    const xAtY = (path: SVGPathElement, len: number, y: number) => {
      let lo = 0,
        hi = len;
      for (let k = 0; k < 18; k++) {
        const mid = (lo + hi) / 2;
        if (path.getPointAtLength(mid).y < y) lo = mid;
        else hi = mid;
      }
      return path.getPointAtLength((lo + hi) / 2).x;
    };

    let raf: number | null = null;
    const measure = () => {
      raf = null;
      const grid = gridRef.current,
        mp = measRef.current;
      if (!grid || !mp) return;
      const r = grid.getBoundingClientRect();
      if (!(r.height > 0)) return; /* not laid out yet; retry timers catch up */
      const anchor = window.innerHeight * 0.55;
      const prog = Math.max(0, Math.min(1, (anchor - r.top) / r.height));
      if (!isFinite(prog)) return;
      const h = Math.round(r.height);
      if (!geomRef.current || h !== lastH.current) {
        lastH.current = h;
        const d = buildPath(h);
        mp.setAttribute("d", d);
        geomRef.current = { d, h, len: mp.getTotalLength() };
        wpxRef.current = stepRefs.current.map((s) => {
          if (!s) return 55;
          const y = s.getBoundingClientRect().top - r.top + 17;
          return xAtY(mp, geomRef.current!.len, y);
        });
      }
      const g = geomRef.current;
      if (!g || !(g.len > 0) || !isFinite(g.len)) return;
      const pt = mp.getPointAtLength(g.len * prog);
      const passed = stepRefs.current.map((s) => !!s && s.getBoundingClientRect().top < anchor);
      setSt((prev) => {
        const same = prev.prog === prog && prev.geom === g && passed.every((v, i) => v === prev.passed[i]);
        return same ? prev : { prog, passed, marker: { x: pt.x, y: pt.y }, geom: g, wpx: wpxRef.current };
      });
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
      document.body.removeChild(measSvg);
    };
  }, []);

  const { prog, passed, marker, geom, wpx } = st;

  return (
    <section id="how" style={{ background: "var(--bg-page-warm)", backgroundImage: "var(--bg-paper)", position: "relative", overflow: "hidden" }}>
      <div className="lp-pad" style={{ maxWidth: 1200, margin: "0 auto", padding: "104px 68px 0" }}>
        <div data-reveal="" style={{ textAlign: "center", maxWidth: 640, margin: "0 auto 72px" }}>
          <Eyebrow>How Homa works</Eyebrow>
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(2.2rem, 5.5vw, 3rem)",
              fontWeight: 700,
              letterSpacing: "-0.015em",
              color: "var(--text-strong)",
              margin: "12px 0 0",
              lineHeight: 1.08,
            }}
          >
            From Sunday night
            <br />
            to <span style={{ color: "var(--clay-600)" }}>proof</span>.
          </h2>
          <p style={{ color: "var(--text-muted)", fontSize: "1.1rem", lineHeight: 1.6, margin: "18px auto 0", maxWidth: 460 }}>
            One calm loop, week after week. Follow the thread.
          </p>
        </div>

        <div className="ht-grid" ref={gridRef} style={{ position: "relative", display: "grid", gridTemplateColumns: "110px 1fr" }}>
          {geom && (
            <svg
              className="ht-line"
              width="110"
              height={geom.h}
              aria-hidden="true"
              style={{ position: "absolute", left: 0, top: 0, overflow: "visible", pointerEvents: "none" }}
            >
              <path d={geom.d} fill="none" stroke="var(--clay-100)" strokeWidth="6" strokeLinecap="round" />
              <path
                d={geom.d}
                fill="none"
                stroke="var(--brand)"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={geom.len}
                strokeDashoffset={geom.len * (1 - prog)}
              />
            </svg>
          )}

          {marker && (
            <div
              aria-hidden="true"
              style={{
                position: "absolute",
                left: marker.x,
                top: marker.y,
                transform: "translate(-50%, -50%)",
                width: 34,
                height: 34,
                borderRadius: "50%",
                background: "#fff",
                border: "3.5px solid var(--brand)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "var(--shadow-sm)",
                pointerEvents: "none",
              }}
            >
              <Logo variant="mark" size={19} />
            </div>
          )}

          {STEPS.map((s, i) => (
            <Fragment key={s.n}>
              <div className="ht-gutter" style={{ display: "flex", justifyContent: "center", alignItems: "flex-start" }}>
                <span
                  ref={(el) => {
                    stepRefs.current[i] = el;
                  }}
                  style={{
                    position: "relative",
                    zIndex: 2,
                    width: 34,
                    height: 34,
                    borderRadius: "50%",
                    marginTop: 2,
                    left: (wpx[i] || 55) - 55,
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
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.68rem", color: "var(--text-subtle)" }}>{s.n}</span>
                  )}
                </span>
              </div>
              <div
                data-reveal=""
                className="ht-step"
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 420px",
                  gap: 64,
                  alignItems: "start",
                  padding: i === STEPS.length - 1 ? "0 16px 96px 44px" : "0 16px 15vh 44px",
                  minHeight: i === STEPS.length - 1 ? "auto" : "46vh",
                }}
              >
                <div>
                  <div style={{ fontFamily: "var(--font-mono)", color: "var(--brand)", fontSize: "0.85rem", letterSpacing: "0.14em" }}>{s.n}</div>
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
                  {s.action && <div style={{ marginTop: 24 }}>{s.action}</div>}
                </div>
                <div className="ht-vig" style={{ display: "flex", justifyContent: "center", marginTop: 34 }}>
                  {s.vignette}
                </div>
              </div>
            </Fragment>
          ))}
        </div>
      </div>
    </section>
  );
}
