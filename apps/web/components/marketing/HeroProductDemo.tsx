import type { ReactNode } from "react";
import { Check, FileText } from "lucide-react";

import { Logo } from "../brand/Logo";

function SentBubble({ children }: { children: ReactNode }) {
  return (
    <div style={{ alignSelf: "flex-end", position: "relative", maxWidth: "86%" }}>
      <div
        style={{
          padding: "8px 11px",
          borderRadius: "18px 18px 4px 18px",
          background: "var(--clay-500)",
          color: "#fff",
          fontSize: "0.84rem",
          lineHeight: 1.35,
          boxShadow: "var(--shadow-sm)",
        }}
      >
        {children}
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
  );
}

function ReceivedBubble({ children }: { children: ReactNode }) {
  return (
    <div style={{ alignSelf: "flex-start", position: "relative", maxWidth: "88%" }}>
      <div
        style={{
          padding: "8px 11px",
          borderRadius: "18px 18px 18px 4px",
          background: "var(--surface-raised)",
          color: "var(--text-strong)",
          fontSize: "0.84rem",
          lineHeight: 1.35,
          boxShadow: "var(--shadow-sm)",
        }}
      >
        {children}
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
  );
}

/**
 * Fixture-safe proof shaped like a phone text thread. HTML rather than a
 * screenshot so the example stays legible, responsive, and accessible.
 * Sent bubbles use Homa clay (not Apple blue) so the demo stays on brand
 * while still reading as Messages: slim inline contact row, left/right
 * bubbles, MMS attachment, and a slim composer. Keep it short: the hero
 * value is the quick exchange plus the worksheet, so every pixel of
 * chrome that is not a texting signifier gets cut or condensed.
 */
export function HeroProductDemo() {
  return (
    <figure className="lp-product-demo" style={{ margin: 0 }}>
      <div
        className="lp-product-demo-phone"
        role="img"
        aria-label="Text thread: a parent says Maya likes butterflies, and Homa replies with a butterfly-themed count-and-graph worksheet saved to the binder"
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 280,
          margin: "0 auto",
          padding: "10px",
          borderRadius: 40,
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
            borderRadius: 32,
            background: "#f2ebe0",
            boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.4)",
          }}
        >
          {/* Dynamic Island */}
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              top: 8,
              left: "50%",
              zIndex: 3,
              width: 78,
              height: 22,
              transform: "translateX(-50%)",
              borderRadius: 16,
              background: "var(--stone-900)",
              boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.06)",
            }}
          />

          {/* Status bar: the island forces this vertical space, so time,
              signal, and battery ride along nearly free. No wifi arc, it
              reads badly this small. */}
          <div
            aria-hidden="true"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              minHeight: 28,
              padding: "8px 16px 0",
              color: "var(--text-strong)",
              fontSize: "0.68rem",
              fontWeight: 700,
            }}
          >
            <span>9:41</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <span style={{ display: "inline-flex", alignItems: "flex-end", gap: 1.5, height: 9 }}>
                {[3.5, 5.5, 7.5, 9].map((h) => (
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
                  width: 17,
                  height: 9,
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

          {/* Slim contact row: identity once, inline, like a scrolled
              Messages header. The stacked avatar-over-name card is
              navigation UI and wastes hero height. */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              padding: "3px 12px 7px",
              borderBottom: "1px solid rgba(214,200,180,0.65)",
              background: "rgba(251,247,240,0.94)",
            }}
          >
            <span
              style={{
                display: "inline-flex",
                width: 22,
                height: 22,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "50%",
                background: "var(--clay-100)",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <Logo size={14} variant="mark" />
            </span>
            <p
              style={{
                margin: 0,
                color: "var(--text-strong)",
                fontFamily: "var(--font-wordmark)",
                fontSize: "0.88rem",
                fontWeight: 600,
                letterSpacing: "-0.01em",
              }}
            >
              Homa
            </p>
          </div>

          {/* Thread: one ask, one reply, one printable */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
              padding: "8px 10px 8px",
              background: "linear-gradient(180deg, #f4ede3 0%, #ebe2d4 55%, #f4ede3 100%)",
            }}
          >
            <SentBubble>Maya is into butterflies right now.</SentBubble>

            <ReceivedBubble>Great! I&apos;ll make today&apos;s math worksheet butterfly-themed.</ReceivedBubble>

            {/* MMS-style attachment: generated count-and-graph preview */}
            <div
              style={{
                alignSelf: "flex-start",
                width: "88%",
                overflow: "hidden",
                borderRadius: 16,
                background: "var(--surface-raised)",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <img
                src="/images/hero-butterfly-math.png"
                alt=""
                width={640}
                height={853}
                style={{
                  display: "block",
                  width: "100%",
                  height: "auto",
                  maxHeight: 148,
                  objectFit: "cover",
                  objectPosition: "top center",
                  background: "#fff",
                }}
              />
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  padding: "6px 9px",
                  borderTop: "1px solid var(--border-subtle)",
                }}
              >
                <span
                  style={{
                    display: "inline-flex",
                    width: 24,
                    height: 24,
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 6,
                    background: "var(--sky-100)",
                    flexShrink: 0,
                  }}
                >
                  <FileText size={13} color="var(--sky-600)" aria-hidden="true" />
                </span>
                <div style={{ minWidth: 0 }}>
                  <p
                    style={{
                      margin: 0,
                      color: "var(--text-strong)",
                      fontSize: "0.72rem",
                      fontWeight: 700,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    Butterfly math.pdf
                  </p>
                  <p
                    style={{
                      margin: "1px 0 0",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 3,
                      color: "var(--sage-700)",
                      fontSize: "0.62rem",
                      fontWeight: 700,
                    }}
                  >
                    <Check size={10} aria-hidden="true" />
                    Saved to the binder
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Slim composer + home indicator */}
          <div
            aria-hidden="true"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 10px 4px",
              borderTop: "1px solid rgba(214,200,180,0.6)",
              background: "rgba(251,247,240,0.97)",
            }}
          >
            <span
              style={{
                display: "inline-flex",
                width: 24,
                height: 24,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "50%",
                background: "var(--stone-200)",
                color: "var(--stone-700)",
                fontSize: "1rem",
                fontWeight: 500,
                lineHeight: 1,
              }}
            >
              +
            </span>
            <span
              style={{
                flex: 1,
                minHeight: 28,
                display: "flex",
                alignItems: "center",
                padding: "0 11px",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-pill)",
                background: "var(--surface-raised)",
                color: "var(--text-subtle)",
                fontSize: "0.74rem",
              }}
            >
              Text Message
            </span>
            <span
              style={{
                display: "inline-flex",
                width: 28,
                height: 28,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "50%",
                background: "var(--clay-500)",
                color: "#fff",
                fontSize: "0.82rem",
                fontWeight: 700,
              }}
            >
              ↑
            </span>
          </div>
          <div
            aria-hidden="true"
            style={{
              display: "flex",
              justifyContent: "center",
              padding: "2px 0 5px",
              background: "rgba(251,247,240,0.97)",
            }}
          >
            <span
              style={{
                width: 88,
                height: 3,
                borderRadius: 3,
                background: "var(--stone-800)",
                opacity: 0.32,
              }}
            />
          </div>
        </div>
      </div>
    </figure>
  );
}
