import { ArrowRight } from "lucide-react";

import { Button } from "./ds/Button";
import { Doodle } from "./Doodle";

/**
 * Sunshine CTA band, ported verbatim from
 * docs/homa-design/ui_kits/landing/LandingPage.jsx.
 */
export function CtaBand() {
  return (
    <section style={{ background: "var(--band-sunshine)", padding: "112px 40px 120px", position: "relative", overflow: "hidden", textAlign: "center" }}>
      <Doodle name="star" size={38} color="var(--pop-cobalt)" rotate={-14} style={{ position: "absolute", top: 52, left: "9%" }} />
      <Doodle name="heart" size={30} color="var(--clay-600)" rotate={12} style={{ position: "absolute", bottom: 64, right: "9%" }} />
      <Doodle name="sparkle" size={24} color="#fff" rotate={20} style={{ position: "absolute", top: 66, right: "22%" }} />
      <h2
        data-reveal=""
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "clamp(2.2rem, 6vw, 3.1rem)",
          fontWeight: 700,
          letterSpacing: "-0.015em",
          color: "var(--text-strong)",
          margin: "18px 0 12px",
        }}
      >
        Ready for a calm Monday?
      </h2>
      <p
        data-reveal=""
        className="rv-d1"
        style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontWeight: 400, fontSize: "1.3rem", color: "var(--stone-700)", margin: "0 0 32px" }}
      >
        Set-up takes an afternoon. The calm shows up the same week.
      </p>
      <div data-reveal="" className="rv-d2" style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
        <Button variant="primary" size="lg" href="/map" iconRight={<ArrowRight size={18} color="#fff" aria-hidden="true" />}>
          Get your free progress report
        </Button>
        <Button variant="ghost" size="lg" href="/map/method" style={{ background: "var(--surface-card)" }}>
          How the map works
        </Button>
      </div>
      <div data-reveal="" className="rv-d2" style={{ marginTop: 16, fontSize: "0.88rem", fontWeight: 600, color: "var(--stone-700)" }}>
        Free &middot; about five minutes
      </div>
    </section>
  );
}
