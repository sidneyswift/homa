import type { ReactNode } from "react";
import { Check } from "lucide-react";

import { Avatar } from "../ds/Avatar";
import { Badge } from "../ds/Badge";
import { Doodle } from "../Doodle";

/**
 * The four product vignettes riding the story thread, ported verbatim from
 * docs/homa-design/ui_kits/landing/LandingPage.jsx: the family setup card,
 * the week plan, the Tuesday check-off, and the benchmark proof card.
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

export function KidsVignette() {
  const kids: ReadonlyArray<readonly [string, string]> = [
    ["Maya Rivera", "Grade 3"],
    ["Eli Rivera", "Grade 1"],
    ["Nora Rivera", "Pre-K"],
  ];
  const subjects: ReadonlyArray<readonly [string, string, string]> = [
    ["Math", "var(--clay-100)", "var(--clay-700)"],
    ["Reading", "var(--sage-100)", "var(--sage-700)"],
    ["Science", "var(--gold-100)", "var(--gold-ink)"],
    ["Art", "var(--sky-100)", "var(--sky-600)"],
  ];
  return (
    <div
      style={{
        background: "var(--surface-card)",
        borderRadius: "var(--radius-xl)",
        boxShadow: "var(--shadow-md)",
        padding: "24px 26px",
        maxWidth: 480,
        transform: "rotate(-0.5deg)",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 18 }}>
        {kids.map(([name, grade]) => (
          <div key={name} style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Avatar name={name} size={36} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, color: "var(--text-body)", fontSize: "0.95rem" }}>{name.split(" ")[0]}</div>
              <div style={{ fontSize: "0.78rem", color: "var(--text-subtle)" }}>{grade}</div>
            </div>
            <Check size={17} color="var(--sage-600)" aria-hidden="true" />
          </div>
        ))}
      </div>
      <div
        style={{
          fontSize: "0.78rem",
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--text-subtle)",
          marginBottom: 10,
        }}
      >
        This year
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{subjects.map(([s, bg, fg]) => weekChip(s, bg, fg))}</div>
    </div>
  );
}

export function WeekVignette() {
  const days: ReadonlyArray<readonly [string, ReactNode[]]> = [
    ["Mon", [weekChip("Math \u00b7 Fractions", "var(--clay-100)", "var(--clay-700)"), weekChip("Reading", "var(--sage-100)", "var(--sage-700)"), weekChip("Art", "var(--gold-100)", "var(--gold-ink)")]],
    ["Tue", [weekChip("Math", "var(--clay-100)", "var(--clay-700)"), weekChip("Science \u00b7 Space", "var(--sky-100)", "var(--sky-600)"), weekChip("Reading", "var(--sage-100)", "var(--sage-700)")]],
    ["Wed", [weekChip("Field trip \u00b7 Planetarium", "var(--sky-100)", "var(--sky-600)"), weekChip("Journal", "var(--gold-100)", "var(--gold-ink)")]],
    ["Thu", [weekChip("Math", "var(--clay-100)", "var(--clay-700)"), weekChip("Writing", "var(--sage-100)", "var(--sage-700)"), weekChip("Music", "var(--gold-100)", "var(--gold-ink)")]],
    ["Fri", [weekChip("Review game", "var(--clay-100)", "var(--clay-700)")]],
  ];
  return (
    <div
      style={{
        background: "var(--surface-card)",
        borderRadius: "var(--radius-xl)",
        boxShadow: "var(--shadow-md)",
        padding: "24px 26px",
        maxWidth: 560,
        transform: "rotate(0.6deg)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "1.15rem", color: "var(--text-strong)" }}>
          Maya · Grade 3
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
            <span style={{ width: 38, flexShrink: 0, fontWeight: 700, fontSize: "0.8rem", color: "var(--text-subtle)" }}>{d}</span>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              {chips}
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
    </div>
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
    <div
      style={{
        background: "var(--surface-card)",
        borderRadius: "var(--radius-xl)",
        boxShadow: "var(--shadow-md)",
        padding: "22px 26px",
        maxWidth: 460,
        transform: "rotate(-0.4deg)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
        <span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "1.1rem", color: "var(--text-strong)" }}>Tuesday</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.78rem", color: "var(--text-subtle)" }}>1 of 3 · about 1h 10m left</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, position: "relative" }}>
          {check}
          <span style={{ color: "var(--text-subtle)", textDecoration: "line-through", fontWeight: 500 }}>Math · word problems</span>
          <Doodle name="star" size={16} color="var(--gold-400)" rotate={12} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {empty}
          <span style={{ color: "var(--text-body)", fontWeight: 500 }}>Writing · story draft</span>
          <span style={{ fontSize: "0.78rem", color: "var(--text-subtle)", marginLeft: "auto" }}>40m</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {empty}
          <span style={{ color: "var(--text-body)", fontWeight: 500 }}>Read-aloud on the porch</span>
          <span style={{ fontSize: "0.78rem", color: "var(--text-subtle)", marginLeft: "auto" }}>30m</span>
        </div>
      </div>
    </div>
  );
}

export function ProofVignette() {
  return (
    <div
      style={{
        background: "var(--surface-card)",
        borderRadius: "var(--radius-xl)",
        boxShadow: "var(--shadow-md)",
        padding: "24px 26px",
        maxWidth: 460,
        transform: "rotate(0.5deg)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <span
          style={{
            fontSize: "0.78rem",
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--text-subtle)",
          }}
        >
          Math · benchmark
        </span>
        <Badge tone="sage">On track</Badge>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <span style={{ fontFamily: "var(--font-display)", fontSize: "2.6rem", fontWeight: 700, color: "var(--sage-600)", lineHeight: 1 }}>
          ▲ 12 pts
        </span>
      </div>
      <div style={{ color: "var(--text-muted)", fontSize: "0.92rem", marginTop: 6 }}>since the fractions practice set</div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 14, marginTop: 18, height: 74 }}>
        {(
          [
            ["Apr", 56, "var(--clay-300)"],
            ["May", 68, "var(--sage-500)"],
          ] as const
        ).map(([m, v, c]) => (
          <div key={m} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flex: 1 }}>
            <div style={{ width: "100%", maxWidth: 90, height: v * 0.8, background: c, borderRadius: "8px 8px 3px 3px" }} />
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem", color: "var(--text-subtle)" }}>
              {m} · {v}
            </span>
          </div>
        ))}
      </div>
      <div style={{ fontFamily: "var(--font-hand)", fontWeight: 600, fontSize: "1.45rem", color: "var(--sage-600)", marginTop: 16, lineHeight: 1 }}>
        you did that ✎
      </div>
    </div>
  );
}
