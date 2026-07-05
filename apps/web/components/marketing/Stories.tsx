import { Avatar } from "./ds/Avatar";
import { Squiggle } from "./ds/Squiggle";
import { Doodle } from "./Doodle";
import { Eyebrow } from "./dividers";

/**
 * Stories band, ported verbatim from
 * docs/homa-design/ui_kits/landing/LandingPage.jsx: three mom quotes on the
 * blush band, serif pull-quote type per the v3 type rules.
 */

const QUOTES: ReadonlyArray<readonly [string, string, string]> = [
  [
    "I was drowning in printables and half-made plans. Homa gave me a calm week, every week.",
    "Priya Shah",
    "Homeschooling 3 · Austin, TX",
  ],
  [
    "The benchmarks finally quieted the am-I-doing-enough voice in my head.",
    "Dana Kim",
    "Homeschooling 2 · Boise, ID",
  ],
  [
    "My son asked if we could do school on a Saturday. That never used to happen.",
    "Lena Ruiz",
    "Homeschooling 1 · Asheville, NC",
  ],
];

export function Stories() {
  return (
    <section id="stories" style={{ background: "var(--band-blush)", padding: "96px 40px 104px", position: "relative", overflow: "hidden" }}>
      <Doodle name="heart" size={30} color="var(--clay-600)" rotate={-10} style={{ position: "absolute", top: 42, left: "6%" }} />
      <Doodle name="sparkle" size={26} color="#fff" rotate={18} style={{ position: "absolute", bottom: 52, right: "5%" }} />
      <div style={{ maxWidth: 1140, margin: "0 auto" }}>
        <div data-reveal="" style={{ textAlign: "center", marginBottom: 40 }}>
          <Eyebrow color="var(--clay-700)">Stories</Eyebrow>
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(2rem, 5vw, 2.6rem)",
              fontWeight: 700,
              color: "var(--text-strong)",
              margin: "8px 0 10px",
            }}
          >
            What moms tell us
          </h2>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <Squiggle segments={4} line={false} color="var(--clay-700)" style={{ width: "auto" }} />
          </div>
        </div>
        <div data-reveal-kids="" className="lp-3col" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20, alignItems: "stretch" }}>
          {QUOTES.map(([q, name, meta]) => (
            <div
              key={name}
              style={{
                background: "var(--surface-card)",
                borderRadius: "var(--radius-xl)",
                boxShadow: "var(--shadow-sm)",
                padding: "26px 26px 22px",
                display: "flex",
                flexDirection: "column",
                gap: 18,
              }}
            >
              <blockquote style={{ fontFamily: "var(--font-serif)", fontSize: "1.18rem", lineHeight: 1.45, color: "var(--text-strong)", margin: 0, flex: 1 }}>
                &ldquo;{q}&rdquo;
              </blockquote>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Avatar name={name} size={36} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: "0.92rem", color: "var(--text-strong)" }}>{name}</div>
                  <div style={{ color: "var(--text-subtle)", fontSize: "0.8rem" }}>{meta}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
