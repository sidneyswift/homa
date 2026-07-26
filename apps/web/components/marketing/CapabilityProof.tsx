import { Check, Clock3, FileText, FolderOpen, Leaf, Printer, type LucideIcon } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";

import type { CapabilityId } from "./landing-content";

/**
 * Fixture-safe UI proof for each capability card. One artifact, the
 * butterfly math worksheet from the hero thread, travels through the
 * plan, the practice page, and the binder so the four cards read as one
 * product instead of four features. Shells are sunken with raised
 * borderless rows so the mockups do not stack three levels of outline
 * inside the bento card's own border. Each proof carries one physical
 * cue from the print world (ruled paper, washi tape, a folder tab,
 * stamp pills) so the four panels differ by texture, not color.
 */

function ProofShell({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      style={{
        minHeight: 214,
        padding: 15,
        borderRadius: "var(--radius-lg)",
        background: "var(--surface-sunken)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function ProofHeader({
  icon: Icon,
  title,
  note,
  noteStyle,
  chipBg,
  chipInk,
}: {
  icon: LucideIcon;
  title: string;
  note: string;
  noteStyle?: CSSProperties;
  chipBg: string;
  chipInk: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span
        style={{
          display: "inline-flex",
          width: 36,
          height: 36,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 10,
          background: chipBg,
          flexShrink: 0,
        }}
      >
        <Icon size={18} color={chipInk} aria-hidden="true" />
      </span>
      <div>
        <p style={{ margin: 0, color: "var(--text-strong)", fontSize: "0.86rem", fontWeight: 700 }}>{title}</p>
        <p style={{ margin: "2px 0 0", color: "var(--text-subtle)", fontSize: "var(--text-xs)", ...noteStyle }}>{note}</p>
      </div>
    </div>
  );
}

/** Rubber-stamp pill: bordered, uppercase, set slightly off-square. */
function Stamp({ children, ink, rotate = 0 }: { children: ReactNode; ink: string; rotate?: number }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "3px 8px",
        border: `1.5px solid ${ink}`,
        borderRadius: 6,
        color: ink,
        fontSize: "var(--text-2xs)",
        fontWeight: 800,
        letterSpacing: "0.07em",
        textTransform: "uppercase",
        lineHeight: 1.25,
        whiteSpace: "nowrap",
        transform: `rotate(${rotate}deg)`,
      }}
    >
      {children}
    </span>
  );
}

export function CapabilityProof({ capabilityId }: { capabilityId: CapabilityId }) {
  switch (capabilityId) {
    case "plan":
      return (
        <ProofShell>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
            {/* The duration keeps its NBSP, and the whole note shrinks
                instead of wrapping: at 390px a two-line note made the
                header tall and pushed the check chip off optical center
                against the THIS WEEK stamp. */}
            <ProofHeader
              icon={Check}
              title="Maya · age 4"
              note={"Tuesday · about 1h 25m"}
              noteStyle={{ whiteSpace: "nowrap", fontSize: "clamp(0.62rem, 2.6vw, var(--text-xs))" }}
              chipBg="var(--sage-50)"
              chipInk="var(--sage-700)"
            />
            <Stamp ink="var(--sage-600)" rotate={2}>
              This week
            </Stamp>
          </div>
          <div style={{ display: "grid", gap: 7, marginTop: 13 }}>
            {[
              ["Butterfly math", "Done"],
              ["Butterfly book", "20m"],
              ["Science walk", "30m"],
              ["Letter tracing", "15m"],
            ].map(([title, meta], index) => (
              <div
                key={title}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 9,
                  padding: "8px 10px",
                  borderRadius: 10,
                  background: index === 0 ? "var(--sage-50)" : "var(--surface-raised)",
                  boxShadow: index === 0 ? "none" : "var(--shadow-sm)",
                }}
              >
                <span
                  style={{
                    display: "inline-flex",
                    width: 15,
                    height: 15,
                    alignItems: "center",
                    justifyContent: "center",
                    border: `1.5px solid ${index === 0 ? "var(--sage-500)" : "var(--stone-300)"}`,
                    borderRadius: "50%",
                    background: index === 0 ? "var(--sage-500)" : "transparent",
                    flexShrink: 0,
                  }}
                >
                  {index === 0 ? <Check size={9} color="#fff" strokeWidth={3.4} aria-hidden="true" /> : null}
                </span>
                <span style={{ flex: 1, color: "var(--text-body)", fontSize: "0.78rem" }}>{title}</span>
                <span
                  style={{
                    color: index === 0 ? "var(--sage-700)" : "var(--text-muted)",
                    fontSize: "var(--text-2xs)",
                    fontWeight: index === 0 ? 700 : 500,
                  }}
                >
                  {meta}
                </span>
              </div>
            ))}
          </div>
        </ProofShell>
      );

    case "practice":
      return (
        <ProofShell style={{ backgroundImage: "var(--bg-paper)" }}>
          {/* The whole page as a portrait thumbnail beside the file info,
              like a real document preview pinned to a ruled notebook page.
              The pair centers in the shell so a wide single-column card does
              not leave a dead field to the right, and the status lines align
              with the title text. */}
          <div
            className="lp-practice-proof"
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(112px, 140px) minmax(0, 240px)",
              gap: 22,
              alignItems: "center",
              justifyContent: "center",
              minHeight: 214,
            }}
          >
            <div style={{ position: "relative", transform: "rotate(-2.4deg)" }}>
              <div
                style={{
                  overflow: "hidden",
                  borderRadius: "var(--radius-md)",
                  background: "#fff",
                  boxShadow: "var(--shadow-md)",
                }}
              >
                <img
                  src="/images/hero-butterfly-math.png"
                  alt=""
                  width={1024}
                  height={1536}
                  style={{ display: "block", width: "100%", height: "auto" }}
                />
              </div>
              {/* Washi tape holding the page down: pinned to the blank
                  top-left margin, hanging off the corner like real tape, so
                  no glyph of the printed title sits under it. Translucent
                  with clipped, slightly skewed ends so it reads as tape,
                  not a highlighter swatch. */}
              <div
                aria-hidden="true"
                style={{
                  position: "absolute",
                  top: -11,
                  left: "10%",
                  width: 54,
                  height: 19,
                  background: "var(--band-sunshine)",
                  opacity: 0.7,
                  clipPath: "polygon(2% 0, 100% 6%, 98% 100%, 0 92%)",
                  transform: "translateX(-50%) rotate(-5deg)",
                }}
              />
            </div>
            <div style={{ display: "grid", gap: 11 }}>
              {/* The thumbnail's printed headline already names the artifact,
                  so the file card carries the child and the day instead of
                  repeating the title beside itself. */}
              <ProofHeader
                icon={FileText}
                title="Made for Maya"
                note="Tuesday's practice page"
                chipBg="var(--gold-100)"
                chipInk="var(--gold-ink)"
              />
              {/* 46 = chip width 36 + header gap 10, so these lines share
                  the title's left edge instead of a ragged rag. */}
              <p
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  margin: 0,
                  paddingLeft: 46,
                  color: "var(--sage-700)",
                  fontSize: "var(--text-xs)",
                  fontWeight: 700,
                }}
              >
                <Printer size={14} aria-hidden="true" /> Ready to print
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, paddingLeft: 46 }}>
                <Stamp ink="var(--clay-600)" rotate={-2}>
                  PDF
                </Stamp>
                <Stamp ink="var(--sage-600)" rotate={1.5}>
                  Saved to the binder
                </Stamp>
              </div>
            </div>
          </div>
        </ProofShell>
      );

    case "binder":
      return (
        <div style={{ position: "relative", paddingTop: 14 }}>
          {/* Folder tab peeking above the panel: the binder is the one proof
              that IS a container, so it gets the manila-folder cue. The shell
              is positioned after it, so the tab's lower half tucks behind.
              Same surface as the shell so tab and folder read as one piece
              of manila; the trapezoid silhouette says tab even without
              color contrast. */}
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              top: 0,
              left: 24,
              width: 84,
              height: 26,
              background: "var(--surface-sunken)",
              border: "1px solid var(--border-subtle)",
              borderBottom: "none",
              clipPath: "polygon(6% 100%, 12% 0, 88% 0, 94% 100%)",
            }}
          />
          <ProofShell style={{ position: "relative" }}>
            <ProofHeader
              icon={FolderOpen}
              title="What you kept this week"
              note="2 items"
              chipBg="var(--clay-100)"
              chipInk="var(--clay-600)"
            />
            <div style={{ display: "grid", gap: 9, marginTop: 13 }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "46px 1fr",
                  gap: 10,
                  alignItems: "center",
                  padding: 9,
                  borderRadius: 12,
                  background: "var(--surface-raised)",
                  boxShadow: "var(--shadow-sm)",
                }}
              >
                <div style={{ height: 48, overflow: "hidden", borderRadius: 9, background: "#fff" }}>
                  <img
                    src="/images/hero-butterfly-math.png"
                    alt=""
                    width={1024}
                    height={1536}
                    style={{ display: "block", width: "100%", height: "100%", objectFit: "cover", objectPosition: "top center" }}
                  />
                </div>
                <div>
                  <p style={{ margin: 0, color: "var(--text-strong)", fontSize: "0.78rem", fontWeight: 700 }}>Butterfly math</p>
                  <p style={{ margin: "2px 0 0", color: "var(--text-subtle)", fontSize: "var(--text-xs)" }}>Practice page · Tuesday</p>
                </div>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "46px 1fr",
                  gap: 10,
                  alignItems: "center",
                  padding: 9,
                  borderRadius: 12,
                  background: "var(--surface-raised)",
                  boxShadow: "var(--shadow-sm)",
                }}
              >
                <div
                  style={{
                    display: "grid",
                    placeItems: "center",
                    height: 48,
                    borderRadius: 9,
                    background: "var(--sage-50)",
                    color: "var(--sage-700)",
                  }}
                >
                  <Leaf size={20} aria-hidden="true" />
                </div>
                <div>
                  <p style={{ margin: 0, color: "var(--text-strong)", fontSize: "0.78rem", fontWeight: 700 }}>Our science walk</p>
                  <p style={{ margin: "2px 0 0", color: "var(--text-subtle)", fontSize: "var(--text-xs)" }}>Photo and note · Thursday</p>
                </div>
              </div>
            </div>
          </ProofShell>
        </div>
      );

    case "records":
      return (
        <ProofShell style={{ backgroundImage: "var(--bg-paper)" }}>
          <ProofHeader
            icon={Clock3}
            title="This week"
            note="Hours recorded by subject"
            chipBg="var(--sky-100)"
            chipInk="var(--sky-600)"
          />
          {/* Bar widths are proportional to the labeled minutes with the
              105m maximum pinned at 92%, so the ledger reads well-kept
              while surviving a data-literate read: 70m=61, 105m=92,
              55m=48. */}
          <div style={{ display: "grid", gap: 9, marginTop: 13 }}>
            {[
              ["Early math", "1h 10m", "61%"],
              ["Language", "1h 45m", "92%"],
              ["Science", "55m", "48%"],
            ].map(([subject, time, width]) => (
              <div key={subject}>
                <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-body)", fontSize: "0.78rem" }}>
                  <span>{subject}</span>
                  <strong>{time}</strong>
                </div>
                {/* stone-200, not stone-100: the shell IS stone-100, so the
                    lighter track vanished and bars floated unanchored. */}
                <div style={{ height: 5, marginTop: 4, overflow: "hidden", borderRadius: "var(--radius-pill)", background: "var(--stone-200)" }}>
                  <div style={{ width, height: "100%", borderRadius: "inherit", background: "var(--sky-500)" }} />
                </div>
              </div>
            ))}
          </div>
          {/* The ruled-paper shell now carries the ledger structure, so the
              footnote needs no hairline of its own. */}
          <p
            style={{
              margin: "14px 0 0",
              color: "var(--text-muted)",
              fontSize: "var(--text-xs)",
            }}
          >
            State rules are listed with their sources and a last-checked date.
          </p>
        </ProofShell>
      );

    default: {
      const exhaustive: never = capabilityId;
      return exhaustive;
    }
  }
}
