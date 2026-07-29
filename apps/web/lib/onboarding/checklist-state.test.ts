import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { MAP_SUBJECTS, personalizeStatement, type MapAnswer } from "@homa/core";

import { growingEdgesFrom } from "./checklist-state";

/**
 * The reveal has to name the thing she said is not happening yet, and it
 * was doing that about half the time while the only thing code handed
 * the model was the child's strengths (walks 004 and 005, 2026-07-29).
 * These tests cover the lookup half. The warmth is the model's job and
 * belongs in an eval, not here.
 *
 * Item ids come out of the live bank rather than being transcribed, so
 * a bank edit cannot leave this file asserting against questions that
 * no longer exist.
 */

/** Real items from distinct subjects, in the bank's own order. */
function itemsFromDistinctSubjects(count: number) {
  return MAP_SUBJECTS.filter((subject) => subject.items.length > 0)
    .slice(0, count)
    .map((subject) => ({ subject, item: subject.items[0] }));
}

function answer(questionId: string, value: MapAnswer) {
  return { question_id: questionId, answer: value };
}

describe("growingEdgesFrom", () => {
  it("returns only what she answered not yet", () => {
    const [first, second, third] = itemsFromDistinctSubjects(3);
    const edges = growingEdgesFrom("Ellie", [
      answer(first.item.id, "not_yet"),
      answer(second.item.id, "easily"),
      answer(third.item.id, "getting_there"),
    ]);
    assert.equal(edges.length, 1);
    assert.equal(edges[0].itemId, first.item.id);
    assert.equal(edges[0].subject, first.subject.displayName);
  });

  it("treats getting there, not sure and skip as answers rather than worries", () => {
    // "Getting there" is a middle answer, "not sure" is an unknown, and
    // a skip is not an answer at all. Framing any of them as a concern
    // is the behind-framing this house does not do.
    const items = itemsFromDistinctSubjects(3);
    const edges = growingEdgesFrom("Ellie", [
      answer(items[0].item.id, "getting_there"),
      answer(items[1].item.id, "not_sure"),
      answer(items[2].item.id, "skip"),
    ]);
    assert.deepEqual(edges, []);
  });

  it("is empty when she said not yet about nothing, so the reveal invents nothing", () => {
    const [only] = itemsFromDistinctSubjects(1);
    assert.deepEqual(growingEdgesFrom("Ellie", [answer(only.item.id, "easily")]), []);
    assert.deepEqual(growingEdgesFrom("Ellie", []), []);
  });

  it("carries her question in the exact words she read, so the claim is traceable", () => {
    const [first] = itemsFromDistinctSubjects(1);
    const edges = growingEdgesFrom("Ellie", [answer(first.item.id, "not_yet")]);
    assert.equal(edges[0].statement, personalizeStatement("Ellie", first.item));
    assert.match(edges[0].statement, /Ellie/);
  });

  it("caps at three, because the beat names one and a list reads as a verdict", () => {
    const items = itemsFromDistinctSubjects(5);
    assert.ok(items.length >= 4, "bank needs four subjects for this test to mean anything");
    const edges = growingEdgesFrom(
      "Ellie",
      items.map((entry) => answer(entry.item.id, "not_yet")),
    );
    assert.equal(edges.length, 3);
  });

  it("orders by the bank's own subject order rather than by however the rows arrived", () => {
    const items = itemsFromDistinctSubjects(3);
    const reversed = [...items].reverse();
    const edges = growingEdgesFrom(
      "Ellie",
      reversed.map((entry) => answer(entry.item.id, "not_yet")),
    );
    assert.deepEqual(
      edges.map((edge) => edge.itemId),
      items.map((entry) => entry.item.id),
    );
  });

  it("drops an answer whose question is no longer in the bank instead of throwing", () => {
    // A retired item still has stored answers against it. Losing one
    // edge is fine; failing to score her report is not.
    const [real] = itemsFromDistinctSubjects(1);
    const edges = growingEdgesFrom("Ellie", [
      answer("literacy.this-item-was-retired", "not_yet"),
      answer(real.item.id, "not_yet"),
    ]);
    assert.equal(edges.length, 1);
    assert.equal(edges[0].itemId, real.item.id);
  });
});
