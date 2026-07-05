"use client";

import { useState, type CSSProperties } from "react";
import { ChevronDown } from "lucide-react";

import { Chip } from "../ds/Chip";
import { Doodle } from "../Doodle";
import { Eyebrow } from "../dividers";
import { DemoMap } from "./DemoMap";
import { SkillWeb } from "./SkillWeb";

/**
 * Benchmark demo, ported verbatim from
 * docs/homa-design/ui_kits/landing/LandingPage.jsx: proof of smarts,
 * gently. Progressive disclosure: three gentle checklist questions redraw a
 * live skill map; the technical mechanics stay folded behind one calm
 * toggle. Peek panel expands via the .lp-peek grid-rows transition
 * (interruptible, reduced-motion collapses to a fade); the chevron rotates
 * at --dur-base --ease-out; the summary strip re-pops via .bd-sum.
 */

type Answers = { read: number | null; count: number | null; frac: number | null };

const READING_NODES = ["Letters", "Blending", "Words", "Sentences", "Stories", "Comprehension"] as const;
const MATH_NODES = ["Count to 20", "Adding up", "Two-digit", "Times tables", "Halves", "Fractions"] as const;

const QUESTIONS: ReadonlyArray<{ id: keyof Answers; subj: string; q: string }> = [
  { id: "read", subj: "Reading", q: "Can they read simple words, like cat and dog?" },
  { id: "count", subj: "Math", q: "Can they count past 20 without a wobble?" },
  { id: "frac", subj: "Math", q: "Do they get that a half is bigger than a quarter?" },
];

const OPTS: ReadonlyArray<readonly [string, number]> = [
  ["Easily", 2],
  ["Getting there", 1],
  ["Not yet", 0],
];

const MONO_LABEL: CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "0.68rem",
  letterSpacing: "0.14em",
  color: "var(--text-subtle)",
};

function legendDot(style: CSSProperties) {
  return <span style={{ width: 11, height: 11, borderRadius: "50%", flexShrink: 0, ...style }} />;
}

export function BenchmarkDemo() {
  const [ans, setAns] = useState<Answers>({ read: null, count: null, frac: null });
  const [open, setOpen] = useState(false);
  const [revealed, setRevealed] = useState(1);

  const readingStart = ans.read == null ? null : [1, 2, 3][ans.read];
  const fromCount = ans.count == null ? null : [0, 1, 2][ans.count];
  const fromFrac = ans.frac == null ? null : [0, 4, 5][ans.frac];
  const mathStart = fromCount == null && fromFrac == null ? null : Math.max(fromCount || 0, fromFrac || 0);

  const startNames = [
    readingStart != null ? READING_NODES[readingStart].toLowerCase() : null,
    mathStart != null ? MATH_NODES[mathStart].toLowerCase() : null,
  ].filter(Boolean);
  const summary = startNames.length
    ? `Homa would start with ${startNames.join(" and ")}, just past what\u2019s already solid.`
    : "Tap an answer on the left to see where Homa would begin.";

  return (
    <section id="try" className="lp-pad" style={{ padding: "120px 40px 120px", maxWidth: 1140, margin: "0 auto" }}>
      <div data-reveal="" style={{ textAlign: "center", maxWidth: 620, margin: "0 auto 72px" }}>
        <Eyebrow>Try it</Eyebrow>
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(2rem, 5vw, 2.6rem)",
            fontWeight: 700,
            color: "var(--text-strong)",
            margin: "10px 0 12px",
          }}
        >
          Where would Homa start?
        </h2>
        <p style={{ color: "var(--text-muted)", fontSize: "1.08rem", lineHeight: 1.6, margin: 0 }}>
          Three quick questions about how school is going. You answer, your kids never do, and the map redraws with
          every tap.
        </p>
      </div>

      <div data-reveal="" className="lp-2col" style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: 44, alignItems: "start" }}>
        <div>
          <div style={{ ...MONO_LABEL, marginBottom: 18 }}>YOU ANSWER</div>
          {QUESTIONS.slice(0, revealed).map(({ id, subj, q }, qi) => (
            <div key={id} className="bd-sum" style={{ marginBottom: 26 }}>
              <div style={{ ...MONO_LABEL, letterSpacing: "0.1em", color: "var(--clay-600)", marginBottom: 6 }}>
                {qi + 1} · {subj.toUpperCase()}
              </div>
              <div style={{ fontWeight: 600, color: "var(--text-body)", marginBottom: 10, fontSize: "0.98rem" }}>{q}</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {OPTS.map(([label, v]) => (
                  <Chip
                    key={label}
                    selected={ans[id] === v}
                    onClick={() => {
                      setAns((a) => ({ ...a, [id]: a[id] === v ? null : v }));
                      setRevealed((r) => Math.max(r, Math.min(3, qi + 2)));
                    }}
                  >
                    {label}
                  </Chip>
                ))}
              </div>
            </div>
          ))}
          {revealed < 3 && (
            <div style={{ fontSize: "0.82rem", color: "var(--text-subtle)" }}>just {revealed === 1 ? "two" : "one"} more after this</div>
          )}
        </div>
        <div style={{ background: "var(--surface-card)", borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-md)", padding: "18px 20px 16px" }}>
          <div style={{ ...MONO_LABEL, padding: "4px 0 10px 4px" }}>HOMA FINDS THE STARTING LINE</div>
          <DemoMap
            readingNodes={READING_NODES}
            mathNodes={MATH_NODES}
            readingStart={readingStart}
            mathStart={mathStart}
            mathOn={revealed >= 2}
          />
          <div style={{ display: "flex", gap: 18, alignItems: "center", marginTop: 20, fontSize: "0.8rem", color: "var(--text-muted)", flexWrap: "wrap" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              {legendDot({ background: "var(--sage-500)" })} already solid
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              {legendDot({ background: "var(--clay-50)", border: "2.5px solid var(--clay-500)" })} Homa starts here
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              {legendDot({ background: "var(--surface-card)", border: "1.5px solid var(--border-default)" })} coming later
            </span>
          </div>
          <div
            key={summary}
            className="bd-sum"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginTop: 16,
              background: startNames.length ? "var(--brand-soft)" : "var(--stone-100)",
              borderRadius: "var(--radius-md)",
              padding: "12px 16px",
              fontWeight: 600,
              color: startNames.length ? "var(--clay-700)" : "var(--text-muted)",
              fontSize: "0.95rem",
              transition: "background var(--dur-base) var(--ease-out)",
            }}
          >
            <Doodle name="sparkle" size={16} color={startNames.length ? "var(--brand)" : "var(--stone-400)"} /> {summary}
          </div>
        </div>
      </div>

      <div data-reveal="" style={{ background: "var(--surface-card)", borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-md)", padding: "22px 28px", maxWidth: 860, margin: "104px auto 0" }}>
        <div
          role="button"
          tabIndex={0}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setOpen((o) => !o);
            }
          }}
          style={{ display: "flex", alignItems: "center", gap: 20, cursor: "pointer", outline: "none" }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: "1.35rem", fontWeight: 600, color: "var(--text-strong)" }}>
              Curious how Homa works?
            </div>
            <div style={{ color: "var(--text-muted)", fontSize: "0.92rem", marginTop: 3 }}>
              Homa asks, plans, and improves. A one-minute peek, no homework required.
            </div>
          </div>
          <span
            style={{
              width: 44,
              height: 44,
              borderRadius: "50%",
              background: "var(--brand)",
              color: "#fff",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              transform: open ? "rotate(180deg)" : "none",
              transition: "transform var(--dur-base) var(--ease-out)",
            }}
          >
            <ChevronDown size={20} color="#fff" aria-hidden="true" />
          </span>
        </div>
        <div className="lp-peek" data-open={open ? "true" : "false"}>
          <div>
            <div style={{ borderTop: "1px solid var(--border-subtle)", marginTop: 18, paddingTop: 22 }}>
              <div style={{ maxWidth: 700 }}>
                <div style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", fontWeight: 600, color: "var(--text-strong)", marginBottom: 10 }}>
                  Every skill, connected.
                </div>
                <p style={{ color: "var(--text-muted)", lineHeight: 1.62, fontSize: "0.98rem", margin: 0 }}>
                  Homa holds each child’s curriculum as one connected map: hundreds of skills, linked by what they
                  build on and mapped to your state’s standards. After each week, practice aims at the growing
                  edge, the next skill whose foundations are already solid. Learning scientists call it the zone of
                  proximal development. You’ll just see a week that fits.
                </p>
              </div>
              <div style={{ background: "var(--bg-page)", borderRadius: "var(--radius-lg)", padding: "14px 16px 8px", marginTop: 20 }}>
                <SkillWeb />
              </div>
              <div style={{ display: "flex", gap: 18, alignItems: "center", marginTop: 14, fontSize: "0.8rem", color: "var(--text-muted)", flexWrap: "wrap" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--surface-card)", border: "1.5px solid var(--border-default)" }} /> coming up
                </span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--sage-600)" }} /> secure
                </span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 11, height: 11, borderRadius: "50%", background: "#fff", border: "2.5px solid var(--clay-500)" }} /> Homa works next
                </span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--text-subtle)", marginLeft: "auto" }}>
                  Mapped to all 50 states · redrawn after every week
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
