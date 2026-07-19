import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  AGENT_JOB_SELECT,
  AGENT_JOB_STAGE_SELECT,
  jobMetaLine,
  jobPill,
  mapAgentJobViews,
  remainingStageRange,
  stageNoun,
  stageStatusLabel,
  type AgentJobRow,
  type AgentJobStageRow,
} from "./agent-job-view";

const PAGE_SOURCE = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

const JOB_ROW: AgentJobRow = {
  id: "job-1",
  skill: "curriculum-studio",
  title: "Theo's All About Reading plan",
  status: "awaiting_input",
  current_stage: 3,
  total_stages: 9,
  progress_note: "Volume 3 is ready.",
  created_at: "2026-07-14T13:00:00.000Z",
};

const STAGE_ROWS: AgentJobStageRow[] = [
  { job_id: "job-1", stage_number: 2, status: "approved", title: "Weeks 5-8" },
  { job_id: "job-1", stage_number: 1, status: "approved", title: "Weeks 1-4" },
  { job_id: "job-1", stage_number: 3, status: "ready_for_review", title: "Weeks 9-12" },
  // A different family's job never reaches this read (RLS), but a stray row
  // for another job id must not attach here.
  { job_id: "job-other", stage_number: 1, status: "pending", title: null },
];

describe("mapAgentJobViews", () => {
  it("joins stages to their own job, sorted, ignoring other jobs' rows", () => {
    const [view] = mapAgentJobViews([JOB_ROW], STAGE_ROWS);
    assert.equal(view.id, "job-1");
    assert.equal(view.title, "Theo's All About Reading plan");
    assert.equal(view.totalStages, 9);
    assert.deepEqual(
      view.stages.map((stage) => stage.stageNumber),
      [1, 2, 3],
    );
    assert.equal(view.startedAt, "2026-07-14T13:00:00.000Z");
  });

  it("derives the working position, never trusting a raw stage 0", () => {
    // A queued build the runner has not touched yet.
    const [fresh] = mapAgentJobViews(
      [{ ...JOB_ROW, status: "queued", current_stage: 0 }],
      [],
    );
    assert.equal(fresh.position, 1);

    // A ready-for-review stage wins over current_stage as the position.
    const [waiting] = mapAgentJobViews([{ ...JOB_ROW, current_stage: 2 }], STAGE_ROWS);
    assert.equal(waiting.position, 3);

    // Position is clamped inside the plan, never past the total.
    const [clamped] = mapAgentJobViews(
      [{ ...JOB_ROW, current_stage: 99, total_stages: 9 }],
      [],
    );
    assert.equal(clamped.position, 9);
  });
});

describe("presentation helpers", () => {
  it("names the stage unit per skill and falls back to plain words", () => {
    assert.deepEqual(stageNoun("curriculum-studio"), { singular: "Volume", plural: "Volumes" });
    assert.deepEqual(stageNoun("some-future-skill"), { singular: "Part", plural: "Parts" });
  });

  it("writes the card meta line in the family's own zone", () => {
    const [view] = mapAgentJobViews([JOB_ROW], STAGE_ROWS);
    assert.equal(jobMetaLine(view, "America/New_York"), "Volume 3 of 9 · started Jul 14");
  });

  it("only the awaiting-input pill draws the eye", () => {
    assert.deepEqual(jobPill("awaiting_input"), { tone: "attention", label: "Ready for you" });
    assert.deepEqual(jobPill("running"), { tone: "building", label: "Building" });
    assert.deepEqual(jobPill("queued"), { tone: "building", label: "Building" });
    assert.deepEqual(jobPill("paused"), { tone: "muted", label: "Paused" });
  });

  it("keeps every stage word calm, with no red or 'behind' framing", () => {
    assert.equal(stageStatusLabel("approved"), "Saved");
    assert.equal(stageStatusLabel("ready_for_review"), "Ready for you");
    assert.equal(stageStatusLabel("in_progress"), "Building");
    assert.equal(stageStatusLabel("pending"), "Up next");
    assert.equal(stageStatusLabel("failed"), "Needs another try");
    for (const status of [
      "approved",
      "ready_for_review",
      "in_progress",
      "pending",
      "skipped",
      "superseded",
      "failed",
    ] as const) {
      assert.doesNotMatch(stageStatusLabel(status), /behind|late|fail|error/i);
    }
  });

  it("summarizes only the not-yet-opened stages as one range", () => {
    const [view] = mapAgentJobViews([JOB_ROW], STAGE_ROWS);
    assert.deepEqual(remainingStageRange(view), { from: 4, to: 9 });

    // Every stage has a row: nothing left to summarize.
    const [full] = mapAgentJobViews(
      [{ ...JOB_ROW, total_stages: 3 }],
      STAGE_ROWS.filter((row) => row.job_id === "job-1"),
    );
    assert.equal(remainingStageRange(full), null);
  });
});

describe("the page reads under the caller's own RLS", () => {
  it("selects only bounded columns and scopes to active statuses", () => {
    assert.doesNotMatch(AGENT_JOB_SELECT, /session_id|plan|payload|requested_by/);
    assert.doesNotMatch(AGENT_JOB_STAGE_SELECT, /payload|family_id|cpu_seconds/);
    // The page must read jobs via the RLS Supabase client, never the
    // service-role store, and gate the whole read on the flag.
    assert.match(PAGE_SOURCE, /\.from\("agent_jobs"\)/);
    assert.match(PAGE_SOURCE, /\.select\(AGENT_JOB_SELECT\)/);
    assert.match(PAGE_SOURCE, /agentJobsEnabled\(\)/);
    assert.doesNotMatch(PAGE_SOURCE, /mapDb|service/i);
  });
});
