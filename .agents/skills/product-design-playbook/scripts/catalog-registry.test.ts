import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  PLAY_PAIRS,
  PLAY_SOURCE_PATHS,
  STRATEGY_PLAY_IDS,
  STRATEGY_SOURCE_PATHS,
  deriveCandidatePlayIds,
  validateCandidateProvenance,
} from "./catalog-registry.ts";
import {
  PLAY_IDS,
  STRATEGY_IDS,
  type PlayAssessment,
} from "./score-contract.ts";

const repositoryRoot = resolve(import.meta.dirname, "../../../..");

test("registry source paths resolve to the canonical archive", () => {
  for (const strategyId of STRATEGY_IDS) {
    assert.equal(
      existsSync(resolve(repositoryRoot, STRATEGY_SOURCE_PATHS[strategyId])),
      true,
      strategyId,
    );
  }
  for (const playId of PLAY_IDS) {
    assert.equal(
      existsSync(resolve(repositoryRoot, PLAY_SOURCE_PATHS[playId])),
      true,
      playId,
    );
  }
});

test("strategy stacks and pair edges contain only registered plays", () => {
  const playIds = new Set(PLAY_IDS);
  for (const strategyId of STRATEGY_IDS) {
    assert.ok(STRATEGY_PLAY_IDS[strategyId].length > 0);
    for (const playId of STRATEGY_PLAY_IDS[strategyId]) {
      assert.equal(playIds.has(playId), true);
    }
  }
  for (const playId of PLAY_IDS) {
    for (const pairedPlayId of PLAY_PAIRS[playId]) {
      assert.equal(playIds.has(pairedPlayId), true);
    }
  }
});

test("candidate derivation takes the exact union of selected strategies", () => {
  const candidates = deriveCandidatePlayIds(["activation"]);

  assert.deepEqual(candidates, [
    "contact-bridge",
    "discovery",
    "empty-states",
    "jtbd-copywriting",
    "loading-feedback",
    "micro-interactions",
    "momentum-bias",
    "personalisation",
    "progressive-disclosure",
    "sandbox-experience",
    "setup-defaults",
    "success-moments",
    "time-to-value",
  ]);
});

test("provenance accepts strategy membership and one-hop registered pairs", () => {
  const activationCandidates = deriveCandidatePlayIds(["activation"]);
  const plays: PlayAssessment[] = activationCandidates.map((playId) => ({
    playId,
    applicability: "not_applicable",
    rationale: "Candidate under test.",
    provenanceRoutes: ["strategy:activation"],
    rating: null,
    harm: false,
    harmExplanation: null,
    sourceRefs: [PLAY_SOURCE_PATHS[playId]],
    implementationRefs: [],
    evidenceRefs: [],
  }));
  plays.push({
    playId: "fail-safe",
    applicability: "not_applicable",
    rationale: "One-hop companion under test.",
    provenanceRoutes: ["pair:jtbd-copywriting>fail-safe"],
    rating: null,
    harm: false,
    harmExplanation: null,
    sourceRefs: [PLAY_SOURCE_PATHS["fail-safe"]],
    implementationRefs: [],
    evidenceRefs: [],
  });

  assert.doesNotThrow(() =>
    validateCandidateProvenance(["activation"], plays),
  );
});

test("provenance rejects invented routes and recursive pair chains", () => {
  const invalidRoute: PlayAssessment = {
    playId: "fail-safe",
    applicability: "not_applicable",
    rationale: "Invalid route under test.",
    provenanceRoutes: ["pair:time-to-value>fail-safe"],
    rating: null,
    harm: false,
    harmExplanation: null,
    sourceRefs: [PLAY_SOURCE_PATHS["fail-safe"]],
    implementationRefs: [],
    evidenceRefs: [],
  };
  const recursiveRoute = {
    ...invalidRoute,
    provenanceRoutes: [
      "pair:jtbd-copywriting>micro-interactions>fail-safe",
    ],
  };

  assert.throws(
    () => validateCandidateProvenance(["activation"], [invalidRoute]),
    /provenance/,
  );
  assert.throws(
    () => validateCandidateProvenance(["activation"], [recursiveRoute]),
    /one-hop/,
  );
});

test("one valid provenance route cannot hide an invented route", () => {
  const activationCandidates = deriveCandidatePlayIds(["activation"]);
  const plays: PlayAssessment[] = activationCandidates.map((playId) => ({
    playId,
    applicability: "not_applicable",
    rationale: "Candidate under test.",
    provenanceRoutes:
      playId === "contact-bridge"
        ? ["strategy:activation", "strategy:monetisation"]
        : ["strategy:activation"],
    rating: null,
    harm: false,
    harmExplanation: null,
    sourceRefs: [PLAY_SOURCE_PATHS[playId]],
    implementationRefs: [],
    evidenceRefs: [],
  }));

  assert.throws(
    () => validateCandidateProvenance(["activation"], plays),
    /provenance/,
  );
});

test("shared plays require every selected strategy provenance route", () => {
  const strategyIds = ["onboarding", "activation"] as const;
  const candidateIds = deriveCandidatePlayIds(strategyIds);
  const plays: PlayAssessment[] = candidateIds.map((playId) => ({
    playId,
    applicability: "not_applicable",
    rationale: "Candidate under test.",
    provenanceRoutes: strategyIds
      .filter((strategyId) =>
        STRATEGY_PLAY_IDS[strategyId].includes(playId),
      )
      .map((strategyId) => `strategy:${strategyId}`),
    rating: null,
    harm: false,
    harmExplanation: null,
    sourceRefs: [PLAY_SOURCE_PATHS[playId]],
    implementationRefs: [],
    evidenceRefs: [],
  }));
  const timeToValue = plays.find(
    (play) => play.playId === "time-to-value",
  );
  assert.ok(timeToValue);
  timeToValue.provenanceRoutes = ["strategy:onboarding"];

  assert.throws(
    () => validateCandidateProvenance(strategyIds, plays),
    /missing strategy provenance/,
  );
});
