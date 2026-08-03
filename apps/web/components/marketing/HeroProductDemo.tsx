import type { ReactNode } from "react";

import { Logo } from "../brand/Logo";
import { Icon } from "../design/Icon";

/**
 * iOS Messages (16+) doesn't draw a triangular tail: the "tail" illusion is
 * only the tight 4px corner against the full 18px radius everywhere else.
 * An earlier version also clipped a hard triangle over that corner, which
 * read as a cartoon speech-bubble rather than a real text thread.
 */
function SentBubble({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        alignSelf: "flex-end",
        maxWidth: "86%",
        padding: "9px 13px",
        borderRadius: "18px 18px 4px 18px",
        background: "var(--clay-500)",
        color: "#fff",
        fontSize: "0.92rem",
        lineHeight: 1.35,
        boxShadow: "var(--shadow-sm)",
      }}
    >
      {children}
    </div>
  );
}

function ReceivedBubble({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        alignSelf: "flex-start",
        maxWidth: "88%",
        padding: "9px 13px",
        borderRadius: "18px 18px 18px 4px",
        background: "var(--surface-raised)",
        color: "var(--text-strong)",
        fontSize: "0.92rem",
        lineHeight: 1.35,
        boxShadow: "var(--shadow-sm)",
      }}
    >
      {children}
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
 * chrome that is not a texting signifier gets cut or condensed. Type sizes
 * are set for the hero's 0.72 to 0.78 float scale: the bubbles must stay
 * readable at 390px viewports, or the page's best proof is decoration.
 */
export function HeroProductDemo() {
  return (
    <figure className="lp-product-demo" style={{ margin: 0 }}>
      <div
        className="lp-demo-phone"
        role="img"
        aria-label="Text thread: a parent says Maya likes butterflies, and Homa replies with a butterfly math worksheet saved to the binder"
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 340,
          margin: "0 auto",
          padding: "10px",
          borderRadius: 46,
          background:
            "linear-gradient(115deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0) 16%), linear-gradient(165deg, #4a4541 0%, #221f1c 45%, #0c0b0a 100%)",
          boxShadow: "var(--shadow-xl), inset 0 0 0 1px rgba(255,255,255,0.12)",
        }}
      >
        {/* Hardware buttons, decorative only, with a faint bevel highlight */}
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            left: -2,
            top: 96,
            width: 3,
            height: 28,
            borderRadius: "2px 0 0 2px",
            background: "linear-gradient(90deg, #4a4540, #1a1815)",
          }}
        />
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            left: -2,
            top: 138,
            width: 3,
            height: 50,
            borderRadius: "2px 0 0 2px",
            background: "linear-gradient(90deg, #4a4540, #1a1815)",
          }}
        />
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            right: -2,
            top: 152,
            width: 3,
            height: 64,
            borderRadius: "0 2px 2px 0",
            background: "linear-gradient(270deg, #4a4540, #1a1815)",
          }}
        />

        <div
          style={{
            position: "relative",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            borderRadius: 37,
            background: "#f2ebe0",
            boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.4)",
          }}
        >
          {/* Dynamic Island */}
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              top: 9,
              left: "50%",
              zIndex: 3,
              width: 88,
              height: 24,
              transform: "translateX(-50%)",
              borderRadius: 16,
              background: "var(--stone-900)",
              boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.06)",
            }}
          />

          {/* Status bar: time left; bars, 5G, and a battery with a fill
              and charge nub right, matching a real iPhone. The island
              forces this vertical space, so it rides along nearly free. */}
          <div
            aria-hidden="true"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              minHeight: 30,
              padding: "9px 17px 0 21px",
              color: "var(--text-strong)",
              fontSize: "0.72rem",
              fontWeight: 700,
            }}
          >
            <span style={{ letterSpacing: "0.01em" }}>9:41</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
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
              <span style={{ fontSize: "0.64rem", fontWeight: 700, letterSpacing: "0.02em" }}>5G</span>
              {/* Battery: faint outline, solid fill, faint nub, like iOS. */}
              <span style={{ position: "relative", width: 22, height: 11, display: "inline-block" }}>
                <span
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    width: 19,
                    height: 11,
                    border: "1px solid currentColor",
                    borderRadius: 3,
                    opacity: 0.4,
                  }}
                />
                <span
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    left: 2,
                    top: 2,
                    width: 12,
                    height: 7,
                    borderRadius: 1.5,
                    background: "currentColor",
                  }}
                />
                <span
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    right: 0,
                    top: 3.75,
                    width: 1.5,
                    height: 3.5,
                    borderRadius: "0 2px 2px 0",
                    background: "currentColor",
                    opacity: 0.4,
                  }}
                />
              </span>
            </span>
          </div>

          {/* Messages contact header: back chevron with unread pill on the
              left, centered avatar with the name and a tiny chevron below,
              matching the real iOS anatomy while staying compact. */}
          <div
            style={{
              position: "relative",
              display: "grid",
              justifyItems: "center",
              gap: 2,
              padding: "3px 12px 7px",
              borderBottom: "1px solid rgba(214,200,180,0.65)",
              background: "rgba(251,247,240,0.94)",
            }}
          >
            <span
              aria-hidden="true"
              style={{
                position: "absolute",
                left: 10,
                top: "50%",
                transform: "translateY(-50%)",
                display: "inline-flex",
                alignItems: "center",
                gap: 1,
                color: "var(--clay-600)",
              }}
            >
              <Icon name="back" size={20} />
              <span
                style={{
                  minWidth: 18,
                  padding: "1px 6px",
                  borderRadius: "var(--radius-pill)",
                  background: "var(--clay-100)",
                  color: "var(--clay-600)",
                  fontSize: "0.62rem",
                  fontWeight: 700,
                  textAlign: "center",
                  lineHeight: 1.5,
                }}
              >
                3
              </span>
            </span>
            <span
              style={{
                display: "inline-flex",
                width: 32,
                height: 32,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "50%",
                background: "var(--clay-100)",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <Logo size={19} variant="mark" />
            </span>
            <p
              style={{
                margin: 0,
                display: "inline-flex",
                alignItems: "center",
                gap: 1,
                color: "var(--text-strong)",
                fontFamily: "var(--font-wordmark)",
                fontSize: "0.76rem",
                fontWeight: 600,
                letterSpacing: "-0.005em",
              }}
            >
              Homa
              <Icon name="next" size={16} color="var(--text-subtle)" />
            </p>
          </div>

          {/* Thread: one ask, one reply, one printable */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 7,
              padding: "9px 11px 9px",
              background: "linear-gradient(180deg, #f4ede3 0%, #ebe2d4 55%, #f4ede3 100%)",
            }}
          >
            {/* Real Messages threads open with a tiny centered day marker and
                show Delivered under your last sent bubble; both signifiers do
                more to sell the thread than any amount of chrome. */}
            <p
              aria-hidden="true"
              style={{
                margin: "0 0 1px",
                alignSelf: "center",
                color: "var(--text-subtle)",
                fontSize: "0.66rem",
                fontWeight: 500,
              }}
            >
              <strong style={{ fontWeight: 700 }}>Today</strong> 9:41
            </p>

            <SentBubble>Maya is into butterflies right now.</SentBubble>
            <p
              aria-hidden="true"
              style={{
                margin: "-3px 2px 0 0",
                alignSelf: "flex-end",
                color: "var(--text-subtle)",
                fontSize: "0.64rem",
                fontWeight: 600,
              }}
            >
              Delivered
            </p>

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
              <div style={{ position: "relative" }}>
                <img
                  src="/images/hero-butterfly-math.png"
                  alt=""
                  width={1024}
                  height={1536}
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
                {/* Fades the crop into the file row below so the worksheet
                    reads as a deliberate preview peek, not a broken image.
                    Both stops use the same RGB as --surface-raised (only
                    alpha changes) so the fade has no visible color seam. */}
                <div
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    bottom: 0,
                    height: 58,
                    background: "linear-gradient(to top, rgba(255,253,249,1) 0%, rgba(255,253,249,0) 100%)",
                  }}
                />
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "7px 10px",
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
                    flexShrink: 0,
                  }}
                >
                  <Icon name="document" size={16} color="var(--sky-600)" />
                </span>
                <div style={{ minWidth: 0 }}>
                  <p
                    style={{
                      margin: 0,
                      color: "var(--text-strong)",
                      fontSize: "0.8rem",
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
                      fontSize: "0.7rem",
                      fontWeight: 700,
                    }}
                  >
                    <Icon name="check" size={16} />
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
              padding: "7px 11px 4px",
              borderTop: "1px solid rgba(214,200,180,0.6)",
              background: "rgba(251,247,240,0.97)",
            }}
          >
            <span
              style={{
                display: "inline-flex",
                width: 26,
                height: 26,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "50%",
                background: "var(--stone-200)",
                color: "var(--stone-700)",
              }}
            >
              <Icon name="add" size={16} />
            </span>
            <span
              style={{
                flex: 1,
                minHeight: 31,
                display: "flex",
                alignItems: "center",
                padding: "0 12px",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-pill)",
                background: "var(--surface-raised)",
                color: "var(--text-subtle)",
                fontSize: "0.8rem",
                whiteSpace: "nowrap",
                overflow: "hidden",
              }}
            >
              Text Message · SMS
            </span>
            <span
              style={{
                display: "inline-flex",
                width: 30,
                height: 30,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "50%",
                background: "var(--clay-500)",
                color: "#fff",
              }}
            >
              <Icon name="send" size={16} />
            </span>
          </div>
          <div
            aria-hidden="true"
            style={{
              display: "flex",
              justifyContent: "center",
              padding: "2px 0 6px",
              background: "rgba(251,247,240,0.97)",
            }}
          >
            <span
              style={{
                width: 96,
                height: 3.5,
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
