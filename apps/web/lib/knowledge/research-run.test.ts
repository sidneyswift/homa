import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { DemandCell } from "./demand";
import type { PriorResearchDossier } from "./research-dedup";
import {
  buildResearchMessage,
  buildResearchSessionInput,
  parseManualResearchRequest,
  researchCellKey,
  startResearchCell,
  topicTypeForLens,
} from "./research-run";

const CELL: DemandCell = {
  lens: "curriculum",
  topicKey: "dimensions-math",
  stage: null,
  topicType: "other",
  demand: 2,
  hasRows: true,
};

const PRIOR: PriorResearchDossier = {
  topicKey: "dimensions-math",
  rows: [
    {
      title: "Dimensions Math editions",
      summary: "The US edition separates teaching notes from student books.",
      citations: [
        {
          url: "https://example.com/dimensions-math-editions?utm_source=old",
          claim: "The US edition separates teaching notes from student books.",
        },
      ],
    },
  ],
};

describe("research cell identity", () => {
  it("uses one stable key for scheduled and manual runs", () => {
    assert.equal(
      researchCellKey(CELL),
      "curriculum:all:dimensions-math",
    );
  });

  it("derives the legacy topic type from the lens", () => {
    assert.equal(topicTypeForLens("develops_when"), "subject");
    assert.equal(topicTypeForLens("current_study"), "study");
    assert.equal(topicTypeForLens("method"), "method_philosophy");
    assert.equal(topicTypeForLens("curriculum"), "other");
  });
});

describe("buildResearchMessage", () => {
  it("gives the researcher prior pages and findings to avoid", () => {
    const message = buildResearchMessage(CELL, PRIOR);

    assert.match(message, /PRIOR RESEARCH FOR dimensions-math/u);
    assert.match(
      message,
      /https:\/\/example\.com\/dimensions-math-editions/u,
    );
    assert.match(message, /Same website, different specific page is allowed/u);
    assert.match(message, /Do not cite, fetch, or save any page listed below/u);
    assert.match(message, /genuine delta/u);
  });
});

describe("buildResearchSessionInput", () => {
  it("pins one fresh session to one run", () => {
    const input = buildResearchSessionInput(CELL, "run-1", PRIOR);

    assert.deepEqual(input.target, { runId: "run-1" });
    assert.equal(input.auth.principalId, "research:run-1");
    assert.deepEqual(input.auth.attributes, {
      channel: "research",
      taskRunId: "run-1",
    });
  });
});

describe("parseManualResearchRequest", () => {
  it("defaults an empty request to one due queue cell", () => {
    assert.deepEqual(parseManualResearchRequest({}), {
      kind: "queue",
      count: 1,
    });
  });

  it("normalizes explicit cells and derives their legacy topic types", () => {
    assert.deepEqual(
      parseManualResearchRequest({
        cells: [
          {
            lens: "how_to_teach",
            topicKey: "multiplication-division",
            stage: "early_elem",
          },
        ],
      }),
      {
        kind: "cells",
        cells: [
          {
            lens: "how_to_teach",
            topicKey: "multiplication-division",
            stage: "early_elem",
            topicType: "subject",
            demand: 1,
            hasRows: true,
          },
        ],
      },
    );
  });

  it("rejects count and explicit cells in the same request", () => {
    assert.throws(
      () => parseManualResearchRequest({ count: 2, cells: [CELL] }),
      /either count or cells/u,
    );
  });
});

describe("startResearchCell", () => {
  it("skips a cell already running without starting another session", async () => {
    let sessionsStarted = 0;
    const result = await startResearchCell(CELL, "manual", {
      beginRun: async () => null,
      loadPrior: async () => PRIOR,
      startSession: async () => {
        sessionsStarted += 1;
        return { id: "session-1" };
      },
      markSession: async () => undefined,
      failRun: async () => undefined,
    });

    assert.deepEqual(result, {
      started: false,
      cellKey: "curriculum:all:dimensions-math",
      reason: "already_running",
    });
    assert.equal(sessionsStarted, 0);
  });

  it("starts one durable session with its prior-research dossier", async () => {
    let startedMessage = "";
    const result = await startResearchCell(CELL, "lab", {
      beginRun: async (_title, options) => {
        assert.equal(options.cellKey, "curriculum:all:dimensions-math");
        assert.equal(options.trigger, "lab");
        return "run-1";
      },
      loadPrior: async () => PRIOR,
      startSession: async (input) => {
        startedMessage = input.message;
        return { id: "session-1" };
      },
      markSession: async (runId, sessionId) => {
        assert.equal(runId, "run-1");
        assert.equal(sessionId, "session-1");
      },
      failRun: async () => undefined,
    });

    assert.deepEqual(result, {
      started: true,
      runId: "run-1",
      sessionId: "session-1",
      cellKey: "curriculum:all:dimensions-math",
    });
    assert.match(startedMessage, /dimensions-math-editions/u);
  });
});
