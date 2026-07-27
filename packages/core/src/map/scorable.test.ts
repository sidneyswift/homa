import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getMapItem, MAP_SUBJECTS, planQuestions } from "./bank";
import {
  getScorableItem,
  isTaxonomyScorable,
  taxonomyScorableItems,
} from "./scorable";
import { scoreMap } from "./scoring";

/**
 * One abilities catalog (founder ruling 2026-07-21). Bank items and
 * assessable taxonomy topics both carry a typical age, so both can move
 * a child's number. These tests pin the two halves of that promise:
 * taxonomy skills now count, and onboarding is untouched.
 */

describe("the unified abilities catalog", () => {
  it("still resolves every bank item", () => {
    const bankItem = MAP_SUBJECTS[0].items[0];
    const found = getScorableItem(bankItem.id);
    assert.equal(found?.item.id, bankItem.id);
    assert.equal(isTaxonomyScorable(bankItem.id), false);
  });

  it("now resolves taxonomy topics that used to score nothing", () => {
    const topics = taxonomyScorableItems();
    assert.ok(topics.length > 500, `expected a real catalog, got ${topics.length}`);
    const sample = topics[0];
    assert.equal(getScorableItem(sample.item.id)?.item.id, sample.item.id);
    assert.equal(isTaxonomyScorable(sample.item.id), true);
    // The old behaviour, kept visible: the bank alone never knew these.
    assert.equal(getMapItem(sample.item.id), undefined);
  });

  it("anchors a taxonomy topic at the START of its teaching window", () => {
    // Under-claim on purpose: credit the earliest age a curriculum
    // introduces the skill, never the latest.
    for (const { item } of taxonomyScorableItems().slice(0, 50)) {
      assert.ok(item.typicalRangeMonths, item.id);
      assert.equal(item.typicalMonths, item.typicalRangeMonths?.[0], item.id);
    }
  });

  it("leaves onboarding question selection alone", () => {
    // planQuestions reads MAP_SUBJECTS, the ASKABLE bank. Adding 1,384
    // topics there would change what every new family is asked, so the
    // unified catalog must never leak into it.
    const asked = planQuestions(60).flatMap((plan) => [
      plan.base.id,
      ...plan.ladders.map((item) => item.id),
    ]);
    for (const itemId of asked) {
      assert.equal(
        isTaxonomyScorable(itemId),
        false,
        `onboarding must not ask taxonomy topic ${itemId}`,
      );
    }
  });

  it("scores a taxonomy skill a child demonstrates above their age", () => {
    // The whole point: a 4-year-old doing something typically expected
    // later is now ahead, where before this counted as nothing.
    // Exposure-based subjects (Spanish, computer science) never carry a
    // number by design, so this has to be a measured subject.
    const late = taxonomyScorableItems().find(
      (entry) =>
        entry.item.typicalMonths >= 84 && !entry.subject.exposureBased,
    );
    assert.ok(late, "expected at least one later-window taxonomy topic");
    const ageMonths = 48;
    const scored = scoreMap(ageMonths, [
      { itemId: late.item.id, answer: "easily" },
    ]);
    const subject = scored.subjects.find(
      (entry) => entry.subjectId === late.subject.id,
    );
    assert.ok(subject, "the topic's subject should be scored");
    assert.notEqual(
      subject.position,
      "not_mapped",
      "a demonstrated taxonomy skill must reach the score",
    );
    assert.ok(
      (subject.monthsAhead ?? 0) > 0,
      `expected months ahead, got ${String(subject.monthsAhead)}`,
    );
  });
});
