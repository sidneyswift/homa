import assert from "node:assert/strict";
import test from "node:test";

import { stageContinuationToken } from "./session";

const stage = { jobId: "job-1", stageNumber: 1 };

// A retry that resumed the failed attempt's conversation repeated its
// question every time; each attempt has to start clean.
test("each attempt at a stage gets its own conversation", () => {
  const first = stageContinuationToken({ ...stage, episodeId: "episode-a" });
  const retry = stageContinuationToken({ ...stage, episodeId: "episode-b" });
  assert.notEqual(first, retry);
});

test("one attempt keeps one conversation", () => {
  assert.equal(
    stageContinuationToken({ ...stage, episodeId: "episode-a" }),
    stageContinuationToken({ ...stage, episodeId: "episode-a" }),
  );
});

test("different stages never share a conversation", () => {
  assert.notEqual(
    stageContinuationToken({ jobId: "job-1", stageNumber: 1, episodeId: "e" }),
    stageContinuationToken({ jobId: "job-1", stageNumber: 2, episodeId: "e" }),
  );
});
