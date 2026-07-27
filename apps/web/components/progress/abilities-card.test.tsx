import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { deriveAbilityMap } from "../../lib/child-progress/abilities";
import { buildAbilitiesSky } from "../../lib/child-progress/abilities-view";
import { AbilitiesCard } from "./abilities-card";

/**
 * The card's job is to show a mother her child's own sky and never to
 * imply a target. These tests guard the second half hardest: the
 * catalog's size, a percentage, or the word "behind" appearing here
 * would undo the whole surface.
 */

const NOW = new Date("2026-07-22T18:00:00.000Z");
const AGE = 52;

function render(
  evidence: Parameters<typeof deriveAbilityMap>[0],
  childName = "Story",
) {
  const sky = buildAbilitiesSky(deriveAbilityMap(evidence, AGE), AGE, NOW);
  return renderToStaticMarkup(
    <AbilitiesCard childName={childName} sky={sky} />,
  );
}

const LIT = [
  {
    itemId: "phonics.first-sound",
    answer: "easily" as const,
    observedAt: "2026-07-22T13:03:00.000Z",
  },
  {
    itemId: "math.how-many-5",
    answer: "easily" as const,
    observedAt: "2026-07-22T13:04:00.000Z",
  },
  {
    itemId: "math.small-groups",
    answer: "getting_there" as const,
    observedAt: "2026-05-01T10:00:00.000Z",
  },
];

describe("AbilitiesCard", () => {
  it("shows the count, the new stars, and the hand note", () => {
    const html = render(LIT);
    assert.match(html, /abilities so far/);
    assert.match(html, /2 new stars since last week/);
    assert.match(html, /every star is one you noticed/);
  });

  it("draws one star per lit ability", () => {
    const html = render(LIT);
    const dots = html.match(/class="absolute rounded-full"/gu) ?? [];
    assert.ok(
      dots.length >= LIT.length,
      `expected a star per ability, got ${dots.length}`,
    );
  });

  it("keeps every star round at any card width", () => {
    // The first version drew circles in a viewBox stretched with
    // preserveAspectRatio="none", which rendered each star as an
    // ellipse about nine times wider than tall. Equal width and height
    // in px is what makes the shape independent of the card's width.
    const html = render(LIT);
    const sizes = [...html.matchAll(/width:([\d.]+)px;height:([\d.]+)px/gu)];
    assert.ok(sizes.length >= LIT.length, "expected sized stars");
    for (const [, width, height] of sizes) {
      assert.equal(width, height, "a star must be as tall as it is wide");
    }
    assert.ok(!/preserveAspectRatio/u.test(html));
  });

  it("spreads stars across the strip instead of piling them on the ends", () => {
    // Per-subject normalization put a two-ability subject's stars at
    // 0% and 100%, so a real sky read as two clumps against the edges.
    const html = render(LIT);
    const lefts = [...html.matchAll(/left:([\d.]+)%/gu)].map((match) =>
      Number(match[1]),
    );
    assert.ok(lefts.length >= LIT.length);
    assert.ok(
      lefts.some((left) => left > 15 && left < 85),
      `expected stars away from the edges, got ${lefts.join(", ")}`,
    );
  });

  it("never renders a total, a percentage, or a target", () => {
    // Scan what a mother reads, not the markup: star positions are CSS
    // percentages and a raw-HTML scan would flag `left: 4%` as if it
    // were a score. Stripping tags is what makes this guard mean
    // "she is never shown a percentage".
    const text = render(LIT).replace(/<[^>]*>/gu, " ");
    assert.ok(!/\bof\s+\d{3,}/.test(text), "no 'of 1600'");
    assert.ok(!/%/.test(text), "no percentages");
    assert.ok(!/\b1[,.]?6\d\d\b/.test(text), "no catalog size");
    assert.ok(!/remaining|left to|out of|goal/i.test(text));
  });

  it("never uses deficit language", () => {
    const html = render(LIT);
    assert.ok(!/\bbehind\b/i.test(html));
    assert.ok(!/missing|incomplete|failed/i.test(html));
    assert.ok(!html.includes("—"), "no em dash");
  });

  it("invites rather than reporting zero when nothing is lit", () => {
    const html = render([]);
    // React escapes the apostrophe, as the sibling progress tests note.
    assert.match(html, /Story(?:&#x27;|')s map is ready/);
    assert.match(html, /Stars appear as Story shows/);
    // An empty sky must never render a scoreboard.
    assert.ok(!/\b0\b/.test(html), "no zero count");
    assert.ok(!/abilities so far/.test(html));
  });

  it("stays quiet about new stars in a quiet week", () => {
    const html = render([
      {
        itemId: "math.how-many-5",
        answer: "easily" as const,
        observedAt: "2026-01-05T10:00:00.000Z",
      },
    ]);
    assert.match(html, /abilities so far|ability so far/);
    assert.ok(!/new star/i.test(html), "no new-stars line in a quiet week");
    // And nothing that names the quiet as a shortfall.
    assert.ok(!/no new|nothing/i.test(html));
  });
});
