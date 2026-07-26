import type { CSSProperties, ReactNode } from "react";

import { Avatar } from "../ds/Avatar";
import { Badge } from "../ds/Badge";
import { Doodle } from "../Doodle";

/**
 * The four product vignettes riding the story thread, ported from
 * docs/homa-design/ui_kits/landing/LandingPage.jsx and then reworked for the
 * scrapbook pass: every card is now a taped-in artifact (translucent washi
 * strip over the top edge, hairline print border) so the section literally
 * shows plans and records kept together in one binder. The proof card
 * diverged from the kit per founder screenshot 2026-07-07: its "12 pts" stat
 * was invented (the progress report has no points scale), so it mirrors what
 * the report really shows, the growing / on track / ahead positions and
 * "moved up" movement, in the report's own colors (blue is growing, green is
 * on track). Fixture continuity (2026-07-25): Maya is the Pre-K four-year-old
 * everywhere else on this page (hero, features, sample report), so the Grade
 * 3 child running the fractions arc here is Nora.
 */

function weekChip(label: string, bg: string, fg: string): ReactNode {
  return (
    <span
      key={label}
      style={{
        background: bg,
        color: fg,
        fontWeight: 600,
        fontSize: "0.85rem",
        padding: "5px 12px",
        borderRadius: "var(--radius-pill)",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

/**
 * Shared card chrome: white artifact card at a slight hand-placed angle with
 * a translucent washi-tape strip bridging its top edge onto the paper.
 * The tape is a tinted strip (design-token tints only) with torn clip-path
 * ends and a faint top highlight, so it reads as material, not a rectangle.
 */
function VignetteCard({
  rotate,
  tape,
  tapeRotate = -3,
  maxWidth,
  padding = "24px 26px",
  children,
}: {
  rotate: number;
  tape: string;
  tapeRotate?: number;
  maxWidth: number;
  padding?: string;
  children: ReactNode;
}) {
  const tapeStyle: CSSProperties = {
    position: "absolute",
    top: -11,
    left: "50%",
    width: 84,
    height: 24,
    transform: `translateX(-50%) rotate(${tapeRotate}deg)`,
    backgroundColor: tape,
    backgroundImage: "linear-gradient(rgba(255,255,255,0.25), rgba(255,255,255,0))",
    opacity: 0.72,
    clipPath: "polygon(2% 0, 98% 4%, 100% 30%, 97% 62%, 99% 100%, 3% 96%, 0 70%, 2% 32%)",
    pointerEvents: "none",
  };
  return (
    <div
      style={{
        position: "relative",
        background: "var(--surface-card)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--radius-xl)",
        boxShadow: "var(--shadow-md)",
        padding,
        maxWidth,
        width: "100%",
        boxSizing: "border-box",
        transform: `rotate(${rotate}deg)`,
      }}
    >
      <span aria-hidden="true" style={tapeStyle} />
      {children}
    </div>
  );
}

export function KidsVignette() {
  /* Setup context only, no completion marks: nothing is "done" before
     onboarding has happened. First names throughout, so avatar initials
     match the visible labels. */
  const kids: ReadonlyArray<readonly [string, string, string]> = [
    ["Nora Rivera", "Grade 3", "age 8"],
    ["Eli Rivera", "Grade 1", "age 6"],
    ["Maya Rivera", "Pre-K", "age 4"],
  ];
  const subjects: ReadonlyArray<readonly [string, string, string]> = [
    ["Math", "var(--clay-100)", "var(--clay-700)"],
    ["Reading", "var(--sage-100)", "var(--sage-700)"],
    ["Science", "var(--gold-100)", "var(--gold-ink)"],
    ["Art", "var(--sky-100)", "var(--sky-600)"],
  ];
  return (
    <VignetteCard rotate={-0.5} tape="var(--gold-300)" tapeRotate={-3} maxWidth={480}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 18 }}>
        {kids.map(([name, grade, age]) => (
          <div key={name} style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Avatar name={name.split(" ")[0]} size={36} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, color: "var(--text-body)", fontSize: "0.95rem" }}>{name.split(" ")[0]}</div>
              <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>{grade}</div>
            </div>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--text-muted)" }}>{age}</span>
          </div>
        ))}
      </div>
      <div
        style={{
          fontSize: "0.78rem",
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--text-muted)",
          marginBottom: 10,
        }}
      >
        This year
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{subjects.map(([s, bg, fg]) => weekChip(s, bg, fg))}</div>
    </VignetteCard>
  );
}

export function WeekVignette() {
  const days: ReadonlyArray<readonly [string, ReactNode[]]> = [
    ["Mon", [weekChip("Math · Fractions", "var(--clay-100)", "var(--clay-700)"), weekChip("Reading", "var(--sage-100)", "var(--sage-700)"), weekChip("Art", "var(--gold-100)", "var(--gold-ink)")]],
    ["Tue", [weekChip("Math", "var(--clay-100)", "var(--clay-700)"), weekChip("Science · Space", "var(--sky-100)", "var(--sky-600)"), weekChip("Reading", "var(--sage-100)", "var(--sage-700)")]],
    ["Wed", [weekChip("Field trip · Planetarium", "var(--sky-100)", "var(--sky-600)"), weekChip("Journal", "var(--gold-100)", "var(--gold-ink)")]],
    ["Thu", [weekChip("Math", "var(--clay-100)", "var(--clay-700)"), weekChip("Writing", "var(--sage-100)", "var(--sage-700)"), weekChip("Music", "var(--gold-100)", "var(--gold-ink)")]],
    ["Fri", [weekChip("Review game", "var(--clay-100)", "var(--clay-700)")]],
  ];
  return (
    <VignetteCard rotate={0.6} tape="var(--sky-300)" tapeRotate={2.5} maxWidth={560}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, rowGap: 4, flexWrap: "wrap", marginBottom: 16 }}>
        <span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "1.15rem", color: "var(--text-strong)" }}>
          Nora · Grade 3
        </span>
        <Badge tone="sage">Balanced</Badge>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {days.map(([d, chips]) => (
          <div
            key={d}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              paddingBottom: 12,
              borderBottom: d === "Fri" ? "none" : "1px solid var(--stone-100)",
            }}
          >
            <span style={{ width: 38, flexShrink: 0, fontWeight: 700, fontSize: "0.8rem", color: "var(--text-muted)" }}>{d}</span>
            <div style={{ display: "flex", gap: 6, rowGap: 8, flexWrap: "wrap", alignItems: "center" }}>
              {chips}
              {d === "Wed" && (
                <span
                  aria-hidden="true"
                  style={{
                    fontFamily: "var(--font-hand)",
                    fontWeight: 600,
                    color: "var(--sage-600)",
                    fontSize: "1.02rem",
                    lineHeight: 1,
                    whiteSpace: "nowrap",
                    transform: "rotate(-2deg)",
                  }}
                >
                  math moved to Thu ✎
                </span>
              )}
              {d === "Fri" && (
                <span
                  style={{
                    fontFamily: "var(--font-serif)",
                    fontStyle: "italic",
                    fontWeight: 400,
                    color: "var(--text-muted)",
                    fontSize: "0.92rem",
                  }}
                >
                  light on purpose
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </VignetteCard>
  );
}

export function CheckVignette() {
  const check = (
    <span
      style={{
        width: 26,
        height: 26,
        borderRadius: "50%",
        background: "var(--sage-500)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 12.5 L9.5 18 L20 6.5" />
      </svg>
    </span>
  );
  const empty = (
    <span
      style={{
        width: 26,
        height: 26,
        borderRadius: "50%",
        background: "var(--surface-card)",
        border: "1.5px solid var(--border-default)",
        flexShrink: 0,
      }}
    />
  );
  return (
    <VignetteCard rotate={-0.4} tape="var(--sage-200)" tapeRotate={-2} maxWidth={460} padding="22px 26px">
      {/* gap + wrap: at narrow widths the meta drops to its own right-aligned
          line under "Tuesday" instead of colliding with it. */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 16, rowGap: 2, flexWrap: "wrap", marginBottom: 16 }}>
        <span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "1.1rem", color: "var(--text-strong)" }}>Tuesday</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.78rem", color: "var(--text-muted)", marginLeft: "auto", textAlign: "right" }}>
          1 of 3 · about 1h 10m left
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, position: "relative" }}>
          {check}
          {/* Label and star travel together: no orphaned sticker when the
              row tightens at 320px. */}
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <span
              style={{
                color: "var(--text-muted)",
                textDecoration: "line-through",
                fontWeight: 500,
                whiteSpace: "nowrap",
                fontSize: "clamp(0.85rem, 4.5vw, 1rem)",
              }}
            >
              Math · word problems
            </span>
            <Doodle name="star" size={16} color="var(--gold-400)" rotate={12} />
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {empty}
          <span style={{ color: "var(--text-body)", fontWeight: 500 }}>Writing · story draft</span>
          <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginLeft: "auto" }}>40m</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {empty}
          <span style={{ color: "var(--text-body)", fontWeight: 500 }}>Read-aloud on the porch</span>
          <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginLeft: "auto" }}>30m</span>
        </div>
      </div>
    </VignetteCard>
  );
}

export function ProofVignette() {
  return (
    <VignetteCard rotate={0.5} tape="var(--band-blush)" tapeRotate={3} maxWidth={460}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, rowGap: 6, flexWrap: "wrap", marginBottom: 14 }}>
        <span
          style={{
            fontSize: "0.78rem",
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--text-muted)",
          }}
        >
          Nora · math report
        </span>
        <Badge tone="sage">On track</Badge>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(1.9rem, 8vw, 2.6rem)",
            fontWeight: 700,
            color: "var(--sage-600)",
            lineHeight: 1,
            whiteSpace: "nowrap",
            display: "inline-flex",
            alignItems: "center",
            gap: "0.22em",
          }}
        >
          {/* Drawn triangle, not the raw unicode glyph: sized and weighted
              to sit with Schibsted's display cut. */}
          <svg width="0.62em" height="0.62em" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 4 L21 19 H3 Z" fill="var(--sage-600)" stroke="var(--sage-600)" strokeWidth="3" strokeLinejoin="round" />
          </svg>
          Moved up
        </span>
      </div>
      <div style={{ color: "var(--text-muted)", fontSize: "0.92rem", marginTop: 6 }}>since the fractions practice set</div>
      {/* One chart, one datum: both bars sit flush on a shared baseline.
          border-default, not subtle: at DPR1 the subtle hairline vanished
          against the white card and the bars appeared to float. */}
      <div style={{ maxWidth: 340, marginTop: 18 }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 40, borderBottom: "1px solid var(--border-default)" }}>
          {(
            [
              ["Apr", 36, "var(--sky-300)"],
              ["May", 56, "var(--sage-500)"],
            ] as const
          ).map(([month, barHeight, barColor]) => (
            <div key={month} style={{ flex: "1 1 120px", maxWidth: 120, height: barHeight, background: barColor, borderRadius: "8px 8px 0 0" }} />
          ))}
        </div>
        <div style={{ display: "flex", gap: 40, marginTop: 6 }}>
          {(
            [
              ["Apr", "growing"],
              ["May", "on track"],
            ] as const
          ).map(([month, position]) => (
            <span
              key={month}
              style={{ flex: "1 1 120px", maxWidth: 120, textAlign: "center", fontFamily: "var(--font-mono)", fontSize: "0.72rem", color: "var(--text-muted)" }}
            >
              {month} · {position}
            </span>
          ))}
        </div>
      </div>
      {/* Right-aligned so the closing note counterweights the badge column
          and the card's lower-right corner never sits empty. */}
      <div style={{ fontFamily: "var(--font-hand)", fontWeight: 600, fontSize: "1.45rem", color: "var(--sage-600)", marginTop: 16, lineHeight: 1, textAlign: "right" }}>
        you did that ✎
      </div>
    </VignetteCard>
  );
}
