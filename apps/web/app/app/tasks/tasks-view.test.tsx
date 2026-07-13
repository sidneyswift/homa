import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";

import { TASK_KIND_CONFIG } from "../../../lib/tasks/kinds";
import { TaskEditOverlay } from "./task-edit-overlay";
import { groupRunsByDay } from "./task-history";
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

function renderView(tasks: TaskRowView[], runs: TaskRunView[] = []): string {
  return renderToStaticMarkup(
    <AppRouterContext.Provider value={ROUTER}>
      <TasksView
        tasks={tasks}
        runs={runs}
        timeZone="America/New_York"
        briefFlagOn
        textingLinked
        now={RENDER_NOW}
      />
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
    assert.match(html, /<button[^>]*aria-haspopup="dialog"[^>]*>.*Add a task<\/button>/);
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
    assert.match(onHtml, /bg-brand-soft text-brand/);
    assert.doesNotMatch(onHtml, />Off</);

    const offHtml = renderView([{ ...BRIEF_TASK, paused: true }]);
    assert.match(offHtml, />Off</);
    assert.doesNotMatch(offHtml, /Next \u00b7/);
    assert.doesNotMatch(offHtml, /bg-brand-soft text-brand/);
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

    // The short status note plus the on-page door (the old "Reply
    // there and Homa answers" sentence retired with the link).
    assert.match(html, /Sent by text\./);
    assert.doesNotMatch(html, /Reply there and Homa answers/);
    assert.match(html, /<a[^>]*href="\/app"[^>]*>Ask Homa about this<\/a>/);

    // A failed run keeps its calm note, telling the same "soon" story
    // as the card's Next chip, and gets no ask door.
    assert.match(html, /Didn&#x27;t send\. Homa tries again soon\./);

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
      /This list shows the newest 30\. Older runs are kept, just not shown here\./,
    );
    assert.doesNotMatch(capped, /That&#x27;s everything so far\./);
  });
});

describe("TaskEditOverlay", () => {
  it("offers Run now on every saved task, built-in or custom", () => {
    const custom = renderOverlay(CUSTOM_TASK);
    assert.match(custom, />Run now<\/button>/);
    assert.match(
      custom,
      /Homa runs this task right away, exactly as saved\. The result shows up in History\. The schedule stays the same\./,
    );

    const builtIn = renderOverlay(BRIEF_TASK);
    assert.match(builtIn, />Run now<\/button>/);

    // Nothing is saved yet in create mode, so there is nothing to run.
    const creating = renderOverlay(null);
    assert.doesNotMatch(creating, />Run now<\/button>/);
  });

  it("gives a custom task the full form plus delete", () => {
    const html = renderOverlay(CUSTOM_TASK);

    assert.match(html, /role="dialog"/);
    assert.match(html, /aria-modal="true"/);
    assert.match(html, /<h2 id="task-edit-title"[^>]*>Edit task<\/h2>/);

    // The full form, prefilled from the task.
    assert.match(html, /What should it be called\?/);
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

    assert.match(html, />Save changes<\/button>/);
    assert.match(html, />Delete this task<\/button>/);
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
    assert.match(html, />Save changes<\/button>/);
  });

  it("creates through the same dialog under one action name", () => {
    const html = renderOverlay(null);

    assert.match(html, /<h2 id="task-edit-title"[^>]*>Add a task<\/h2>/);
    // One name per action: the commit button echoes "Add", never "Create".
    assert.match(html, />Add this task<\/button>/);
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
