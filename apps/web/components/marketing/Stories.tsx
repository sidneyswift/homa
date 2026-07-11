import { Squiggle } from "./ds/Squiggle";
import { Doodle } from "./Doodle";
import { Eyebrow } from "./dividers";

/**
 * Our-story band. Replaces the kit's three invented mom quotes, which
 * violated ruling C2 (no fabricated social proof, ever). Until real
 * families say quotable things with their permission, the honest story is
 * the founders' own: built at their kitchen table, for homeschoolers like
 * them. Copy updated per founder direction 2026-07-09.
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
            Built by homeschoolers, for homeschoolers.
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
            We built this piece by piece, with our own kitchen table in mind. We wanted
            curriculum that met each kid where they stood: steady, growing, or ready for more practice. Not a
            one-size plan hoping it would fit. We wanted a tailored education without losing
            countless hours to research, hunting down unit studies and curricula to recombine
            into something that actually fit our own kids and family.
          </p>
          <p style={{ color: "var(--text-muted)", lineHeight: 1.6, margin: "16px 0 0", fontSize: "0.98rem" }}>
            Now, thanks to Homa, it&rsquo;s done.
          </p>
          <p style={{ color: "var(--text-muted)", lineHeight: 1.6, margin: "8px 0 0", fontSize: "0.98rem" }}>
            You teach. Homa handles the rest.
          </p>
          <p style={{ color: "var(--text-muted)", lineHeight: 1.6, margin: "8px 0 0", fontSize: "0.98rem" }}>
            Welcome to a new way to homeschool.
          </p>
        </div>
      </div>
    </section>
  );
}
