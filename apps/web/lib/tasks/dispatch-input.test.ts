import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildDispatchAuth,
  buildDispatchTarget,
  buildTaskMessage,
} from "./dispatch-input";
import type { DueFamilyTask } from "./store";

/**
 * The shared dispatch inputs (Run now + the hourly dispatcher). The
 * load-bearing contract: a scheduled run's message is byte-identical to
 * what the dispatcher always sent, a manual run never claims the clock
 * chose the moment, and both doors stamp the same session identity.
 * The brief's context loader is injected so no test touches a database.
 */

function task(overrides: Partial<DueFamilyTask> = {}): DueFamilyTask {
  return {
    scheduleId: "schedule-1",
    familyId: "family-1",
    kind: "journal_prompt",
    timeZone: "America/New_York",
    localHour: 20,
    weekdays: [0, 1, 2, 3, 4, 5, 6],
    deliveryPref: "text",
    label: null,
    prompt: null,
    parentFirstName: "Evie",
    kidPhrase: "Nova",
    phoneNumbers: ["+15550001111"],
    email: "evie@example.com",
    recipientMemberUserId: "user-1",
    ...overrides,
  };
}

const FAKE_BRIEF_CONTEXT = {
  styleKeys: ["montessori"],
  positionLines: ["- Nova: phonics: ahead (+8mo)"],
  knowledge: [],
};

describe("buildTaskMessage", () => {
  it("keeps the scheduled journal message on its original claim", async () => {
    const message = await buildTaskMessage(task(), "scheduled");
    assert.match(
      message,
      /^It is this family's evening check-in moment \(their local evening\)\./,
    );
    assert.match(message, /Compose tonight's short journal prompt to Evie\./);
    assert.match(message, /delivered to her EXACTLY as written/);
  });

  it("tells the model a manual journal run was the parent's own ask", async () => {
    const message = await buildTaskMessage(task(), "manual");
    assert.match(
      message,
      /^The parent just asked, from the Homa's tasks page, to run the evening check-in once right now\./,
    );
    assert.doesNotMatch(message, /It is this family's evening check-in moment/);
    assert.match(message, /Compose a short journal prompt to Evie about today\./);
  });

  it("keeps the save-only delivery line for delivery 'none'", async () => {
    const message = await buildTaskMessage(task({ deliveryPref: "none" }), "manual");
    assert.match(message, /saved to the family's Homa's tasks page/);
    assert.doesNotMatch(message, /delivered to her EXACTLY as written/);
  });

  it("runs a manual brief on the injected context, asking for today", async () => {
    const message = await buildTaskMessage(
      task({ kind: "morning_brief" }),
      "manual",
      async () => FAKE_BRIEF_CONTEXT,
    );
    assert.match(
      message,
      /^The parent just asked, from the Homa's tasks page, to run the morning research brief once right now\./,
    );
    assert.doesNotMatch(message, /weekday morning research brief moment/);
    assert.match(message, /Load the research-brief skill FIRST/);
    assert.match(message, /Their homeschool style: montessori/);
    assert.match(message, /Compose today's brief to Evie about Nova\./);
  });

  it("keeps the scheduled brief asking for this morning", async () => {
    const message = await buildTaskMessage(
      task({ kind: "morning_brief" }),
      "scheduled",
      async () => FAKE_BRIEF_CONTEXT,
    );
    assert.match(message, /^It is this family's weekday morning research brief moment\./);
    assert.match(message, /Compose this morning's brief to Evie about Nova\./);
  });

  it("carries a custom task's label and verbatim prompt on both triggers", async () => {
    const custom = task({
      kind: "custom",
      label: "Co-op prep",
      prompt: "Remind me to pack the co-op bag.",
    });
    const scheduled = await buildTaskMessage(custom, "scheduled");
    assert.match(
      scheduled,
      /^It is time for a task this family set up themselves: "Co-op prep"\./,
    );
    const manual = await buildTaskMessage(custom, "manual");
    assert.match(
      manual,
      /^The parent just asked, from the Homa's tasks page, to run a task they set up themselves once right now: "Co-op prep"\./,
    );
    assert.match(manual, /Remind me to pack the co-op bag\./);
  });
});

describe("dispatch session identity", () => {
  it("stamps the same dispatcher principal and attributes on both doors", () => {
    const auth = buildDispatchAuth(task({ kind: "custom" }), "run-1", "episode-1");
    assert.equal(auth.authenticator, "dispatcher");
    assert.equal(auth.principalId, "dispatch:family-1");
    assert.equal(auth.principalType, "user");
    assert.deepEqual(auth.attributes, {
      channel: "dispatch",
      familyId: "family-1",
      taskRunId: "run-1",
      taskKind: "custom",
      episodeId: "episode-1",
    });
  });

  it("targets the run's own row and the task's delivery choice", () => {
    const target = buildDispatchTarget(
      task({ deliveryPref: "email", label: "Co-op prep", kind: "custom" }),
      "run-1",
      "episode-1",
    );
    assert.deepEqual(target, {
      familyId: "family-1",
      phoneNumbers: ["+15550001111"],
      email: "evie@example.com",
      runId: "run-1",
      kind: "custom",
      deliveryPref: "email",
      label: "Co-op prep",
      episodeId: "episode-1",
      recipientMemberUserId: "user-1",
    });
  });
});
