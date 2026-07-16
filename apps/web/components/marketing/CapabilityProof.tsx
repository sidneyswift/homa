import { Check, Clock3, FileText, FolderOpen, Printer, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import type { CapabilityId } from "./landing-content";

function ProofShell({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div
      style={{
        minHeight: 214,
        padding: 15,
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--radius-lg)",
        background: "var(--surface-raised)",
      }}
    >
      <div
        style={{
          marginBottom: 12,
          color: "var(--text-subtle)",
          fontSize: "0.66rem",
          fontWeight: 700,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
        }}
      >
        Example · {label}
      </div>
      {children}
    </div>
  );
}

function ProofHeader({ icon: Icon, title, note }: { icon: LucideIcon; title: string; note: string }) {
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
          background: "var(--sky-100)",
        }}
      >
        <Icon size={18} color="var(--sky-600)" aria-hidden="true" />
      </span>
      <div>
        <p style={{ margin: 0, color: "var(--text-strong)", fontSize: "0.86rem", fontWeight: 700 }}>{title}</p>
        <p style={{ margin: "2px 0 0", color: "var(--text-subtle)", fontSize: "0.7rem" }}>{note}</p>
      </div>
    </div>
  );
}

export function CapabilityProof({ capabilityId }: { capabilityId: CapabilityId }) {
  switch (capabilityId) {
    case "practice":
      return (
        <ProofShell label="practice page">
          <ProofHeader icon={FileText} title="Butterfly letter B" note="Made for Maya · PDF" />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "0.8fr 1.2fr",
              gap: 10,
              marginTop: 13,
              padding: 12,
              borderRadius: "var(--radius-md)",
              background: "var(--gold-100)",
              color: "var(--gold-ink-strong)",
            }}
          >
            <strong style={{ display: "grid", placeItems: "center", fontFamily: "var(--font-display)", fontSize: "2rem" }}>B b</strong>
            <span style={{ display: "grid", alignContent: "center", fontFamily: "var(--font-hand)", fontWeight: 600 }}>
              B B B B
              <br />
              b b b b
              <br />
              butterfly
            </span>
          </div>
          <p style={{ display: "flex", alignItems: "center", gap: 6, margin: "10px 0 0", color: "var(--sage-700)", fontSize: "0.72rem", fontWeight: 700 }}>
            <Printer size={14} aria-hidden="true" /> Ready to print
          </p>
        </ProofShell>
      );

    case "plan":
      return (
        <ProofShell label="weekly plan">
          <ProofHeader icon={Check} title="Maya · age 4" note="Tuesday · about 1h 10m" />
          <div style={{ display: "grid", gap: 7, marginTop: 13 }}>
            {[
              ["Letter B practice", "Done"],
              ["Butterfly book", "20m"],
              ["Science walk", "30m"],
            ].map(([title, meta], index) => (
              <div key={title} style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 10px", borderRadius: 10, background: index === 0 ? "var(--sage-50)" : "var(--surface-card)" }}>
                <span style={{ width: 15, height: 15, border: `1.5px solid ${index === 0 ? "var(--sage-500)" : "var(--stone-300)"}`, borderRadius: "50%", background: index === 0 ? "var(--sage-500)" : "transparent" }} />
                <span style={{ flex: 1, color: "var(--text-body)", fontSize: "0.76rem", textDecoration: index === 0 ? "line-through" : "none" }}>{title}</span>
                <span style={{ color: "var(--text-subtle)", fontSize: "0.68rem" }}>{meta}</span>
              </div>
            ))}
          </div>
        </ProofShell>
      );

    case "binder":
      return (
        <ProofShell label="binder">
          <ProofHeader icon={FolderOpen} title="What you kept this week" note="2 items" />
          <div style={{ display: "grid", gap: 9, marginTop: 13 }}>
            {[
              ["Butterfly letter B", "Practice page · Tuesday"],
              ["Our science walk", "Photo and note · Thursday"],
            ].map(([title, meta], index) => (
              <div key={title} style={{ display: "grid", gridTemplateColumns: "46px 1fr", gap: 10, alignItems: "center", padding: 9, border: "1px solid var(--border-subtle)", borderRadius: 12, background: "var(--surface-card)" }}>
                <div style={{ display: "grid", placeItems: "center", height: 48, borderRadius: 9, background: index === 0 ? "var(--gold-100)" : "var(--sage-50)", color: index === 0 ? "var(--gold-ink-strong)" : "var(--sage-700)", fontFamily: "var(--font-display)", fontWeight: 700 }}>
                  {index === 0 ? "B b" : "Leaf"}
                </div>
                <div>
                  <p style={{ margin: 0, color: "var(--text-strong)", fontSize: "0.77rem", fontWeight: 700 }}>{title}</p>
                  <p style={{ margin: "2px 0 0", color: "var(--text-subtle)", fontSize: "0.68rem" }}>{meta}</p>
                </div>
              </div>
            ))}
          </div>
        </ProofShell>
      );

    case "records":
      return (
        <ProofShell label="records">
          <ProofHeader icon={Clock3} title="This week" note="Hours recorded by subject" />
          <div style={{ display: "grid", gap: 9, marginTop: 13 }}>
            {[
              ["Early math", "1h 10m", "48%"],
              ["Language", "1h 45m", "58%"],
              ["Science", "55m", "36%"],
            ].map(([subject, time, width]) => (
              <div key={subject}>
                <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-body)", fontSize: "0.72rem" }}>
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
            Your state rules · sources shown · last-checked date included
          </p>
        </ProofShell>
      );

    default: {
      const exhaustive: never = capabilityId;
      return exhaustive;
    }
  }
}
