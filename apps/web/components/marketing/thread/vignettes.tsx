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
 * The one hand-written margin note style for a calendar day cell: every
 * note shares this exact treatment (Caveat script, sage ink, gentle
 * rotate), sized to sit inside a narrow day column rather than a
 * full-width row.
 */
function dayNote(text: string): ReactNode {
  return (
    <span
      style={{
        fontFamily: "var(--font-hand)",
        fontWeight: 600,
        color: "var(--sage-600)",
        fontSize: "0.85rem",
        lineHeight: 1.1,
        transform: "rotate(-1.5deg)",
        display: "inline-block",
      }}
    >
      {text} ✎
    </span>
  );
}

/**
 * One event block in a calendar day column. Reworked from a solid-tint
 * pill (weekChip) into a pale-tint card with a colored left accent bar:
 * the reference's per-person solid color-coded block, translated so the
 * label text always reads in --text-body / --text-muted rather than a
 * per-family ink color. That sidesteps the sky family's missing text-safe
 * ink token (sky-600 on sky-100 measures 3.21:1, well under AA; gold has
 * --gold-ink for exactly this, sky does not) without hand-picking a new
 * hex: only the accent bar carries the subject color, never the text.
 */
function dayBlock(title: string, tint: string, accent: string, detail?: string): ReactNode {
  return (
    <div
      key={title}
      style={{
        background: tint,
        borderLeft: `3px solid ${accent}`,
        borderRadius: "var(--radius-xs)",
        padding: "4px 7px",
        display: "flex",
        flexDirection: "column",
        gap: 1,
      }}
    >
      <span style={{ fontWeight: 700, fontSize: "0.72rem", lineHeight: 1.2, color: "var(--text-body)" }}>{title}</span>
      {detail ? <span style={{ fontSize: "0.62rem", lineHeight: 1.2, color: "var(--text-muted)" }}>{detail}</span> : null}
    </div>
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
  /* Calendar reframe (founder request, 2026-07-26; structural idea only from
     a family-organizer app reference screenshot, no content or copy from
     it). An earlier pass kept Mon-Fri as stacked ROWS (a left day-rail plus
     a wrapped row of chips), which never actually became a grid: every row
     needed a hand-guessed minHeight to look level, and that guess broke the
     moment a real width wrapped a different number of chip-lines than
     assumed (measured live: Fri's single chip rendered 7.8px shorter than
     its neighbors at 375-414px, and Tuesday's three chips wrapped to 3
     lines at 320px, ballooning that row to 154.6px against 110-118px
     siblings).

     This pass is a true grid instead: one flex column per weekday, all
     five siblings in a single flex row so the browser's own cross-axis
     stretch makes every column match the tallest one exactly, by
     construction, for any content mix at any width. No minHeight guess,
     nothing to re-measure per breakpoint. Each subject is a block
     (dayBlock, stacked top to bottom) instead of a wrapped inline chip,
     which is also what makes the card read as day COLUMNS rather than a
     list: a day-of-week header per column, blocks underneath, dashed
     column and row rules. Tuesday still reads as "today" so this week
     lines up with the Tuesday lesson record in the next vignette down the
     thread.

     Five columns don't fit side by side at every supported width (measured
     content width runs as low as ~210px at a 320px viewport), so the day
     strip scrolls horizontally below its natural width instead of
     crushing text into unreadable columns (flex-shrink: 0 per column,
     overflow-x on the strip); wide viewports show all five with no
     scrolling. The outer card border IS still present here, same as the
     other three taped-artifact vignettes: VignetteCard's hairline border
     is unconditional, nothing in this file removes it. */
  const days: ReadonlyArray<{ short: string; blocks: ReactNode[]; note?: string; today?: boolean }> = [
    {
      short: "Mon",
      blocks: [
        dayBlock("Math", "var(--clay-100)", "var(--clay-500)", "fractions"),
        dayBlock("Reading", "var(--sage-100)", "var(--sage-500)"),
        dayBlock("Art", "var(--gold-100)", "var(--gold-500)"),
      ],
    },
    {
      short: "Tue",
      today: true,
      blocks: [
        dayBlock("Math", "var(--clay-100)", "var(--clay-500)"),
        dayBlock("Science", "var(--sky-100)", "var(--sky-500)", "space"),
        dayBlock("Reading", "var(--sage-100)", "var(--sage-500)"),
      ],
    },
    {
      short: "Wed",
      blocks: [
        dayBlock("Field trip", "var(--sky-100)", "var(--sky-500)", "planetarium"),
        dayBlock("Journal", "var(--gold-100)", "var(--gold-500)"),
      ],
      note: "math moved to Thu",
    },
    {
      short: "Thu",
      blocks: [
        dayBlock("Math", "var(--clay-100)", "var(--clay-500)"),
        dayBlock("Writing", "var(--sage-100)", "var(--sage-500)"),
        dayBlock("Music", "var(--gold-100)", "var(--gold-500)"),
      ],
    },
    {
      short: "Fri",
      blocks: [dayBlock("Review game", "var(--clay-100)", "var(--clay-500)")],
      note: "light on purpose",
    },
  ];
  return (
    <VignetteCard rotate={0.6} tape="var(--sky-300)" tapeRotate={2.5} maxWidth={560}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, rowGap: 4, flexWrap: "wrap", marginBottom: 16 }}>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            fontFamily: "var(--font-display)",
            fontWeight: 600,
            fontSize: "1.15rem",
            color: "var(--text-strong)",
          }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
            <rect x="3" y="5" width="18" height="16" rx="3" stroke="var(--clay-500)" strokeWidth="2" />
            <path d="M3 9.6 H21" stroke="var(--clay-500)" strokeWidth="2" />
            <path d="M8 3 V6" stroke="var(--clay-500)" strokeWidth="2" strokeLinecap="round" />
            <path d="M16 3 V6" stroke="var(--clay-500)" strokeWidth="2" strokeLinecap="round" />
          </svg>
          Nora · Grade 3
        </span>
        <Badge tone="sage">Balanced</Badge>
      </div>

      {/* Scoped, not a design-system class: hides the native scrollbar on
          the horizontally scrolling day strip (a plain overflow-x region
          still scrolls fine without it, this just keeps the card in its
          paper register instead of showing a UI scrollbar) and gives the
          strip a keyboard-reachable focus ring, since native overflow
          regions are otherwise mouse/touch only.

          The .ht-vig rule reaches into HowThread.tsx's wrapper class, the
          one thing in this file that touches another file's CSS. Measured
          live: without it, the day strip's flex-shrink: 0 columns (they
          have to stay non-shrinking, see above) make HowThread's shared
          single-column grid track (.ht-step, <=880px) compute its min
          size from their full unshrunk width, so ALL FOUR steps' cards
          (and their copy text) get forced wider than the viewport and
          clipped on the right at every phone width, not just this card.
          min-width: 0 only removes an automatic floor; it can't make
          .ht-vig (or the other three vignettes, which never hit that
          floor) render any smaller than their own content already
          allows, so this is additive-safe rather than a behavior change
          for the rest of the file. */}
      <style>{`
        .ht-vig { min-width: 0; }
        .wv-strip { scrollbar-width: none; -webkit-overflow-scrolling: touch; }
        .wv-strip::-webkit-scrollbar { display: none; }
        .wv-strip:focus { outline: none; }
        .wv-strip:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 2px; }
      `}</style>
      <div style={{ border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
        <div
          className="wv-strip"
          role="group"
          aria-label="Weekly plan, Monday through Friday"
          tabIndex={0}
          style={{ display: "flex", overflowX: "auto" }}
        >
          {days.map(({ short, blocks, note, today }, i) => (
            <div
              key={short}
              style={{
                flex: "1 0 74px",
                minWidth: 74,
                display: "flex",
                flexDirection: "column",
                borderRight: i === days.length - 1 ? "none" : "1px dashed var(--border-subtle)",
              }}
            >
              <div
                style={{
                  textAlign: "center",
                  padding: "8px 4px",
                  borderBottom: "1px dashed var(--border-subtle)",
                  background: today ? "var(--clay-50)" : "var(--stone-50)",
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontWeight: 700,
                    fontSize: "0.68rem",
                    letterSpacing: "0.03em",
                    textTransform: "uppercase",
                    color: today ? "var(--clay-700)" : "var(--text-muted)",
                  }}
                >
                  {short}
                </span>
              </div>
              {/* flex:1 plus a trailing flex:1 spacer (below) is what
                  sinks the note to the bottom of its column regardless of
                  block count, while the flex ROW above equalizes every
                  column's overall height regardless of note/no-note. */}
              <div style={{ flex: 1, padding: "8px 6px", display: "flex", flexDirection: "column", gap: 6 }}>
                {blocks}
                <div style={{ flex: 1 }} />
                {note ? dayNote(note) : null}
              </div>
            </div>
          ))}
        </div>
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

// Ordinal scale for the progress report, shared with the bar-and-arrow chart
// below: each fixed report position gets one height, so a taller bar always
// reads as "one position further along," never an invented amount of
// growth. Only growing/on track render on this card; starting/ahead are
// kept so the scale reads as a real, reusable system rather than two
// one-off numbers.
const REPORT_TIER_HEIGHT: Record<"starting" | "growing" | "on track" | "ahead", number> = {
  starting: 26,
  growing: 40,
  "on track": 54,
  ahead: 68,
};

const PROOF_CHART_VB_W = 240;
const PROOF_CHART_VB_H = 76;
const PROOF_CHART_BAR_W = 96;
const PROOF_CHART_BAR_R = 8;
const PROOF_CHART_GAP = PROOF_CHART_VB_W - PROOF_CHART_BAR_W * 2;

/** Rounded-top bar path in the chart's own viewBox units, bottom flush with
 *  the shared baseline so every bar sits on the same floor regardless of
 *  its tier height. */
function proofBarPath(x: number, height: number): string {
  const y = PROOF_CHART_VB_H - height;
  const r = PROOF_CHART_BAR_R;
  const w = PROOF_CHART_BAR_W;
  return `M${x} ${PROOF_CHART_VB_H} V${y + r} Q${x} ${y} ${x + r} ${y} H${x + w - r} Q${x + w} ${y} ${x + w} ${y + r} V${PROOF_CHART_VB_H} Z`;
}

// Reference ladder for the chart's left margin, top to bottom: the same four
// report positions REPORT_TIER_HEIGHT already models, rendered as axis labels
// instead of only backing two bar heights. Without this, two unlabeled bars
// read as an arbitrary quantity (bar charts default to implying "more" on a
// numeric scale); with it, they read as two dots on a fixed, named ladder,
// which is the honest picture since the report has no numeric score. Only
// growing/on track get a color dot, matching the report's own colors, since
// only those two are real positions for this child right now.
const PROOF_AXIS_TIERS: ReadonlyArray<{ key: keyof typeof REPORT_TIER_HEIGHT; label: string; dot?: string }> = [
  { key: "ahead", label: "Ahead" },
  { key: "on track", label: "On track", dot: "var(--sage-500)" },
  { key: "growing", label: "Growing", dot: "var(--sky-500)" },
  { key: "starting", label: "Starting" },
];

export function ProofVignette() {
  /* Legibility pass (founder request, 2026-07-26). Before this, the two
     bars sat under "Moved up" with only a lowercase mono word each, no
     arrow, no shared frame: the claim and the chart had to be pieced
     together. No score is invented here on purpose (the real report has no
     points scale), so the fix is structural instead of numeric: a bordered
     panel groups the bars and the position pills as one "from -> to" unit,
     and "growing" / "on track" render as colored pills (the report's own
     sky/sage positions) instead of small gray type, so they carry the same
     visual weight as the badge above them.

     Round-2 fix for two problems the first pass left: (1) the trend arrow
     was a fixed-position icon that floated near the shared baseline
     regardless of the bars' actual heights; (2) the bar heights fabricated
     a specific magnitude of improvement the report has no points scale to
     support. Both bars and the arrow now live in one inline SVG sharing
     one coordinate system: bar heights come from REPORT_TIER_HEIGHT above,
     and the arrow's start and end points are computed from those same two
     bar tops, so it provably connects them instead of floating nearby.

     Round-3 fix (2026-07-26 founder critique): round 2 fixed the arrow but
     left the two bars themselves unlabeled and axis-less, so a viewer
     still had to take "growing" and "on track" on faith rather than see
     where they sit. PROOF_AXIS_TIERS adds a labeled reference ladder
     (Starting / Growing / On track / Ahead) to the chart's left margin, so
     the two bars visibly sit on a fixed four-step scale instead of reading
     as an arbitrary bar chart with no unit. The sky "growing" pill's text
     also moves from --sky-600 to --text-body (measured 3.21:1 on sky-100,
     under the 4.5:1 AA floor at this pill's size; sky has no text-safe ink
     token the way gold has --gold-ink). Every column below the chart still
     keeps minWidth: 0 and skips white-space: nowrap on the pills, the same
     fix the original chart needed: fixed nowrap widths are what overflowed
     this card at phone widths before. */
  const aprHeight = REPORT_TIER_HEIGHT.growing;
  const mayHeight = REPORT_TIER_HEIGHT["on track"];
  const aprX = 0;
  const mayX = PROOF_CHART_BAR_W + PROOF_CHART_GAP;
  const aprTop = { x: aprX + PROOF_CHART_BAR_W / 2, y: PROOF_CHART_VB_H - aprHeight };
  const mayTop = { x: mayX + PROOF_CHART_BAR_W / 2, y: PROOF_CHART_VB_H - mayHeight };
  const dx = mayTop.x - aprTop.x;
  const dy = mayTop.y - aprTop.y;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  const ux = dx / dist;
  const uy = dy / dist;
  const arrowStart = { x: aprTop.x + ux * 6, y: aprTop.y + uy * 6 };
  const arrowEnd = { x: mayTop.x - ux * 9, y: mayTop.y - uy * 9 };

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
      <div style={{ color: "var(--text-muted)", fontSize: "0.92rem", marginTop: 6, marginBottom: 16 }}>since the fractions practice set</div>

      <div
        style={{
          background: "var(--stone-50)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-lg)",
          padding: "18px 18px 16px",
        }}
      >
        {/* Bars and arrow share one SVG coordinate system (see the module
            constants and geometry above): the arrow's path is computed from
            the two bars' own top edges, so it literally traces from the
            shorter bar to the taller one instead of sitting at a fixed
            offset. The reference-ladder column to its left shares that same
            PROOF_CHART_VB_H scale (position: absolute, top in raw px), so a
            label's height on the page always matches the bar/tier it names.
            The border-bottom is the shared baseline the original chart used
            (border-default, not subtle: it vanished against white at DPR1). */}
        <div style={{ display: "flex", alignItems: "stretch", gap: 8, borderBottom: "1px solid var(--border-default)" }}>
          <div style={{ position: "relative", width: 58, height: PROOF_CHART_VB_H, flexShrink: 0 }}>
            {PROOF_AXIS_TIERS.map(({ key, label, dot }) => (
              <div
                key={key}
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: PROOF_CHART_VB_H - REPORT_TIER_HEIGHT[key],
                  transform: "translateY(-50%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  gap: 4,
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "0.62rem",
                    fontWeight: dot ? 700 : 500,
                    color: dot ? "var(--text-body)" : "var(--text-muted)",
                    whiteSpace: "nowrap",
                    lineHeight: 1,
                  }}
                >
                  {label}
                </span>
                {dot ? <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: "50%", background: dot, flexShrink: 0 }} /> : null}
              </div>
            ))}
          </div>
          <svg
            viewBox={`0 0 ${PROOF_CHART_VB_W} ${PROOF_CHART_VB_H}`}
            width="100%"
            height={PROOF_CHART_VB_H}
            preserveAspectRatio="none"
            aria-hidden="true"
            style={{ display: "block", flex: 1, minWidth: 0 }}
          >
            <defs>
              <marker id="proofArrowHead" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="6.5" markerHeight="6.5" orient="auto">
                <path d="M0 0 L8 4 L0 8 Z" fill="var(--sage-600)" />
              </marker>
            </defs>
            <path d={proofBarPath(aprX, aprHeight)} fill="var(--sky-300)" />
            <path d={proofBarPath(mayX, mayHeight)} fill="var(--sage-500)" />
            <path
              d={`M${arrowStart.x.toFixed(1)} ${arrowStart.y.toFixed(1)} L${arrowEnd.x.toFixed(1)} ${arrowEnd.y.toFixed(1)}`}
              stroke="var(--sage-600)"
              strokeWidth="2.6"
              strokeLinecap="round"
              markerEnd="url(#proofArrowHead)"
            />
          </svg>
        </div>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 0, marginTop: 10, marginLeft: 66 }}>
          <div style={{ flex: "1 1 0", minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem", color: "var(--text-muted)" }}>Apr</span>
            <span
              style={{
                background: "var(--sky-100)",
                color: "var(--text-body)",
                fontWeight: 600,
                fontSize: "0.74rem",
                padding: "3px 10px",
                borderRadius: "var(--radius-pill)",
                textAlign: "center",
              }}
            >
              growing
            </span>
          </div>
          {/* Spacer's flex-grow (gap/barWidth) mirrors the bars' own
              width:gap:width ratio in the SVG above, so the pills stay
              centered under their bars at any card width. */}
          <div aria-hidden="true" style={{ flex: `${PROOF_CHART_GAP / PROOF_CHART_BAR_W} 1 0` }} />
          <div style={{ flex: "1 1 0", minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem", color: "var(--text-muted)" }}>May</span>
            <span
              style={{
                background: "var(--sage-100)",
                color: "var(--sage-700)",
                fontWeight: 600,
                fontSize: "0.74rem",
                padding: "3px 10px",
                borderRadius: "var(--radius-pill)",
                textAlign: "center",
              }}
            >
              on track
            </span>
          </div>
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
