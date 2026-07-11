import { CalendarHeart, ChartLine, ClipboardCheck, Compass, FilePen, Scale, type LucideIcon } from "lucide-react";

import { Card } from "./ds/Card";
import { Squiggle } from "./ds/Squiggle";
import { Doodle } from "./Doodle";
import { Eyebrow } from "./dividers";

/**
 * Six-card feature grid, ported from
 * docs/homa-design/ui_kits/landing/LandingPage.jsx (icons, tints). Copy
 * updated per founder direction 2026-07-09.
 */

const ITEMS: ReadonlyArray<readonly [LucideIcon, string, string, string, string]> = [
  [
    ClipboardCheck,
    "Know where they stand",
    "Daily photos and a quick recap at night build a living timeline. Homa reads the pattern, steady, growing, or finding their feet, and adapts the plan to match.",
    "var(--clay-50)",
    "var(--clay-600)",
  ],
  [
    ChartLine,
    "Proof it's working",
    "Not a feeling. A number. Watch mastery climb as Homa's practice sets close the actual gaps. Change you can see on the timeline.",
    "var(--sage-50)",
    "var(--sage-600)",
  ],
  [
    FilePen,
    "Practice that targets",
    "No generic worksheets. Every page is built around the exact skill your child needs to strengthen right now.",
    "var(--gold-100)",
    "var(--gold-ink)",
  ],
  [
    CalendarHeart,
    "Plans that flex",
    "Sick days, field trips, the morning nobody can find a single shoe. Tell Homa how your day is going, and she'll build your week around it. No missed beats. No missed lessons.",
    "var(--sky-100)",
    "var(--sky-600)",
  ],
  [
    Compass,
    "Your town, in the plan",
    "Space Week? There's a new exhibit downtown. Diving into the Civil War? There's a local reenactment on Saturday. Homa builds it into the classroom.",
    "var(--clay-50)",
    "var(--clay-600)",
  ],
  [
    Scale,
    "Compare curriculums",
    "Side by side, in plain language. Homa already knows what your kid likes, how they learn, and where they're at. Find the right fit the first time. Every time.",
    "var(--sage-50)",
    "var(--sage-600)",
  ],
];

export function Features() {
  return (
    <section
      id="features"
      className="lp-pad"
      style={{ padding: "124px 40px 104px", maxWidth: 1200, margin: "0 auto", position: "relative" }}
    >
      <Doodle name="sparkle" size={26} color="var(--pop-blush)" rotate={12} style={{ position: "absolute", top: 84, right: "5%" }} />
      <div data-reveal="" style={{ marginBottom: 64, maxWidth: 620 }}>
        <Eyebrow>Everything in one place</Eyebrow>
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(2rem, 5vw, 2.6rem)",
            fontWeight: 700,
            color: "var(--text-strong)",
            margin: "10px 0 14px",
          }}
        >
          Less admin. More teaching.
        </h2>
        <Squiggle />
      </div>
      <div data-reveal-kids="" className="lp-3col" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
        {ITEMS.map(([Icon, title, body, tint, fg]) => (
          <Card key={title} padding="lg">
            <span
              style={{
                width: 52,
                height: 52,
                borderRadius: "var(--blob-2)",
                background: tint,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon size={24} color={fg} aria-hidden="true" />
            </span>
            <h3
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "1.3rem",
                fontWeight: 600,
                color: "var(--text-strong)",
                margin: "16px 0 6px",
              }}
            >
              {title}
            </h3>
            <p style={{ color: "var(--text-muted)", lineHeight: 1.55, margin: 0, fontSize: "0.98rem" }}>{body}</p>
          </Card>
        ))}
      </div>
    </section>
  );
}
