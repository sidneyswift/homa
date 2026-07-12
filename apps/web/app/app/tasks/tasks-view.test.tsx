import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";

import { TaskEditOverlay } from "./task-edit-overlay";
import {
  TasksView,
  hourLabel,
  weekdaysLabel,
  type TaskRowView,
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

function renderView(tasks: TaskRowView[]): string {
  return renderToStaticMarkup(
    <AppRouterContext.Provider value={ROUTER}>
      <TasksView
        tasks={tasks}
        runs={[]}
        timeZone="America/New_York"
        briefFlagOn
        journalFlagOn
        textingLinked
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

    // The schedule line stays the one place that says when.
    assert.match(html, /Weekdays \u00b7 9:00 am/);
    assert.match(html, /Tue, Thu \u00b7 3:00 pm \u00b7 by text/);

    // Edit and Delete left the card; they live in the dialog now.
    assert.doesNotMatch(html, />Edit</);
    assert.doesNotMatch(html, />Delete</);

    // A seeded brief means no brief placeholder; the journal placeholder
    // (dashed, not yet a real row) still shows and is not clickable.
    assert.doesNotMatch(html, /Starts on its own once your family/);
    assert.match(html, /Starts on its own in the evening\./);
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
});

describe("TaskEditOverlay", () => {
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
    assert.match(
      html,
      /Homa decides what it says\. You decide the days, the time, and how it reaches you\. The switch on its card turns it off any time\./,
    );

    // Schedule fields present, prefilled.
    assert.match(html, /Which days\?/);
    assert.match(html, /name="weekdays" checked="" value="1"/);
    assert.match(html, /<option value="9" selected="">9:00 am<\/option>/);

    // No renaming, no rewording, no deleting, no save-only delivery.
    assert.doesNotMatch(html, /What should it be called\?/);
    assert.doesNotMatch(html, /What should Homa do\?/);
    assert.doesNotMatch(html, /Delete this task/);
    assert.doesNotMatch(html, /Just save it to this page\./);
    assert.match(html, /Text me\./);
    assert.match(html, /Email me\./);
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
