import { Squiggle } from "./ds/Squiggle";
import { Eyebrow } from "./dividers";

/**
 * FAQ, ported verbatim from
 * docs/homa-design/ui_kits/landing/LandingPage.jsx.
 */

const ITEMS: ReadonlyArray<readonly [string, string]> = [
  ["Does Homa follow my state's standards?", "Yes. Pick your state and every subject maps to it, you can see coverage at a glance."],
  ["Can I use my own curriculum?", "Bring it. Homa plans around any mix of bought, borrowed, and homemade."],
  ["What ages does it cover?", "The progress report covers every age from 2 to 16, with a checklist tuned to each age. Homa's personalized materials start richest for the early years and grow from there."],
  ["Does my child ever use it?", "Never. Homa is for you: your child never sees the checklist and never talks to an AI."],
  ["What if a week falls apart?", "Tell Homa. She reshuffles, nothing is lost, and a lighter week is still a school week."],
  ["What does it cost?", "The progress report is free. Homa itself is invite-only while founding families shape it; pricing will be published before anyone is charged a cent."],
];

export function Faq() {
  return (
    <section className="lp-pad" style={{ padding: "48px 40px 116px", maxWidth: 1000, margin: "0 auto" }}>
      <div data-reveal="" style={{ marginBottom: 48, maxWidth: 560 }}>
        <Eyebrow color="var(--pop-cobalt)">Good to know</Eyebrow>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: "2rem", fontWeight: 600, color: "var(--text-strong)", margin: "8px 0 14px" }}>
          Questions, answered
        </h2>
        <Squiggle color="var(--pop-cobalt)" />
      </div>
      <div data-reveal-kids="" className="lp-2col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "26px 40px" }}>
        {ITEMS.map(([q, a]) => (
          <div key={q}>
            <div style={{ fontWeight: 700, color: "var(--text-strong)", marginBottom: 6, fontSize: "1.02rem" }}>{q}</div>
            <div style={{ color: "var(--text-muted)", lineHeight: 1.55, fontSize: "0.95rem" }}>{a}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
