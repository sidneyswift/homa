import { Squiggle } from "./ds/Squiggle";
import { Doodle } from "./Doodle";
import { Eyebrow } from "./dividers";

/**
 * Our-story band. Replaces the kit's three invented mom quotes, which
 * violated ruling C2 (no fabricated social proof, ever). Until real
 * families say quotable things with their permission, the honest story is
 * the only story: Homa ran one real homeschool first.
 */
export function Stories() {
  return (
    <section id="stories" style={{ background: "var(--band-blush)", padding: "96px 40px 104px", position: "relative", overflow: "hidden" }}>
      <Doodle name="heart" size={30} color="var(--clay-600)" rotate={-10} style={{ position: "absolute", top: 42, left: "6%" }} />
      <Doodle name="sparkle" size={26} color="#fff" rotate={18} style={{ position: "absolute", bottom: 52, right: "5%" }} />
      <div style={{ maxWidth: 780, margin: "0 auto" }}>
        <div data-reveal="" style={{ textAlign: "center", marginBottom: 36 }}>
          <Eyebrow color="var(--clay-700)">Our story</Eyebrow>
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(2rem, 5vw, 2.6rem)",
              fontWeight: 700,
              color: "var(--text-strong)",
              margin: "8px 0 10px",
            }}
          >
            It ran our homeschool first.
          </h2>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <Squiggle segments={4} line={false} color="var(--clay-700)" style={{ width: "auto" }} />
          </div>
        </div>
        <div
          data-reveal=""
          className="rv-d1"
          style={{
            background: "var(--surface-card)",
            borderRadius: "var(--radius-xl)",
            boxShadow: "var(--shadow-sm)",
            padding: "30px 32px",
          }}
        >
          <p style={{ fontFamily: "var(--font-serif)", fontSize: "1.25rem", lineHeight: 1.55, color: "var(--text-strong)", margin: 0 }}>
            Homa began at one family&rsquo;s kitchen table: weekly plans, materials made for one
            specific kid, and a picture of where she stands that never once tested her.
          </p>
          <p style={{ color: "var(--text-muted)", lineHeight: 1.6, margin: "16px 0 0", fontSize: "0.98rem" }}>
            Homa is that same system, rebuilt for your family. And a promise: no invented
            testimonials on this page, ever. When real families say quotable things,
            you&rsquo;ll read them here with permission.
          </p>
        </div>
      </div>
    </section>
  );
}
