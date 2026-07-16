import { Check, FileText } from "lucide-react";

import { Logo } from "../brand/Logo";

/**
 * Fixture-safe proof shaped like a phone text thread. HTML rather than a
 * screenshot so the example stays legible, responsive, and accessible.
 * Sent bubbles use Homa clay (not Apple blue) so the demo stays on brand
 * while still reading as Messages: contact header, left/right bubbles,
 * MMS attachment, and a composer.
 */
export function HeroProductDemo() {
  return (
    <figure className="lp-product-demo" style={{ margin: 0 }}>
      <div
        className="lp-product-demo-phone"
        role="img"
        aria-label="Example text thread: a parent asks Homa for butterfly letter B practice, and Homa replies with a printable page saved to the binder"
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 300,
          margin: "0 auto",
          padding: "11px",
          borderRadius: 44,
          background: "linear-gradient(165deg, #3f3831 0%, var(--stone-900) 42%, #14110f 100%)",
          boxShadow: "var(--shadow-xl), inset 0 0 0 1px rgba(255,255,255,0.1)",
        }}
      >
        {/* Hardware buttons, decorative only */}
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            left: -2,
            top: 88,
            width: 3,
            height: 26,
            borderRadius: "2px 0 0 2px",
            background: "#2c2824",
          }}
        />
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            left: -2,
            top: 126,
            width: 3,
            height: 46,
            borderRadius: "2px 0 0 2px",
            background: "#2c2824",
          }}
        />
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            right: -2,
            top: 140,
            width: 3,
            height: 60,
            borderRadius: "0 2px 2px 0",
            background: "#2c2824",
          }}
        />

        <div
          style={{
            position: "relative",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            minHeight: 600,
            borderRadius: 36,
            background: "#f2ebe0",
            boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.4)",
          }}
        >
          {/* Dynamic Island */}
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              top: 11,
              left: "50%",
              zIndex: 3,
              width: 92,
              height: 26,
              transform: "translateX(-50%)",
              borderRadius: 18,
              background: "var(--stone-900)",
              boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.06)",
            }}
          />

          {/* Status bar */}
          <div
            aria-hidden="true"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              minHeight: 46,
              padding: "14px 20px 0",
              color: "var(--text-strong)",
              fontSize: "0.76rem",
              fontWeight: 700,
            }}
          >
            <span>9:41</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ display: "inline-flex", alignItems: "flex-end", gap: 1.5, height: 10 }}>
                {[4, 6, 8, 10].map((h) => (
                  <span
                    key={h}
                    style={{
                      width: 2.5,
                      height: h,
                      borderRadius: 1,
                      background: "currentColor",
                    }}
                  />
                ))}
              </span>
              <span
                style={{
                  width: 12,
                  height: 12,
                  border: "1.5px solid currentColor",
                  borderRadius: "50%",
                  borderTopColor: "transparent",
                  borderRightColor: "transparent",
                  transform: "rotate(45deg)",
                  opacity: 0.9,
                }}
              />
              <span
                style={{
                  width: 18,
                  height: 10,
                  border: "1.5px solid currentColor",
                  borderRadius: 2.5,
                  position: "relative",
                  opacity: 0.9,
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    inset: 1.5,
                    width: "62%",
                    background: "currentColor",
                    borderRadius: 1,
                  }}
                />
              </span>
            </span>
          </div>

          {/* Messages contact header */}
          <div
            style={{
              display: "grid",
              justifyItems: "center",
              gap: 3,
              padding: "4px 14px 11px",
              borderBottom: "1px solid rgba(214,200,180,0.65)",
              background: "rgba(251,247,240,0.94)",
            }}
          >
            <span
              style={{
                display: "inline-flex",
                width: 42,
                height: 42,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "50%",
                background: "var(--clay-100)",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <Logo size={24} />
            </span>
            <p
              style={{
                margin: 0,
                color: "var(--text-strong)",
                fontFamily: "var(--font-wordmark)",
                fontSize: "1rem",
                fontWeight: 600,
                letterSpacing: "-0.01em",
              }}
            >
              Homa
            </p>
            <p style={{ margin: 0, color: "var(--text-subtle)", fontSize: "0.66rem", fontWeight: 650 }}>
              Text Message · Example
            </p>
          </div>

          {/* Thread */}
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              gap: 6,
              padding: "12px 10px 8px",
              background: "linear-gradient(180deg, #f4ede3 0%, #ebe2d4 55%, #f4ede3 100%)",
            }}
          >
            <p
              aria-hidden="true"
              style={{
                margin: "0 0 4px",
                textAlign: "center",
                color: "var(--text-subtle)",
                fontSize: "0.66rem",
                fontWeight: 650,
              }}
            >
              Today 7:12 AM
            </p>

            {/* Parent sent bubble */}
            <div style={{ alignSelf: "flex-end", position: "relative", maxWidth: "86%" }}>
              <div
                style={{
                  padding: "9px 12px",
                  borderRadius: "18px 18px 4px 18px",
                  background: "var(--clay-500)",
                  color: "#fff",
                  fontSize: "0.88rem",
                  lineHeight: 1.38,
                  boxShadow: "var(--shadow-sm)",
                }}
              >
                Maya is into butterflies right now. Can you make letter B practice for tomorrow?
              </div>
              <span
                aria-hidden="true"
                style={{
                  position: "absolute",
                  right: -1,
                  bottom: 1,
                  width: 10,
                  height: 12,
                  background: "var(--clay-500)",
                  clipPath: "polygon(0 0, 0 100%, 100% 100%)",
                }}
              />
            </div>
            <p
              aria-hidden="true"
              style={{
                alignSelf: "flex-end",
                margin: "0 6px 6px 0",
                color: "var(--text-subtle)",
                fontSize: "0.62rem",
                fontWeight: 650,
              }}
            >
              Delivered
            </p>

            {/* Homa received bubble */}
            <div style={{ alignSelf: "flex-start", position: "relative", maxWidth: "88%" }}>
              <div
                style={{
                  padding: "9px 12px",
                  borderRadius: "18px 18px 18px 4px",
                  background: "var(--surface-raised)",
                  color: "var(--text-strong)",
                  fontSize: "0.88rem",
                  lineHeight: 1.38,
                  boxShadow: "var(--shadow-sm)",
                }}
              >
                Done. I made a butterfly letter B page. I saved it in your binder. It is ready to
                print.
              </div>
              <span
                aria-hidden="true"
                style={{
                  position: "absolute",
                  left: -1,
                  bottom: 1,
                  width: 10,
                  height: 12,
                  background: "var(--surface-raised)",
                  clipPath: "polygon(100% 0, 0 100%, 100% 100%)",
                }}
              />
            </div>

            {/* MMS-style attachment */}
            <div
              style={{
                alignSelf: "flex-start",
                width: "86%",
                overflow: "hidden",
                marginTop: 2,
                borderRadius: 18,
                background: "var(--surface-raised)",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "0.7fr 1.3fr",
                  gap: 7,
                  padding: 9,
                  background: "var(--gold-100)",
                }}
              >
                <div
                  style={{
                    display: "grid",
                    placeItems: "center",
                    minHeight: 70,
                    borderRadius: 12,
                    background: "rgba(255,255,255,0.82)",
                    color: "var(--gold-ink-strong)",
                    fontFamily: "var(--font-display)",
                    fontSize: "1.7rem",
                    fontWeight: 700,
                  }}
                >
                  B b
                </div>
                <div style={{ display: "grid", alignContent: "center", gap: 4 }}>
                  {["B B B B", "b b b b", "butterfly"].map((line) => (
                    <span
                      key={line}
                      style={{
                        paddingBottom: 2,
                        borderBottom: "1px dashed rgba(64,46,5,0.28)",
                        color: "var(--gold-ink-strong)",
                        fontFamily: "var(--font-hand)",
                        fontSize: "0.74rem",
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
                  gap: 8,
                  padding: "8px 10px",
                  borderTop: "1px solid var(--border-subtle)",
                }}
              >
                <span
                  style={{
                    display: "inline-flex",
                    width: 26,
                    height: 26,
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 7,
                    background: "var(--sky-100)",
                  }}
                >
                  <FileText size={14} color="var(--sky-600)" aria-hidden="true" />
                </span>
                <div style={{ minWidth: 0 }}>
                  <p
                    style={{
                      margin: 0,
                      color: "var(--text-strong)",
                      fontSize: "0.74rem",
                      fontWeight: 700,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    Butterfly letter B.pdf
                  </p>
                  <p
                    style={{
                      margin: "1px 0 0",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 3,
                      color: "var(--sage-700)",
                      fontSize: "0.64rem",
                      fontWeight: 700,
                    }}
                  >
                    <Check size={11} aria-hidden="true" />
                    Saved to the binder
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Composer */}
          <div
            aria-hidden="true"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              padding: "8px 10px 6px",
              borderTop: "1px solid rgba(214,200,180,0.6)",
              background: "rgba(251,247,240,0.97)",
            }}
          >
            <span
              style={{
                display: "inline-flex",
                width: 28,
                height: 28,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "50%",
                background: "var(--stone-200)",
                color: "var(--stone-700)",
                fontSize: "1.1rem",
                fontWeight: 500,
                lineHeight: 1,
              }}
            >
              +
            </span>
            <span
              style={{
                flex: 1,
                minHeight: 32,
                display: "flex",
                alignItems: "center",
                padding: "0 12px",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-pill)",
                background: "var(--surface-raised)",
                color: "var(--text-subtle)",
                fontSize: "0.8rem",
              }}
            >
              Text Message
            </span>
            <span
              style={{
                display: "inline-flex",
                width: 32,
                height: 32,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "50%",
                background: "var(--clay-500)",
                color: "#fff",
                fontSize: "0.9rem",
                fontWeight: 700,
              }}
            >
              ↑
            </span>
          </div>

          {/* Home indicator */}
          <div
            aria-hidden="true"
            style={{
              display: "flex",
              justifyContent: "center",
              padding: "6px 0 8px",
              background: "rgba(251,247,240,0.97)",
            }}
          >
            <span
              style={{
                width: 104,
                height: 4,
                borderRadius: 4,
                background: "var(--stone-800)",
                opacity: 0.32,
              }}
            />
          </div>
        </div>
      </div>
      <figcaption
        style={{ marginTop: 14, color: "var(--text-subtle)", fontSize: "0.78rem", textAlign: "center" }}
      >
        Maya is a demonstration child. No real family details appear here.
      </figcaption>
    </figure>
  );
}
