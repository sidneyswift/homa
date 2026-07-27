import assert from "node:assert/strict";
import { test } from "node:test";

import { z } from "zod";

import {
  defineBoundedTool,
  TOOL_DEADLINE,
  ToolDeadlineError,
  withToolDeadline,
} from "./agent-tool-deadline";

test("a tool that answers in time returns its value untouched", async () => {
  const result = await withToolDeadline(1000, async () => ({ materials: ["a"] }));
  assert.deepEqual(result, { materials: ["a"] });
});

test("a synchronous tool body is supported", async () => {
  assert.equal(await withToolDeadline(1000, () => 7), 7);
});

test("a tool that never settles fails at its deadline instead of hanging", async () => {
  const started = Date.now();
  await assert.rejects(
    withToolDeadline(40, () => new Promise(() => {})),
    (error: unknown) => {
      assert.ok(error instanceof ToolDeadlineError);
      assert.equal(error.deadlineMs, 40);
      return true;
    },
  );
  assert.ok(Date.now() - started < 2000, "gave up promptly");
});

test("the failure message reports an unknown outcome, not a failed one", async () => {
  const error = new ToolDeadlineError(45_000, true);
  // The tool-honesty law. A deadline proves only that we stopped waiting:
  // a write may have landed with just the reply lost. Claiming success is
  // a lie; claiming failure is also a lie, and an empty-but-successful
  // shape would be the worst of the three, because an empty find_materials
  // reads as "the library is empty" and sends her off to rebuild.
  assert.match(error.message, /did not answer within 45s/);
  assert.match(error.message, /unknown/i);
  assert.match(error.message, /do not tell the parent it is done/i);
  assert.match(error.message, /do not assume it failed/i);
});

test("retry advice comes from the tool's flag, never from the model's guess", async () => {
  // Retrying a read is free. Retrying send_heads_up or an SMS invite
  // double-texts a real parent, and not every outbound tool has its own
  // dedupe window. So the caller declares it and the message states it as
  // a fact; an earlier draft said "try once more if the work is cheap to
  // repeat", which is an invitation to send that second text.
  const safe = new ToolDeadlineError(45_000, true).message;
  assert.match(safe, /safe to repeat: call it again/i);
  assert.ok(!/do not call it again/i.test(safe));

  const unsafe = new ToolDeadlineError(90_000, false).message;
  assert.match(unsafe, /NOT safe to repeat/);
  assert.match(unsafe, /do not call it again/i);
  assert.match(unsafe, /could not confirm this step/i);
});

test("withToolDeadline defaults to not repeatable", async () => {
  // The safe default for every non-tool caller. Being wrongly cautious
  // costs an honest "I could not confirm"; being wrongly permissive costs
  // a parent the same text twice.
  await assert.rejects(
    withToolDeadline(20, () => new Promise(() => {})),
    (error: unknown) => {
      assert.ok(error instanceof ToolDeadlineError);
      assert.equal(error.repeatable, false);
      assert.match(error.message, /NOT safe to repeat/);
      return true;
    },
  );
});

test("a repeatable tool's deadline carries the flag through", async () => {
  await assert.rejects(
    withToolDeadline(20, () => new Promise(() => {}), true),
    (error: unknown) => {
      assert.ok(error instanceof ToolDeadlineError);
      assert.equal(error.repeatable, true);
      return true;
    },
  );
});

test("a tool's own failure is passed through, not relabelled as a deadline", async () => {
  await assert.rejects(
    withToolDeadline(1000, async () => {
      throw new Error("no material with that id in this family");
    }),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.ok(!(error instanceof ToolDeadlineError));
      assert.equal(error.message, "no material with that id in this family");
      return true;
    },
  );
});

test("a rejection arriving after the deadline cannot crash the process", async () => {
  // The 07-19 shape: the socket finally errors long after we gave up.
  // Nothing awaits that promise any more, so without an attached catch
  // it lands as an unhandled rejection and takes the process with it.
  const unhandled: unknown[] = [];
  const onUnhandled = (reason: unknown) => unhandled.push(reason);
  process.on("unhandledRejection", onUnhandled);
  try {
    await assert.rejects(
      withToolDeadline(
        20,
        () =>
          new Promise((_resolve, reject) => {
            setTimeout(() => reject(new Error("socket hang up")), 60);
          }),
      ),
      ToolDeadlineError,
    );
    await new Promise((resolve) => setTimeout(resolve, 150));
    assert.deepEqual(unhandled, []);
  } finally {
    process.off("unhandledRejection", onUnhandled);
  }
});

test("the deadline timer never holds a turn open after the tool answers", async () => {
  // A leaked setTimeout keeps the event loop alive; on a serverless
  // invocation that is billed wall-clock. Node's test runner fails on a
  // dangling handle, so completing well before a long deadline is the
  // assertion.
  const started = Date.now();
  await withToolDeadline(TOOL_DEADLINE.generate, async () => "done");
  assert.ok(Date.now() - started < 1000);
});

test("deadline tiers stay ordered and clear the slowest run each covers", async () => {
  // Slowest completed call per tier in public.agent_tool_calls, 2026-07-23.
  const slowestObservedMs = {
    quick: 13_880,
    fetch: 41_430,
    render: 105_240,
    generate: 128_870,
  };
  for (const [tier, observed] of Object.entries(slowestObservedMs)) {
    const ceiling = TOOL_DEADLINE[tier as keyof typeof TOOL_DEADLINE];
    assert.ok(
      ceiling > observed * 1.5,
      `${tier} ceiling ${ceiling}ms leaves too little room over ${observed}ms`,
    );
  }
  assert.ok(TOOL_DEADLINE.quick < TOOL_DEADLINE.fetch);
  assert.ok(TOOL_DEADLINE.fetch < TOOL_DEADLINE.render);
  assert.ok(TOOL_DEADLINE.render < TOOL_DEADLINE.generate);
});

test("every deadline fits inside the platform's function ceiling", async () => {
  // The shared /eve/__server stream function runs with maxDuration "max"
  // (800s on this plan, held by scripts/eve-stream-max-duration-check.mjs).
  // A tool deadline above that would never fire: the platform would kill
  // the invocation first and we would be back to a silent turn.
  for (const ms of Object.values(TOOL_DEADLINE)) {
    assert.ok(ms < 800_000, `${ms}ms exceeds the function ceiling`);
  }
});

test("defineBoundedTool hands eve the bounded execute, not the raw one", async () => {
  // eve's defineTool returns the same object with a brand stamped, so the
  // execute it holds is whatever we passed in. This is the seam the whole
  // fix rests on: if the wrapper were applied anywhere else, or lost, the
  // 47 tools would compile and still freeze.
  const tool = defineBoundedTool({
    description: "never answers",
    inputSchema: z.object({}),
    deadlineMs: 40,
    repeatable: true,
    execute: () => new Promise<string>(() => {}),
  });

  const started = Date.now();
  await assert.rejects(
    (tool.execute as (input: unknown, ctx: unknown) => Promise<string>)({}, {}),
    (error: unknown) => {
      assert.ok(error instanceof ToolDeadlineError);
      assert.equal(error.repeatable, true);
      return true;
    },
  );
  assert.ok(Date.now() - started < 2000);
});

test("a bounded tool that answers passes its value straight through", async () => {
  const tool = defineBoundedTool({
    description: "answers",
    inputSchema: z.object({ q: z.string() }),
    deadlineMs: TOOL_DEADLINE.quick,
    repeatable: false,
    execute: (input) => ({ echoed: input.q }),
  });
  const out = await (tool.execute as (i: unknown, c: unknown) => Promise<unknown>)(
    { q: "alphabet pages" },
    {},
  );
  assert.deepEqual(out, { echoed: "alphabet pages" });
});
