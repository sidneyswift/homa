import { CalendarHeart, ChartLine, ClipboardCheck, Compass, FilePen, Scale, type LucideIcon } from "lucide-react";

import { Card } from "./ds/Card";
import { Squiggle } from "./ds/Squiggle";
import { Doodle } from "./Doodle";
import { Eyebrow } from "./dividers";

/**
 * Six-card feature grid, ported from
 * docs/homa-design/ui_kits/landing/LandingPage.jsx (icons, copy, tints).
 * The "Proof it's working" body diverged from the kit per founder
 * screenshot 2026-07-07: "up 12 points" named a metric the progress
 * report doesn't have, so it now uses the report's real "moved up"
 * movement language instead.
 */

const ITEMS: ReadonlyArray<readonly [LucideIcon, string, string, string, string]> = [
  [
    ClipboardCheck,
    "Know where they stand",
    "A gentle skills questionnaire mapped to your state's standards.",
    "var(--clay-50)",
    "var(--clay-600)",
  ],
  [
    ChartLine,
    "Proof it's working",
    "Watch Homa's practice sets move the needle. Math moved up since April, that kind of proof.",
    "var(--sage-50)",
    "var(--sage-600)",
  ],
  [
    FilePen,
    "Practice that targets",
    "Workbook pages and sensory activities tuned to exactly what each child is growing through.",
    "var(--gold-100)",
    "var(--gold-ink)",
  ],
  [
    CalendarHeart,
    "Plans that flex",
    "Tell Homa how your week looks and she builds a schedule around real life, sick days, field trips, and all.",
    "var(--sky-100)",
    "var(--sky-600)",
  ],
  [
    Compass,
    "Your town, in the plan",
    "Space week? There's a planetarium day Saturday. Museums, story hours, zoos, and co-ops, matched to your lessons.",
    "var(--clay-50)",
    "var(--clay-600)",
  ],
  [
    Scale,
    "Compare curriculums",
    "Side-by-side, in plain language, against how your child actually learns, before you spend a dime.",
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
