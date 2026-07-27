import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isTaxonomyScorable } from "@homa/core";
import { allPrerequisiteEdges, getTopic } from "@homa/taxonomy";

import { deriveAbilityMap } from "./abilities";

/**
 * The abilities map's derivation semantics (founder direction
 * 2026-07-22). The load-bearing promises: explicit answers always own
 * their node, "easily" lights hard prerequisites as implied, an
 * explicit answer beats an implied confirmation, and ready-next never
 * nags about something the parent already answered.
 *
 * Graph-dependent cases find a real hard edge dynamically instead of
 * hardcoding topic ids, so taxonomy content churn cannot silently
 * hollow the test out.
 */

const AT = "2026-07-22T13:00:00.000Z";

/** A real hard prerequisite edge whose both ends are scorable. */
function findHardEdge(): { topicId: string; prerequisiteId: string } {
  for (const edge of allPrerequisiteEdges()) {
    if (edge.strength !== "hard") continue;
    if (!getTopic(edge.topicId) || !getTopic(edge.prerequisiteId)) continue;
    if (
      isTaxonomyScorable(edge.topicId) &&
      isTaxonomyScorable(edge.prerequisiteId)
    ) {
      return { topicId: edge.topicId, prerequisiteId: edge.prerequisiteId };
    }
  }
  throw new Error("no scorable hard edge in the taxonomy; test needs one");
}

describe("deriveAbilityMap", () => {
  it("maps reported answers to their states", () => {
    const map = deriveAbilityMap(
      [
        { itemId: "math.how-many-5", answer: "easily", observedAt: AT },
        { itemId: "math.small-groups", answer: "getting_there", observedAt: AT },
        { itemId: "math.counts-to-10", answer: "not_yet", observedAt: AT },
      ],
      52,
    );
    const math = map.find((subject) => subject.subjectId === "math");
    assert.ok(math);
    assert.equal(math.mastered, 1);
    assert.equal(math.emerging, 1);
    assert.equal(math.notYet, 1);
    const states = new Map(
      math.nodes.map((node) => [node.itemId, node.state]),
    );
    assert.equal(states.get("math.how-many-5"), "mastered");
    assert.equal(states.get("math.small-groups"), "emerging");
    assert.equal(states.get("math.counts-to-10"), "not_yet");
  });

  it("lights hard prerequisites of a mastered topic as implied", () => {
    const edge = findHardEdge();
    const map = deriveAbilityMap(
      [{ itemId: edge.topicId, answer: "easily", observedAt: AT }],
      90,
    );
    const nodes = map.flatMap((subject) => subject.nodes);
    const implied = nodes.find((node) => node.itemId === edge.prerequisiteId);
    assert.ok(implied, "the hard prerequisite should appear on the map");
    assert.equal(implied.state, "implied");
    assert.equal(implied.observedAt, null);
  });

  it("lets an explicit answer beat an implied confirmation", () => {
    // The walk's law, kept: the parent said not yet, so no amount of
    // graph implication may overrule her.
    const edge = findHardEdge();
    const map = deriveAbilityMap(
      [
        { itemId: edge.topicId, answer: "easily", observedAt: AT },
        { itemId: edge.prerequisiteId, answer: "not_yet", observedAt: AT },
      ],
      90,
    );
    const nodes = map.flatMap((subject) => subject.nodes);
    const prerequisite = nodes.find(
      (node) => node.itemId === edge.prerequisiteId,
    );
    assert.ok(prerequisite);
    assert.equal(prerequisite.state, "not_yet");
  });

  it("never offers an explicitly answered topic as ready-next", () => {
    const edge = findHardEdge();
    const map = deriveAbilityMap(
      [
        { itemId: edge.prerequisiteId, answer: "easily", observedAt: AT },
        // The unlocked topic is already honestly on the map as not_yet;
        // offering it again as "ready" would nag.
        { itemId: edge.topicId, answer: "not_yet", observedAt: AT },
      ],
      90,
    );
    for (const subject of map) {
      assert.ok(
        subject.readyNext.every((ready) => ready.itemId !== edge.topicId),
        "an explicitly answered topic must not reappear as ready",
      );
    }
  });

  it("caps ready-next and keeps it nearest the child's age", () => {
    const map = deriveAbilityMap(
      [{ itemId: "math.how-many-5", answer: "easily", observedAt: AT }],
      52,
    );
    for (const subject of map) {
      assert.ok(subject.readyNext.length <= 5);
      for (let index = 1; index < subject.readyNext.length; index += 1) {
        assert.ok(
          Math.abs(subject.readyNext[index - 1].typicalMonths - 52) <=
            Math.abs(subject.readyNext[index].typicalMonths - 52),
          "ready-next must be sorted by age proximity",
        );
      }
    }
  });

  it("omits subjects with nothing lit", () => {
    const map = deriveAbilityMap(
      [{ itemId: "math.how-many-5", answer: "easily", observedAt: AT }],
      52,
    );
    assert.ok(map.every((subject) => subject.nodes.length > 0));
    assert.ok(!map.some((subject) => subject.subjectId === "music"));
  });

  it("returns an empty map for no evidence", () => {
    assert.deepEqual(deriveAbilityMap([], 52), []);
  });
});
