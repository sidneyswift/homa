import assert from "node:assert/strict";
import test from "node:test";

import { agentJobsKickUrl } from "./kick";

// The kick must target THIS deployment: a preview kicking prod would
// run prod's code against rows prod may not understand yet.
test("a Vercel deployment kicks its own deployment URL", () => {
  assert.equal(
    agentJobsKickUrl({
      VERCEL_URL: "homa-abc123.vercel.app",
      NEXT_PUBLIC_SITE_URL: "https://thankshoma.com",
      NODE_ENV: "production",
    }),
    "https://homa-abc123.vercel.app/eve/v1/agent-job/run-now",
  );
});

test("the site URL is the fallback, trailing slash tolerated", () => {
  assert.equal(
    agentJobsKickUrl({
      NEXT_PUBLIC_SITE_URL: "https://thankshoma.com/",
      NODE_ENV: "production",
    }),
    "https://thankshoma.com/eve/v1/agent-job/run-now",
  );
});

test("dev kicks localhost on the running port", () => {
  assert.equal(
    agentJobsKickUrl({ NODE_ENV: "development", PORT: "3009" }),
    "http://localhost:3009/eve/v1/agent-job/run-now",
  );
  assert.equal(
    agentJobsKickUrl({ NODE_ENV: "development" }),
    "http://localhost:3000/eve/v1/agent-job/run-now",
  );
});

test("production with no origin kicks nowhere; the sweeper carries it", () => {
  assert.equal(agentJobsKickUrl({ NODE_ENV: "production" }), null);
});
