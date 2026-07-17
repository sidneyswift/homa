import { Check, Clock3, FileText, FolderOpen, Leaf, Printer, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import type { CapabilityId } from "./landing-content";

/**
 * Fixture-safe UI proof for each capability card. One artifact, the
 * butterfly math worksheet from the hero thread, travels through the
 * plan, the practice page, and the binder so the four cards read as one
 * product instead of four features. Shells are sunken with raised
 * borderless rows so the mockups do not stack three levels of outline
 * inside the bento card's own border.
 */

function ProofShell({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        minHeight: 214,
        padding: 15,
        borderRadius: "var(--radius-lg)",
        background: "var(--surface-sunken)",
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
  chipBg,
  chipInk,
}: {
  icon: LucideIcon;
  title: string;
  note: string;
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
        <p style={{ margin: "2px 0 0", color: "var(--text-subtle)", fontSize: "0.68rem" }}>{note}</p>
      </div>
    </div>
  );
}

export function CapabilityProof({ capabilityId }: { capabilityId: CapabilityId }) {
  switch (capabilityId) {
    case "plan":
      return (
        <ProofShell>
          <ProofHeader
            icon={Check}
            title="Maya · age 4"
            note="Tuesday · about 1h 10m"
            chipBg="var(--sage-50)"
            chipInk="var(--sage-700)"
          />
          <div style={{ display: "grid", gap: 7, marginTop: 13 }}>
            {[
              ["Butterfly math", "Done"],
              ["Butterfly book", "20m"],
              ["Science walk", "30m"],
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
                <span style={{ color: "var(--text-subtle)", fontSize: "0.68rem" }}>{meta}</span>
              </div>
            ))}
          </div>
        </ProofShell>
      );

    case "practice":
      return (
        <ProofShell>
          {/* The whole page as a portrait thumbnail beside the file info,
              like a real document preview. The pair centers in the shell so
              a wide single-column card does not leave a dead field to the
              right, and the status lines align with the title text. */}
          <div
            className="lp-practice-proof"
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(112px, 156px) minmax(0, 240px)",
              gap: 20,
              alignItems: "center",
              justifyContent: "center",
              minHeight: 214,
            }}
          >
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
            <div style={{ display: "grid", gap: 11 }}>
              <ProofHeader
                icon={FileText}
                title="Butterfly math"
                note="Made for Maya · PDF"
                chipBg="var(--gold-100)"
                chipInk="var(--gold-ink-strong)"
              />
              {/* 46 = chip width 36 + header gap 10, so these lines share
                  the title's left edge instead of a ragged rag. */}
              <p style={{ display: "flex", alignItems: "center", gap: 6, margin: 0, paddingLeft: 46, color: "var(--sage-700)", fontSize: "0.72rem", fontWeight: 700 }}>
                <Printer size={14} aria-hidden="true" /> Ready to print
              </p>
              <p style={{ display: "flex", alignItems: "center", gap: 6, margin: 0, paddingLeft: 46, color: "var(--sage-700)", fontSize: "0.72rem", fontWeight: 700 }}>
                <Check size={14} aria-hidden="true" /> Saved to the binder
              </p>
            </div>
          </div>
        </ProofShell>
      );

    case "binder":
      return (
        <ProofShell>
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
                <p style={{ margin: "2px 0 0", color: "var(--text-subtle)", fontSize: "0.68rem" }}>Practice page · Tuesday</p>
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
                <p style={{ margin: "2px 0 0", color: "var(--text-subtle)", fontSize: "0.68rem" }}>Photo and note · Thursday</p>
              </div>
            </div>
          </div>
        </ProofShell>
      );

    case "records":
      return (
        <ProofShell>
          <ProofHeader
            icon={Clock3}
            title="This week"
            note="Hours recorded by subject"
            chipBg="var(--sky-100)"
            chipInk="var(--sky-600)"
          />
          <div style={{ display: "grid", gap: 9, marginTop: 13 }}>
            {[
              ["Early math", "1h 10m", "48%"],
              ["Language", "1h 45m", "58%"],
              ["Science", "55m", "36%"],
            ].map(([subject, time, width]) => (
              <div key={subject}>
                <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-body)", fontSize: "0.78rem" }}>
                  <span>{subject}</span>
                  <strong>{time}</strong>
                </div>
                <div style={{ height: 5, marginTop: 4, overflow: "hidden", borderRadius: "var(--radius-pill)", background: "var(--stone-100)" }}>
                  <div style={{ width, height: "100%", borderRadius: "inherit", background: "var(--sky-500)" }} />
                </div>
              </div>
            ))}
          </div>
          <p style={{ margin: "13px 0 0", paddingTop: 10, borderTop: "1px solid var(--border-subtle)", color: "var(--text-muted)", fontSize: "0.68rem" }}>
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
