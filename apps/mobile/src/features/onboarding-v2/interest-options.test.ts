import assert from "node:assert/strict";
import test from "node:test";
import { MAP_INTERESTS_CAP } from "@homa/core";

import { INTEREST_OPTIONS, customInterestName, normalizeInterests, searchInterests, suggestedInterests, toggleInterest, withChildInterests } from "./interest-options";

test("age boundaries change starter ideas without restricting the full catalog", () => {
  for (const [before, after] of [[35, 36], [71, 72], [107, 108], [155, 156]]) {
    assert.notDeepEqual(suggestedInterests(before!), suggestedInterests(after!));
  }
  assert.ok(suggestedInterests(24).includes("Water play"));
  assert.ok(suggestedInterests(48).includes("Pretend play"));
  assert.ok(suggestedInterests(84).includes("Superheroes"));
  assert.ok(suggestedInterests(120).includes("Robotics"));
  assert.ok(suggestedInterests(180).includes("Photography"));
  assert.ok(suggestedInterests(48).includes("PAW Patrol"));
  assert.ok(suggestedInterests(48).includes("Toy Story"));
  assert.ok(suggestedInterests(84).includes("Pokémon"));
  assert.ok(suggestedInterests(120).includes("Roblox"));
  assert.ok(!suggestedInterests(48).includes("Roblox"));
  assert.deepEqual(searchInterests("pokemon", 48, []), ["Pokémon"]);
  assert.equal(customInterestName("pokemon", []), null);
  assert.deepEqual(toggleInterest([], "pokemon"), ["Pokémon"]);
  for (const age of [24, 48, 84, 120, 180]) {
    assert.deepEqual(new Set(searchInterests("", age, [], true)), new Set(INTEREST_OPTIONS));
    assert.deepEqual(searchInterests("coding", age, []), ["Coding"]);
  }
});

test("unknown or invalid ages get a neutral set of starter ideas", () => {
  for (const age of [null, -1, NaN, Infinity]) assert.deepEqual(suggestedInterests(age), suggestedInterests(null));
  assert.equal(new Set(INTEREST_OPTIONS).size, INTEREST_OPTIONS.length);
  assert.ok(INTEREST_OPTIONS.every((name) => name.length > 0 && name.length <= 40));
});

test("parents can select multiple interests, remove one, and search custom choices", () => {
  let selected = toggleInterest([], "dinosaurs");
  selected = toggleInterest(selected, "Music");
  selected = toggleInterest(selected, " Rock   collecting ");
  assert.deepEqual(selected, ["Dinosaurs", "Music", "Rock collecting"]);
  assert.deepEqual(toggleInterest(selected, "DINOSAURS"), ["Music", "Rock collecting"]);
  assert.deepEqual(searchInterests(" rock ", 48, selected), ["Rock collecting"]);
  assert.ok(searchInterests("", 48, selected).includes("Rock collecting"));
  assert.deepEqual(searchInterests("", 48, selected).slice(0, 3), selected);
  assert.equal(customInterestName(" music ", []), null);
  assert.equal(customInterestName("rock collecting", selected), null);
  assert.equal(customInterestName(" Rock   collecting ", []), "Rock collecting");
});

test("interests obey the planner's limit and name validation", () => {
  const full = [...INTEREST_OPTIONS].slice(0, MAP_INTERESTS_CAP);
  assert.deepEqual(toggleInterest(full, "Woodworking"), full);
  assert.equal(toggleInterest(full, full[0]!).length, MAP_INTERESTS_CAP - 1);
  assert.deepEqual(normalizeInterests(["", "  ", "a".repeat(41), "music", " Music "]), ["Music"]);
  assert.equal(customInterestName("a".repeat(41), []), null);
  assert.equal(customInterestName(" ", []), null);
  assert.equal(normalizeInterests(INTEREST_OPTIONS).length, MAP_INTERESTS_CAP);
});

test("saving and skipping interests only affect the selected child", () => {
  const kids = [{ id: "one", name: "Maya", interests: ["Dinosaurs"] }, { id: "two", name: "Alex", interests: ["Coding"] }];
  const updated = withChildInterests(kids, "one", ["Music"]);
  assert.deepEqual(updated[0]?.interests, ["Music"]);
  assert.equal(updated[1], kids[1]);
  assert.deepEqual(kids[0]?.interests, ["Dinosaurs"]);
  assert.equal(updated[0]?.name, "Maya");
  const skipped = withChildInterests(updated, "one", []);
  assert.deepEqual(skipped[0]?.interests, []);
  assert.deepEqual(skipped[1]?.interests, ["Coding"]);
  assert.equal(withChildInterests(kids, "missing", ["Music"]), kids);
});
