import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { MAP_SUBJECTS } from "./bank";
import { buildFourWeekPlan, buildMonthPlan, skillPhrase } from "./plans";

/**
 * Plan activity text is parent-facing prose, and it is the first thing a
 * new family reads on their week (walk 007, 2026-07-29, where the wow
 * screen said "Ten minutes a day of adding and subtracts small numbers").
 *
 * The activity templates splice a bank statement into a sentence after
 * "ten minutes a day of...", which means every statement in the bank is
 * a sentence fragment that has to survive being conjugated. These tests
 * generate the real activities across every subject, every age band and
 * both interest-bearing and bare contexts, then assert the fragments
 * came out as English. They are grammar tests, not content tests: they
 * do not care what the plan recommends, only that it reads.
 */

/** Every item id, so a plan can be forced to target any subject. */
const ALL_ITEM_IDS = MAP_SUBJECTS.flatMap((subject) => subject.items.map((item) => item.id));

const AGES = [30, 42, 54, 66, 78, 90, 102, 114, 126, 138, 150];
const CONTEXTS = [
  {},
  { interests: ["horses"] },
  { interests: ["dinosaurs"], style: "Charlotte Mason" },
];

/** Every distinct activity string the builders can produce. */
function allActivities(): string[] {
  const seen = new Set<string>();
  for (const ageMonths of AGES) {
    for (const answer of ["not_yet", "getting_there", "easily"] as const) {
      const answers = ALL_ITEM_IDS.map((itemId) => ({ itemId, answer }));
      for (const context of CONTEXTS) {
        buildMonthPlan(ageMonths, answers, context)?.weeks.forEach((week) =>
          week.activities.forEach((activity) => seen.add(activity)),
        );
        for (const subject of MAP_SUBJECTS) {
          buildFourWeekPlan(subject.id, ageMonths, answers, context)?.weeks.forEach((week) =>
            week.activities.forEach((activity) => seen.add(activity)),
          );
        }
      }
    }
  }
  return [...seen];
}

describe("plan activity grammar", () => {
  const activities = allActivities();

  it("generates activities at all, so the assertions below mean something", () => {
    assert.ok(activities.length > 100, `expected a broad sample, got ${activities.length}`);
  });

  it("never doubles a consonant on a two-syllable verb", () => {
    // "opens" matched the consonant-vowel-consonant letter pattern and
    // shipped "openning". Doubling is for one-syllable verbs only.
    const offenders = activities.filter((activity) =>
      /\b(openning|listenning|happenning|offerring|enterring)\b/.test(activity),
    );
    assert.deepEqual(offenders, []);
  });

  it("conjugates a verb coordinated directly with the first one", () => {
    // The real statements this broke on, asserted against the
    // conjugator itself rather than against generated activities, whose
    // presence depends on which targets a plan happens to pick.
    const cases: [string, string][] = [
      ["Adds and subtracts small numbers in their head, like 7 plus 2", "adding and subtracting"],
      ["Gets and uses figurative language ('this room is a zoo')", "getting and using"],
      ["Writes and runs code in a text language like Python or JavaScript", "writing and running"],
    ];
    for (const [statement, expected] of cases) {
      assert.ok(
        skillPhrase(statement).startsWith(expected),
        `"${statement}" produced "${skillPhrase(statement)}"`,
      );
    }
  });

  it("conjugates every verb of a comma series, and leaves the object alone", () => {
    assert.equal(
      skillPhrase("Throws, catches, and kicks well enough to really play a game"),
      "throwing, catching, and kicking well enough to really play a game",
    );
    assert.equal(
      skillPhrase("Bounces, sways, or dances when music plays"),
      "bouncing, swaying, or dancing when music plays",
    );
  });

  it("stops at the first non-verb, so an appositive survives", () => {
    assert.equal(
      skillPhrase("Gallops, one foot leading the other"),
      "galloping, one foot leading the other",
    );
    // A plain space is not a coordination, so the noun stays a noun.
    assert.equal(skillPhrase("Knows letters and sounds"), "knowing letters and sounds");
  });

  it("does not double a two-syllable verb", () => {
    assert.ok(skillPhrase("Opens twist lids").startsWith("opening"));
    // and still doubles the one-syllable ones
    assert.ok(skillPhrase("Runs a mile").startsWith("running"));
    assert.ok(skillPhrase("Skips rope").startsWith("skipping"));
  });

  it("has exactly one known gap left, and no new ones", () => {
    // A ratchet, not a pass. Where the two verbs are separated by an
    // object ("runs without falling and climbs onto furniture"), telling
    // a coordinated VERB from a coordinated NOUN ("uses loops and
    // events on purpose") is a judgment call, and AGENTS.md forbids
    // deciding what a sentence means with hand-written patterns. So the
    // remaining fragment is left rather than guessed at, and the real
    // repair is rewording the statement in the bank.
    //
    // If this list grows, a new statement was written in a shape the
    // conjugator cannot read. Reword the statement; do not widen the
    // regex.
    const KNOWN_GAPS = ["running without falling and climbs onto furniture"];
    const offenders = activities.filter((activity) => /\b[a-z]+ing and [a-z]+s\b/.test(activity));
    const unexplained = offenders.filter(
      (activity) => !KNOWN_GAPS.some((gap) => activity.includes(gap)),
    );
    assert.deepEqual(unexplained, [], "a new statement broke the conjugator");
  });

  it("conjugates a comma-separated verb series", () => {
    // "throws, catches, and kicks" must not survive as "throwing,
    // catches, and kicks".
    const offenders = activities.filter((activity) => /\b[a-z]+ing, [a-z]+s[,.]/.test(activity));
    assert.deepEqual(offenders, []);
  });

  it("leaves a plural noun after 'and' alone", () => {
    // "uses loops and events on purpose" joins two NOUNS. Conjugating
    // "events" would be worse than leaving it, and telling a coordinated
    // verb from a coordinated noun is judgment, not pattern matching
    // (AGENTS.md, models judge and code verifies). The immediate-only
    // rule is what keeps this safe.
    const offenders = activities.filter((activity) => /\beventing\b|\bsoundinging\b/.test(activity));
    assert.deepEqual(offenders, []);
  });
});
