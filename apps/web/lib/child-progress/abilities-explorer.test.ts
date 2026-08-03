import assert from "node:assert/strict";
import test from "node:test";

import { assessmentTopics } from "@homa/taxonomy";
import type { MapScores } from "@homa/core";

import { buildAbilitiesExplorerPayload } from "./abilities-explorer";
import type { ChildProgressView, ProgressTopicView } from "./types";

const NOW = new Date("2026-08-03T12:00:00.000Z");

function topic(
  itemId: string,
  answer: null,
  state: "ask_next" | "conflict",
): ProgressTopicView;
function topic(
  itemId: string,
  answer: Exclude<ProgressTopicView["answer"], null>,
  state: "observed_today" | "older",
): ProgressTopicView;
function topic(
  itemId: string,
  answer: ProgressTopicView["answer"],
  state: ProgressTopicView["state"],
): ProgressTopicView {
  if (answer === null) {
    if (state === "conflict") {
      return {
        itemId,
        statement: itemId,
        state: "conflict",
        answer: null,
        source: null,
        observedAt: NOW.toISOString(),
        detail: "No direct parent answer yet.",
      };
    }
    return {
      itemId,
      statement: itemId,
      state: "ask_next",
      answer: null,
      source: null,
      observedAt: null,
      detail: "No direct parent answer yet.",
    };
  }
  const answeredState = state === "older" ? "older" : "observed_today";
  return {
    itemId,
    statement: itemId,
    state: answeredState,
    answer,
    source: {
      kind: "check_in",
      adultDisplayName: null,
      checkInId: null,
      derivation: "direct",
    },
    observedAt: NOW.toISOString(),
    detail: "Recorded in a check-in.",
  };
}

function viewWithTopics(topics: ProgressTopicView[]): ChildProgressView {
  return {
    childId: "11111111-1111-4111-8111-111111111111",
    childName: "Maya",
    birthDate: "2018-08-03",
    timeZone: "America/New_York",
    projectedAt: NOW.toISOString(),
    scores: {} as MapScores,
    subjects: [
      {
        subjectId: "math",
        displayName: "Math",
        evidenceCount: topics.length,
        latestObservedAt: NOW.toISOString(),
        state: "updated_recently",
        summary: null,
        domains: [
          {
            domainId: "number-place-value",
            displayName: "Number & place value",
            topics,
          },
        ],
      },
    ],
    conflicts: [],
  };
}

test("builds the full deterministic subject graph with one shared age axis", () => {
  const firstMath = assessmentTopics().find((entry) => entry.subject === "math");
  assert.ok(firstMath);
  const firstScience = assessmentTopics().find((entry) => entry.subject === "science");
  assert.ok(firstScience);

  const one = buildAbilitiesExplorerPayload(
    viewWithTopics([topic(firstMath.id, "easily", "observed_today")]),
    NOW,
  );
  const two = buildAbilitiesExplorerPayload(
    viewWithTopics([topic(firstMath.id, "easily", "observed_today")]),
    NOW,
  );

  assert.deepEqual(one, two);
  assert.deepEqual(one.subjects.map((subject) => subject.id), [
    "math",
    "literacy",
    "science",
  ]);
  assert.ok(one.subjects.every((subject) => subject.nodes.length > 0));
  assert.ok(one.subjects.every((subject) => subject.edges.length > 0));
  assert.deepEqual(one.axisMonths, [48, 168]);
  assert.deepEqual(one.ageRangeMonths, [96, 108]);
  assert.ok(one.subjects.some((subject) =>
    subject.nodes.some((node) => node.id === firstScience.id),
  ));
});

test("maps direct parent answers into the three plain display states", () => {
  const topics = assessmentTopics().filter((entry) => entry.subject === "math").slice(0, 3);
  assert.equal(topics.length, 3);
  const payload = buildAbilitiesExplorerPayload(
    viewWithTopics([
      topic(topics[0].id, "easily", "observed_today"),
      topic(topics[1].id, "getting_there", "older"),
      topic(topics[2].id, "not_yet", "older"),
    ]),
    NOW,
  );
  const nodes = new Map(payload.subjects[0].nodes.map((node) => [node.id, node]));

  assert.equal(nodes.get(topics[0].id)?.state, "knows");
  assert.equal(nodes.get(topics[1].id)?.state, "working_on_now");
  assert.equal(nodes.get(topics[2].id)?.state, "up_next");
  assert.equal(nodes.get(topics[0].id)?.evidence.answer, "easily");
  assert.equal(nodes.get(topics[2].id)?.evidence.answer, "not_yet");
});

test("keeps an unanswered catalog node visible without implying failure", () => {
  const firstMath = assessmentTopics().find((entry) => entry.subject === "math");
  assert.ok(firstMath);
  const payload = buildAbilitiesExplorerPayload(
    viewWithTopics([topic(firstMath.id, null, "ask_next")]),
    NOW,
  );
  const node = payload.subjects[0].nodes.find((entry) => entry.id === firstMath.id);
  assert.ok(node);
  assert.equal(node.state, "up_next");
  assert.equal(node.evidence.answer, null);
  assert.equal(node.evidence.conflict, false);
});
