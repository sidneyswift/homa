import assert from "node:assert/strict";
import test from "node:test";
import { assessmentTopics } from "@homa/taxonomy";

import { abilityQuestion, abilityQuestionHref } from "./ability-question";
import { abilityQuestionDraft } from "./ability-question-draft";
import { findAbilitiesExplorerAbility } from "./abilities-explorer";

const child = {id: "11111111-1111-4111-8111-111111111111", name: "Maya"};
const id = assessmentTopics().find((item) => item.subject === "math")!.id;
const name = findAbilitiesExplorerAbility(id)!.name;

test("the visible question equals the authenticated server composer draft", () => {
  const url = new URL(abilityQuestionHref(child.id, id), "https://example.invalid");
  assert.deepEqual([...url.searchParams.keys()], ["draft", "child", "ability"]);
  assert.equal(abilityQuestionDraft({draft: url.searchParams.get("draft"), childId: url.searchParams.get("child"), abilityId: url.searchParams.get("ability"), children: [child]}), abilityQuestion(child.name, name));
  assert.equal(url.pathname, "/app"); assert.equal(url.searchParams.has("assessment"), false);
});

test("unknown child, deleted child, unknown ability and malformed query fail closed", () => {
  const base = {draft: "ability-question", childId: child.id, abilityId: id, children: [child]};
  for (const changed of [{childId: "foreign"}, {children: []}, {abilityId: "nonexistent"}, {abilityId: "x".repeat(241)}, {abilityId: [id]}, {childId: [child.id]}, {draft: "assessment"}]) {
    assert.equal(abilityQuestionDraft({...base, ...changed}), undefined);
  }
});

test("server re-resolves a renamed child and needs no unexpired hidden cookie to preserve scope", () => {
  const draft = abilityQuestionDraft({draft: "ability-question", childId: child.id, abilityId: id, children: [{...child, name: "Renamed child"}]});
  assert.equal(draft, abilityQuestion("Renamed child", name));
  assert.match(draft!, /What does the evidence show, and what is still unknown/);
});
