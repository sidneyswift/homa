import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";

import { TASK_KIND_CONFIG } from "../../../lib/tasks/kinds";
import {
  RESEARCH_BRIEF_FEEDBACK_KIND,
  RESEARCH_BRIEF_FEEDBACK_OUTCOMES,
  isResearchBriefFeedbackEligible,
} from "../../../lib/tasks/research-brief-feedback-contract";
import {
  BRIEF_FEEDBACK_ERROR_MESSAGE,
  runBriefFeedbackInteraction,
} from "./task-feedback-interaction";
import { AgentJobOverlay } from "./agent-job-overlay";
import type { AgentJobView } from "./agent-job-view";
import { TaskEditOverlay } from "./task-edit-overlay";
import { briefFeedbackControlState, groupRunsByDay } from "./task-history";
import {
  TasksView,
  hourLabel,
  weekdaysLabel,
  type TaskRowView,
  type TaskRunView,
} from "./tasks-view";

/**
 * The Homa's tasks board and its editor dialog (task cards open an
 * editor, 2026-07-12). Same posture as the progress UI tests: static
 * server render, assertions on the HTML contract (headings, aria
 * wiring, which fields each kind exposes), no browser. Interactivity
 * (the click itself) is owned by the aria-haspopup wiring these tests
 * pin down.
 */

const ROUTER = {
  back() {},
  forward() {},
  refresh() {},
  hmrRefresh() {},
  push() {},
  replace() {},
  prefetch: async () => {},
};

const BRIEF_TASK: TaskRowView = {
  id: "task-brief",
  kind: "morning_brief",
  label: null,
  prompt: null,
  localHour: 9,
  weekdays: [1, 2, 3, 4, 5],
  deliveryPref: "text",
  paused: false,
  enabled: true,
  nextRunAt: "2026-07-13T13:00:00.000Z",
};

const CUSTOM_TASK: TaskRowView = {
  id: "task-custom",
  kind: "custom",
  label: "Co-op prep",
  prompt: "Remind me to pack the co-op bag.",
  localHour: 15,
  weekdays: [2, 4],
  deliveryPref: "text",
  paused: false,
  enabled: true,
  nextRunAt: "2026-07-14T19:00:00.000Z",
};

/** Saturday Jul 11, 2026, 6pm in New York: before both fixture tasks'
 * next runs, so their Next chips render dated (a fixed now keeps these
 * tests deterministic as real time passes the fixture dates). */
const RENDER_NOW = new Date("2026-07-11T22:00:00.000Z");

/** A curriculum build waiting on the parent (gate-first-volume): volumes 1
 * and 2 are saved, volume 3 is ready for review, the rest are still to
 * come. */
const AWAITING_JOB: AgentJobView = {
  id: "job-1",
  skill: "curriculum-studio",
  title: "Theo's All About Reading plan",
  status: "awaiting_input",
  totalStages: 9,
  progressNote: "Volume 3 is ready for you to look over.",
  startedAt: "2026-07-14T13:00:00.000Z",
  position: 3,
  stages: [
    { stageNumber: 1, status: "approved", title: "Weeks 1-4" },
    { stageNumber: 2, status: "approved", title: "Weeks 5-8" },
    { stageNumber: 3, status: "ready_for_review", title: "Weeks 9-12" },
  ],
};

function renderView(
  tasks: TaskRowView[],
  runs: TaskRunView[] = [],
  jobs: AgentJobView[] = [],
): string {
  return renderToStaticMarkup(
    <AppRouterContext.Provider value={ROUTER}>
      <TasksView
        tasks={tasks}
        jobs={jobs}
        runs={runs}
        timeZone="America/New_York"
        briefFlagOn
        textingLinked
        now={RENDER_NOW}
      />
    </AppRouterContext.Provider>,
  );
}

function renderJobOverlay(job: AgentJobView): string {
  return renderToStaticMarkup(
    <AppRouterContext.Provider value={ROUTER}>
      <AgentJobOverlay job={job} onClose={() => {}} />
    </AppRouterContext.Provider>,
  );
}

function renderOverlay(task: TaskRowView | null, textingLinked = true): string {
  return renderToStaticMarkup(
    <AppRouterContext.Provider value={ROUTER}>
      <TaskEditOverlay task={task} textingLinked={textingLinked} onClose={() => {}} />
    </AppRouterContext.Provider>,
  );
}

describe("TasksView", () => {
  it("renders task cards as dialog openers with the editor closed", () => {
    const html = renderView([BRIEF_TASK, CUSTOM_TASK]);

    assert.match(html, /data-brand-surface="tasks"/);
    assert.match(html, /quiet-frame quiet-frame--paper quiet-task-card/);

    // Every real task's title is a button that promises the dialog.
    assert.match(
      html,
      /<button[^>]*aria-haspopup="dialog"[^>]*>Morning research brief<\/button>/,
    );
    assert.match(
      html,
      /<button[^>]*aria-haspopup="dialog"[^>]*>Co-op prep<\/button>/,
    );
    // "Add a task" opens the same dialog.
    assert.match(
      html,
      /<button[^>]*aria-haspopup="dialog"[^>]*>[\s\S]*?Add a task<\/span>[\s\S]*?<\/button>/,
    );
    // First paint keeps the editor closed.
    assert.doesNotMatch(html, /role="dialog"/);

    // The schedule line stays the one place that says when, and names
    // delivery for every kind now that built-ins choose it too.
    assert.match(html, /Weekdays \u00b7 9:00 am \u00b7 by text/);
    assert.match(html, /Tue, Thu \u00b7 3:00 pm \u00b7 by text/);

    // Edit and Delete left the card; they live in the dialog now.
    assert.doesNotMatch(html, />Edit</);
    assert.doesNotMatch(html, />Delete</);

    // A seeded brief means no brief placeholder; the journal placeholder
    // (dashed, not yet a real row) still shows, is not clickable, and
    // never promises it starts on its own (it seeds switched off).
    assert.doesNotMatch(html, /Starts on its own within a day/);
    assert.match(
      html,
      /Off until you turn it on\. The switch shows up here within a day\./,
    );
    assert.doesNotMatch(
      html,
      /<button[^>]*aria-haspopup="dialog"[^>]*>Evening check-in<\/button>/,
    );
  });

  it("keeps the on/off switch on the card", () => {
    const html = renderView([BRIEF_TASK]);
    assert.match(html, /role="switch"[^>]*aria-checked="true"/);
    assert.match(html, /aria-label="Turn this task off"/);
  });

  it("wears its state: Next chip and warm disc on, Off chip and muted disc off", () => {
    const onHtml = renderView([BRIEF_TASK]);
    assert.match(onHtml, /Next \u00b7 Mon, Jul 13, 9:00 AM/);
    assert.match(onHtml, /quiet-status quiet-status--constructive/);
    assert.doesNotMatch(onHtml, />Off</);

    const offHtml = renderView([{ ...BRIEF_TASK, paused: true }]);
    assert.match(offHtml, />Off</);
    assert.doesNotMatch(offHtml, /Next \u00b7/);
    assert.doesNotMatch(offHtml, /quiet-status quiet-status--constructive/);
  });

  it("says soon, never a past time, while the scheduler catches up", () => {
    // A failed run keeps next_run_at until the retry tick, and a
    // finished run advances it only after the fact; in those windows a
    // dated chip would contradict History right below the card.
    const html = renderView([
      { ...BRIEF_TASK, nextRunAt: "2026-07-10T13:00:00.000Z" },
    ]);
    assert.match(html, /Next \u00b7 soon/);
    assert.doesNotMatch(html, /Jul 10/);
  });

  it("ends History on purpose and puts a reply door on finished runs", () => {
    const doneRun: TaskRunView = {
      id: "run-done",
      kind: "morning_brief",
      status: "done",
      title: "Morning research brief",
      summary: "One thing Homa looked into.",
      deliveredChannel: "sms",
      startedAt: "2026-07-11T13:00:00.000Z",
    };
    const failedRun: TaskRunView = {
      ...doneRun,
      id: "run-failed",
      status: "failed",
      deliveredChannel: null,
      summary: null,
      startedAt: "2026-07-10T13:00:00.000Z",
    };
    const html = renderView([BRIEF_TASK], [doneRun, failedRun]);

    assert.match(html, /data-brand-surface="task-history"/);
    assert.match(html, /quiet-frame quiet-frame--paper/);

    // The short status note plus the on-page door (the old "Reply
    // there and Homa answers" sentence retired with the link).
    assert.match(html, /Sent by text\./);
    assert.doesNotMatch(html, /Reply there and Homa answers/);
    assert.match(html, /<a[^>]*href="\/app"[^>]*>Ask Homa about this<\/a>/);

    // A failed run states only what happened. The scheduler already advanced,
    // so History must not promise an unplanned near-term retry.
    assert.match(html, /This task did not send\./);
    assert.doesNotMatch(html, /tries again soon|retry soon/iu);

    const uncertainHtml = renderView([BRIEF_TASK], [{
      ...doneRun,
      id: "run-uncertain",
      status: "uncertain",
      deliveredChannel: null,
    }]);
    assert.match(
      uncertainHtml,
      /Homa couldn&#x27;t confirm delivery\. Nothing else needs your attention right now\./,
    );
    assert.doesNotMatch(uncertainHtml, /saved (?:here|to this page)/iu);

    // Under the limit the end line says the list is complete; at the
    // limit it says older runs are kept, plainly.
    assert.match(html, /That&#x27;s everything so far\./);
    const manyRuns = Array.from({ length: 30 }, (_, index) => ({
      ...doneRun,
      id: `run-${index}`,
    }));
    const capped = renderView([BRIEF_TASK], manyRuns);
    assert.match(
      capped,
      /This page shows your newest 30 task updates\. Older ones are kept, just not shown here\./,
    );
    assert.doesNotMatch(capped, /That&#x27;s everything so far\./);
  });

  it("offers accessible feedback for every confirmed delivered morning brief", () => {
    const deliveredBrief: TaskRunView = {
      id: "run-delivered-brief",
      kind: "morning_brief",
      status: "done",
      title: "Morning research brief",
      summary: null,
      deliveredChannel: "email",
      startedAt: "2026-07-11T13:00:00.000Z",
      feedbackSignal: "helpful",
    };
    const confirmed = [
      deliveredBrief,
      { ...deliveredBrief, id: "run-partial", status: "partial" as const },
      {
        ...deliveredBrief,
        id: "run-partial-uncertain",
        status: "partial_uncertain" as const,
      },
      {
        ...deliveredBrief,
        id: "run-save-only",
        deliveredChannel: "none" as const,
      },
    ];
    const excluded = [
      { ...deliveredBrief, id: "run-running", status: "running" as const },
      { ...deliveredBrief, id: "run-uncertain", status: "uncertain" as const },
      { ...deliveredBrief, id: "run-failed", status: "failed" as const },
      { ...deliveredBrief, id: "run-skipped", status: "skipped" as const },
      {
        ...deliveredBrief,
        id: "run-partial-save-only",
        status: "partial" as const,
        deliveredChannel: "none" as const,
      },
      {
        ...deliveredBrief,
        id: "run-partial-uncertain-save-only",
        status: "partial_uncertain" as const,
        deliveredChannel: "none" as const,
      },
      { ...deliveredBrief, id: "run-custom", kind: "custom" as const },
    ];
    const html = renderView([BRIEF_TASK], [...confirmed, ...excluded]);

    assert.match(
      html,
      /<button[^>]*aria-label="Mark this brief helpful"[^>]*aria-pressed="true"[^>]*>Helpful<\/button>/,
    );
    assert.match(
      html,
      /<button[^>]*aria-label="Mark this brief not for us"[^>]*aria-pressed="false"[^>]*>Not for us<\/button>/,
    );
    assert.equal((html.match(/>Helpful<\/button>/g) ?? []).length, confirmed.length);
    assert.equal((html.match(/>Not for us<\/button>/g) ?? []).length, confirmed.length);
    assert.equal(
      (html.match(/>Was this helpful\?<\/p>/g) ?? []).length,
      confirmed.length,
    );
    assert.equal(
      (html.match(/role="group" aria-labelledby="brief-feedback-label-[^"]+"/g) ?? [])
        .length,
      confirmed.length,
    );
    assert.match(
      html,
      /id="brief-feedback-label-run-delivered-brief"[^>]*>Was this helpful\?<\/p>/,
    );
    assert.match(
      html,
      /border-2 border-\[var\(--homa-midnight-action\)\][^"]*bg-\[var\(--homa-midnight-action\)\][^"]*text-\[var\(--homa-paper\)\]/,
    );
    assert.match(html, /aria-live="polite"/);
    assert.match(html, />Ask Homa about this<\/a>/);
  });
});

describe("agent job cards", () => {
  it("shows an In progress section only when a build is active", () => {
    const withoutJobs = renderView([BRIEF_TASK]);
    assert.doesNotMatch(withoutJobs, /In progress/);

    const withJob = renderView([BRIEF_TASK], [], [AWAITING_JOB]);
    assert.match(withJob, /In progress/);
    // The card opens the steer dialog, same aria contract as a task card,
    // and closed on first paint.
    assert.match(
      withJob,
      /<button[^>]*aria-haspopup="dialog"[^>]*>Theo&#x27;s All About Reading plan<\/button>/,
    );
    assert.doesNotMatch(withJob, /role="dialog"/);
  });

  it("reads the build's place in the parent's own words, no raw stage 0", () => {
    const html = renderView([BRIEF_TASK], [], [AWAITING_JOB]);
    // Curriculum vocabulary (Volume), the family's start date, and the
    // one pill that asks for a tap.
    assert.match(html, /Volume 3 of 9 · started Jul 14/);
    assert.match(html, />Ready for you</);

    // A just-started build sits at current_stage 0; the card must still
    // read "Volume 1", never "Volume 0".
    const fresh = renderView(
      [BRIEF_TASK],
      [],
      [
        {
          ...AWAITING_JOB,
          id: "job-fresh",
          status: "queued",
          progressNote: null,
          position: 1,
          stages: [],
        },
      ],
    );
    assert.match(fresh, /Volume 1 of 9/);
    assert.doesNotMatch(fresh, /Volume 0/);
    assert.match(fresh, />Building</);
  });
});

describe("AgentJobOverlay", () => {
  it("lists the volumes with calm, no-red status words and steer controls", () => {
    const html = renderJobOverlay(AWAITING_JOB);

    assert.match(html, /role="dialog"/);
    assert.match(html, /<h2 id="agent-job-title"[^>]*>Theo&#x27;s All About Reading plan<\/h2>/);

    // Each built volume by its own words; the ready one asks for a tap.
    assert.match(html, /Volume 1[\s\S]*Weeks 1-4[\s\S]*Saved/);
    assert.match(html, /Volume 3[\s\S]*Weeks 9-12[\s\S]*Ready for you/);
    // Volumes 4 through 9 have no rows yet; they collapse to one up-next line.
    assert.match(html, /Volumes 4-9/);
    assert.match(html, />Up next</);

    // The one primary action is coral (bg-brand / text-on-brand) and present
    // only at the gate; Pause and the two-tap stop stay quiet. No red anywhere.
    assert.match(
      html,
      /<button[^>]*quiet-action quiet-action--primary[^>]*>[\s\S]*?Approve and keep building<\/span>[\s\S]*?<\/button>/,
    );
    assert.match(html, />Pause<\/span><\/button>/);
    assert.match(html, />Stop this build<\/span><\/button>/);
    assert.doesNotMatch(html, /Resume building/);
  });

  it("hides Approve unless the build is waiting, and offers Resume when paused", () => {
    const running = renderJobOverlay({
      ...AWAITING_JOB,
      status: "running",
      stages: [
        { stageNumber: 1, status: "approved", title: "Weeks 1-4" },
        { stageNumber: 2, status: "in_progress", title: "Weeks 5-8" },
      ],
    });
    assert.doesNotMatch(running, /Approve and keep building/);
    assert.match(running, />Pause<\/span><\/button>/);
    assert.match(running, /Weeks 5-8[\s\S]*Building/);

    const paused = renderJobOverlay({ ...AWAITING_JOB, status: "paused" });
    assert.match(paused, /Resume building/);
    assert.doesNotMatch(paused, />Pause<\/span><\/button>/);
  });
});

describe("TaskEditOverlay", () => {
  it("offers Run now on every saved task, built-in or custom", () => {
    const custom = renderOverlay(CUSTOM_TASK);
    assert.match(custom, />Run now<\/span><\/button>/);
    assert.match(
      custom,
      /Homa runs this task right away, exactly as saved\. The result shows up in History\. The schedule stays the same\./,
    );

    const builtIn = renderOverlay(BRIEF_TASK);
    assert.match(builtIn, />Run now<\/span><\/button>/);

    // Nothing is saved yet in create mode, so there is nothing to run.
    const creating = renderOverlay(null);
    assert.doesNotMatch(creating, />Run now<\/span><\/button>/);
  });

  it("gives a custom task the full form plus delete", () => {
    const html = renderOverlay(CUSTOM_TASK);

    assert.match(html, /role="dialog"/);
    assert.match(html, /data-brand-surface="task-dialog"/);
    assert.match(html, /quiet-artifact-backdrop/);
    assert.match(html, /aria-modal="true"/);
    assert.match(html, /<h2 id="task-edit-title"[^>]*>Edit task<\/h2>/);

    // The full form, prefilled from the task.
    assert.match(html, /What should it be called\?/);
    assert.match(html, /data-brand-surface="task-form"/);
    assert.match(html, /name="label"[^>]*value="Co-op prep"/);
    assert.match(html, /What should Homa do\?/);
    assert.match(html, /Remind me to pack the co-op bag\./);
    assert.match(html, /Which days\?/);
    assert.match(html, /name="weekdays" checked="" value="2"/);
    assert.match(html, /name="weekdays" checked="" value="4"/);
    assert.doesNotMatch(html, /name="weekdays" checked="" value="0"/);
    assert.match(html, /What time\?/);
    assert.match(html, /<option value="15" selected="">3:00 pm<\/option>/);

    // All three delivery choices, custom only.
    assert.match(html, /How should it reach you\?/);
    assert.match(html, /Text me\./);
    assert.match(html, /Email me\./);
    assert.match(html, /Just save it to this page\./);

    assert.match(html, />Save changes<\/span><\/button>/);
    assert.match(html, />Delete this task<\/span><\/button>/);
  });

  it("gives a built-in task the schedule only, words stay Homa's", () => {
    const html = renderOverlay(BRIEF_TASK);

    assert.match(html, /<h2 id="task-edit-title"[^>]*>Morning research brief<\/h2>/);
    // One sentence on what it does, the card's own description; the old
    // three-sentence you-decide explainer stays gone (founder ruling
    // 2026-07-12).
    assert.match(
      html,
      /One thing Homa looked into for your kids, and why it matters\./,
    );
    assert.doesNotMatch(html, /Homa decides what it says/);
    assert.doesNotMatch(html, /The switch on its card/);

    // Schedule fields present, prefilled.
    assert.match(html, /Which days\?/);
    assert.match(html, /name="weekdays" checked="" value="1"/);
    assert.match(html, /<option value="9" selected="">9:00 am<\/option>/);

    // No renaming, no rewording, no deleting. All three delivery doors,
    // including the page (founder ruling 2026-07-12 evening).
    assert.doesNotMatch(html, /What should it be called\?/);
    assert.doesNotMatch(html, /What should Homa do\?/);
    assert.doesNotMatch(html, /Delete this task/);
    assert.match(html, /Text me\./);
    assert.match(html, /Email me\./);
    assert.match(html, /Just save it to this page\./);
    assert.match(html, />Save changes<\/span><\/button>/);
  });

  it("creates through the same dialog under one action name", () => {
    const html = renderOverlay(null);

    assert.match(html, /<h2 id="task-edit-title"[^>]*>Add a task<\/h2>/);
    // One name per action: the commit button echoes "Add", never "Create".
    assert.match(html, />Add this task<\/span><\/button>/);
    assert.doesNotMatch(html, /Create task/);
    assert.doesNotMatch(html, /Delete this task/);
    // The example ask shows research, without cadence words (the day and
    // time fields own timing).
    assert.match(html, /Phonics game ideas/);
    assert.match(html, /Find one new phonics game and explain how to play it\./);
    assert.doesNotMatch(html, /each week/i);
  });

  it("tells the parent her own texting situation", () => {
    const linked = renderOverlay(CUSTOM_TASK, true);
    assert.match(linked, /Text me\./);
    assert.doesNotMatch(linked, /Until texting is set up/);
    assert.doesNotMatch(linked, /Set up texting in Settings/);

    const unlinked = renderOverlay(CUSTOM_TASK, false);
    assert.match(
      unlinked,
      /Text me\. Until texting is set up, it emails you instead\./,
    );
    assert.match(
      unlinked,
      /<a[^>]*href="\/app\/settings"[^>]*>Set up texting in Settings<\/a>/,
    );
  });
});

describe("groupRunsByDay", () => {
  function run(id: string, startedAt: string): TaskRunView {
    return {
      id,
      kind: "morning_brief",
      status: "done",
      title: "Morning research brief",
      summary: null,
      deliveredChannel: "sms",
      startedAt,
    };
  }

  it("groups newest-first runs under Today, Yesterday, then dated days", () => {
    // Sunday Jul 12, 2026, 6pm in New York.
    const now = new Date("2026-07-12T22:00:00.000Z");
    const groups = groupRunsByDay(
      [
        run("a", "2026-07-12T13:00:00.000Z"),
        run("b", "2026-07-11T13:00:00.000Z"),
        run("c", "2026-07-11T03:11:00.000Z"),
        run("d", "2026-07-10T13:00:00.000Z"),
      ],
      "America/New_York",
      now,
    );

    assert.deepEqual(
      groups.map((group) => [group.label, group.runs.map((r) => r.id)]),
      [
        ["Today", ["a"]],
        ["Yesterday", ["b"]],
        // 03:11 UTC on Jul 11 is 11:11 PM on Jul 10 in New York: the
        // family-local day owns the grouping, never the UTC day.
        ["Fri, Jul 10", ["c", "d"]],
      ],
    );
  });
});

describe("brief feedback controls", () => {
  it("shares one typed eligibility contract containing only real outcomes", () => {
    assert.equal(RESEARCH_BRIEF_FEEDBACK_KIND, "morning_brief");
    assert.deepEqual(RESEARCH_BRIEF_FEEDBACK_OUTCOMES, [
      ["done", "sms"],
      ["done", "email"],
      ["done", "none"],
      ["partial", "sms"],
      ["partial", "email"],
      ["partial_uncertain", "sms"],
      ["partial_uncertain", "email"],
    ]);

    for (const [status, deliveredChannel] of RESEARCH_BRIEF_FEEDBACK_OUTCOMES) {
      assert.equal(
        isResearchBriefFeedbackEligible({
          kind: RESEARCH_BRIEF_FEEDBACK_KIND,
          status,
          deliveredChannel,
        }),
        true,
        `${status}/${deliveredChannel}`,
      );
    }
    for (const [status, deliveredChannel] of [
      ["partial", "none"],
      ["partial_uncertain", "none"],
      ["running", "sms"],
      ["uncertain", "sms"],
      ["failed", "sms"],
      ["skipped", "sms"],
    ] as const) {
      assert.equal(
        isResearchBriefFeedbackEligible({
          kind: "morning_brief",
          status,
          deliveredChannel,
        }),
        false,
        `${status}/${deliveredChannel}`,
      );
    }
  });

  it("exposes selection and pending state to assistive technology", () => {
    assert.deepEqual(briefFeedbackControlState("helpful", "helpful", false), {
      ariaPressed: true,
      disabled: false,
    });
    assert.deepEqual(briefFeedbackControlState("helpful", "not_for_us", true), {
      ariaPressed: false,
      disabled: true,
    });
  });

  it("clears stale errors and refreshes only after successful feedback", async () => {
    const errors: Array<string | null> = ["old error"];
    let refreshes = 0;

    await runBriefFeedbackInteraction(
      {
        taskRunId: "00000000-0000-4000-8000-000000000010",
        signal: "helpful",
      },
      {
        action: async () => ({ error: null }),
        setError: (error) => errors.push(error),
        refresh: () => {
          refreshes += 1;
        },
      },
    );

    assert.deepEqual(errors, ["old error", null]);
    assert.equal(refreshes, 1);
  });

  it("shows the offer without refreshing when the action returns an error", async () => {
    const errors: Array<string | null> = [];
    let refreshes = 0;

    await runBriefFeedbackInteraction(
      {
        taskRunId: "00000000-0000-4000-8000-000000000010",
        signal: "not_for_us",
      },
      {
        action: async () => ({ error: "database rejected the write" }),
        setError: (error) => errors.push(error),
        refresh: () => {
          refreshes += 1;
        },
      },
    );

    assert.deepEqual(errors, [null, BRIEF_FEEDBACK_ERROR_MESSAGE]);
    assert.equal(
      BRIEF_FEEDBACK_ERROR_MESSAGE,
      "That didn't save. Nothing else changed. You can tap your choice again.",
    );
    assert.equal(refreshes, 0);
  });

  it("shows the same offer without refreshing when the action throws", async () => {
    const errors: Array<string | null> = [];
    let refreshes = 0;

    await runBriefFeedbackInteraction(
      {
        taskRunId: "00000000-0000-4000-8000-000000000010",
        signal: "helpful",
      },
      {
        action: async () => {
          throw new Error("network failed");
        },
        setError: (error) => errors.push(error),
        refresh: () => {
          refreshes += 1;
        },
      },
    );

    assert.deepEqual(errors, [null, BRIEF_FEEDBACK_ERROR_MESSAGE]);
    assert.equal(refreshes, 0);
  });
});

describe("built-in seed defaults", () => {
  it("ships the check-in off and the brief on (founder ruling 2026-07-12)", () => {
    assert.equal(TASK_KIND_CONFIG.journal_prompt.seedPaused, true);
    assert.equal(TASK_KIND_CONFIG.morning_brief.seedPaused, false);
  });
});

describe("schedule labels", () => {
  it("formats hours in the family's own clock words", () => {
    assert.equal(hourLabel(0), "12:00 am");
    assert.equal(hourLabel(9), "9:00 am");
    assert.equal(hourLabel(12), "12:00 pm");
    assert.equal(hourLabel(15), "3:00 pm");
  });

  it("names weekday sets plainly", () => {
    assert.equal(weekdaysLabel([0, 1, 2, 3, 4, 5, 6]), "Every day");
    assert.equal(weekdaysLabel([1, 2, 3, 4, 5]), "Weekdays");
    assert.equal(weekdaysLabel([0, 6]), "Weekends");
    assert.equal(weekdaysLabel([4, 2]), "Tue, Thu");
  });
});
