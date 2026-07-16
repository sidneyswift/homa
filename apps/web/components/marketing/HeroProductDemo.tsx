import { Check, FileText, Printer } from "lucide-react";

import { Logo } from "../brand/Logo";

/**
 * Fixture-safe proof of the real parent-to-Homa workflow. It is HTML rather
 * than a static screenshot so the example stays legible, responsive, and
 * accessible as the page changes.
 */
export function HeroProductDemo() {
  return (
    <figure className="lp-product-demo" style={{ margin: 0 }}>
      <div
        className="lp-product-demo-phone"
        style={{
          position: "relative",
          maxWidth: 430,
          margin: "0 auto",
          padding: "12px",
          border: "1px solid var(--stone-300)",
          borderRadius: 38,
          background: "var(--stone-900)",
          boxShadow: "var(--shadow-xl)",
        }}
      >
        <div
          style={{
            overflow: "hidden",
            minHeight: 568,
            borderRadius: 28,
            background: "var(--surface-raised)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              minHeight: 68,
              padding: "12px 18px",
              borderBottom: "1px solid var(--border-subtle)",
              background: "rgba(251,247,240,0.94)",
            }}
          >
            <Logo size={24} />
            <span
              style={{
                borderRadius: "var(--radius-pill)",
                background: "var(--sage-50)",
                padding: "5px 9px",
                color: "var(--sage-700)",
                fontSize: "0.68rem",
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              Example conversation
            </span>
          </div>

          <div style={{ display: "grid", gap: 16, padding: "24px 18px 20px" }}>
            <div
              style={{
                maxWidth: "86%",
                marginLeft: "auto",
                padding: "13px 15px",
                borderRadius: "20px 20px 6px 20px",
                background: "var(--clay-100)",
                color: "var(--text-strong)",
                fontSize: "0.95rem",
                lineHeight: 1.45,
              }}
            >
              Maya is into butterflies right now. Can you make letter B practice for tomorrow?
            </div>

            <div
              style={{
                maxWidth: "90%",
                padding: "13px 15px",
                border: "1px solid var(--border-subtle)",
                borderRadius: "20px 20px 20px 6px",
                background: "var(--surface-card)",
                color: "var(--text-strong)",
                fontSize: "0.95rem",
                lineHeight: 1.45,
              }}
            >
              Done. I made a butterfly letter B page. I saved it in your binder. It is ready to
              print.
            </div>

            <div
              style={{
                padding: 14,
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-lg)",
                background: "var(--surface-card)",
                boxShadow: "var(--shadow-md)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <span
                    style={{
                      display: "inline-flex",
                      width: 34,
                      height: 34,
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: 10,
                      background: "var(--sky-100)",
                    }}
                  >
                    <FileText size={18} color="var(--sky-600)" aria-hidden="true" />
                  </span>
                  <div>
                    <p style={{ margin: 0, color: "var(--text-strong)", fontSize: "0.86rem", fontWeight: 700 }}>
                      Butterfly letter B
                    </p>
                    <p style={{ margin: "2px 0 0", color: "var(--text-subtle)", fontSize: "0.72rem" }}>
                      Practice page · PDF
                    </p>
                  </div>
                </div>
                <Printer size={18} color="var(--stone-500)" aria-label="Ready to print" />
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "0.8fr 1.2fr",
                  gap: 12,
                  marginTop: 13,
                  padding: 13,
                  borderRadius: "var(--radius-md)",
                  background: "var(--gold-100)",
                }}
              >
                <div
                  style={{
                    display: "grid",
                    placeItems: "center",
                    minHeight: 92,
                    borderRadius: "var(--radius-sm)",
                    background: "rgba(255,255,255,0.72)",
                    color: "var(--gold-ink-strong)",
                    fontFamily: "var(--font-display)",
                    fontSize: "2.3rem",
                    fontWeight: 700,
                  }}
                >
                  B b
                </div>
                <div style={{ display: "grid", alignContent: "center", gap: 7 }}>
                  {["B B B B B", "b b b b b", "butterfly"].map((line) => (
                    <span
                      key={line}
                      style={{
                        paddingBottom: 5,
                        borderBottom: "1px dashed rgba(64,46,5,0.3)",
                        color: "var(--gold-ink-strong)",
                        fontFamily: "var(--font-hand)",
                        fontSize: "0.9rem",
                        fontWeight: 600,
                      }}
                    >
                      {line}
                    </span>
                  ))}
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginTop: 11,
                  color: "var(--sage-700)",
                  fontSize: "0.76rem",
                  fontWeight: 700,
                }}
              >
                <Check size={14} aria-hidden="true" />
                Saved to the binder
              </div>
            </div>
          </div>
        </div>
      </div>
      <figcaption style={{ marginTop: 14, color: "var(--text-subtle)", fontSize: "0.78rem", textAlign: "center" }}>
        Maya is a demonstration child. No real family details appear here.
      </figcaption>
    </figure>
  );
}
