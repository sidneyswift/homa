import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { deriveAbilityMap } from "./abilities";
import { buildAbilitiesSky } from "./abilities-view";
import {
  ABILITIES_LEGEND,
  abilitiesCount,
  abilitiesQuietWeek,
  abilityStateBody,
} from "./abilities-copy";

/**
 * The sky model's two guarantees, and the copy's one law.
 *
 * The catalog-size test is the important one: the map's whole promise
 * is that it counts up, and the fastest way to break that promise is
 * for some future field to carry a total or a percentage down to the
 * client. That test fails loudly if anyone adds one.
 */

const NOW = new Date("2026-07-22T18:00:00.000Z");
const AGE = 52;

function skyFor(evidence: Parameters<typeof deriveAbilityMap>[0]) {
  return buildAbilitiesSky(deriveAbilityMap(evidence, AGE), AGE, NOW);
}

const STORY_EVIDENCE = [
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

describe("buildAbilitiesSky", () => {
  it("places every lit ability as a star inside the canvas", () => {
    const sky = skyFor(STORY_EVIDENCE);
    const stars = sky.subjects.flatMap((subject) => subject.stars);
    assert.ok(stars.length >= 3);
    for (const star of stars) {
      assert.ok(star.x >= 0 && star.x <= 1, `x out of range: ${star.x}`);
      assert.ok(star.y >= 0 && star.y <= 1, `y out of range: ${star.y}`);
      assert.ok([1, 2, 3].includes(star.size));
    }
  });

  it("puts a star in the same place every time", () => {
    // A wandering star would say the map is decoration. It is her
    // child's record, so the sky is stable across renders and between
    // server and client.
    const first = skyFor(STORY_EVIDENCE);
    const second = skyFor(STORY_EVIDENCE);
    assert.deepEqual(first, second);
  });

  it("marks only the last seven days as new", () => {
    const sky = skyFor(STORY_EVIDENCE);
    const stars = new Map(
      sky.subjects.flatMap((subject) =>
        subject.stars.map((star) => [star.itemId, star]),
      ),
    );
    assert.equal(stars.get("phonics.first-sound")?.isNew, true);
    assert.equal(stars.get("math.small-groups")?.isNew, false);
    assert.equal(sky.newThisWeek, 2);
  });

  it("never lets an implied ability count as new", () => {
    // Implied abilities have no observed date, so they cannot be
    // this week's news; claiming otherwise would invent an event.
    const sky = skyFor(STORY_EVIDENCE);
    for (const subject of sky.subjects) {
      for (const star of subject.stars) {
        if (star.state === "implied") assert.equal(star.isNew, false);
      }
    }
  });

  it("never draws an edge into an unlit ability", () => {
    const sky = skyFor(STORY_EVIDENCE);
    for (const subject of sky.subjects) {
      const lit = new Set(subject.stars.map((star) => star.itemId));
      for (const edge of subject.edges) {
        assert.ok(
          lit.has(edge.fromItemId),
          "an edge may only start at a lit star",
        );
      }
    }
  });

  it("carries no denominator, percentage, or catalog total anywhere", () => {
    // The load-bearing test. The catalog is ~1,600 abilities; a mother
    // with three stars must never receive that number in any form.
    const sky = skyFor(STORY_EVIDENCE);
    const serialized = JSON.stringify(sky);
    assert.ok(!/\btotal\b/i.test(serialized), "no total field");
    assert.ok(!/percent|ratio|denominator/i.test(serialized));
    assert.ok(!/\bof\s+\d{3,}/.test(serialized), "no 'of 1600' shape");
    // Walk real numeric values, not digit runs: star coordinates are
    // floats and their decimals are not counts.
    const walk = (value: unknown, path: string): void => {
      if (typeof value === "number") {
        assert.ok(
          value < 1000,
          `a number this large can only be a catalog size: ${path}=${value}`,
        );
        return;
      }
      if (Array.isArray(value)) {
        value.forEach((entry, index) => walk(entry, `${path}[${index}]`));
        return;
      }
      if (value && typeof value === "object") {
        for (const [key, entry] of Object.entries(value)) {
          walk(entry, `${path}.${key}`);
        }
      }
    };
    walk(sky, "sky");
  });

  it("lists unlit subjects by name and never by count", () => {
    const sky = buildAbilitiesSky(
      deriveAbilityMap(STORY_EVIDENCE, AGE),
      AGE,
      NOW,
      ["Music", "Art"],
    );
    assert.deepEqual(sky.moreToExplore, ["Music", "Art"]);
  });

  it("returns an honest empty sky for a child with no evidence", () => {
    const sky = skyFor([]);
    assert.deepEqual(sky.subjects, []);
    assert.equal(sky.lit, 0);
    assert.equal(sky.newThisWeek, 0);
  });
});

describe("abilities copy", () => {
  it("counts up and never says out of", () => {
    assert.equal(abilitiesCount(1, 0), "1 ability so far");
    assert.equal(abilitiesCount(40, 4), "40 abilities so far · 4 new this week");
    assert.ok(!abilitiesCount(40, 4).includes("of"));
  });

  it("keeps a quiet week about the week, never the mother", () => {
    const line = abilitiesQuietWeek("Story");
    assert.match(line, /quieter week/);
    assert.ok(!/\b0\b|nothing|missed|behind/i.test(line));
  });

  it("treats not yet as a normal answer", () => {
    const body = abilityStateBody("not_yet", "Story");
    assert.match(body, /normal answer/);
    assert.ok(!/behind|fail|late/i.test(body));
  });

  it("obeys the voice laws in every string", () => {
    const strings = [
      ...ABILITIES_LEGEND,
      abilitiesCount(12, 2),
      abilitiesQuietWeek("Story"),
      ...(["mastered", "emerging", "not_yet", "implied"] as const).map(
        (state) => abilityStateBody(state, "Story"),
      ),
    ];
    for (const value of strings) {
      assert.ok(!value.includes("—"), `em dash in: ${value}`);
      assert.ok(!/\bbehind\b/i.test(value), `banned word in: ${value}`);
    }
  });
});
