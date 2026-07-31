import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applyOverlaySignal,
  deriveOverlaySignals,
  dismissActiveOverlay,
  EMPTY_OVERLAY_MODEL,
  type OverlaySignal,
} from "./overlay-model";

/**
 * Pure-derivation tests in the message-utils.test.ts style: hand-built
 * UIMessage-shaped objects in, signals out. The dedup contract mirrors
 * web's handledPlannerPartKeyRef idiom (chat-client.tsx): seed handled
 * keys with everything present at mount, so a restored session never
 * replays its overlays.
 */

function toolPart(
  toolName: string,
  output: unknown,
  state = "output-available",
): Record<string, unknown> {
  return { type: "dynamic-tool", toolName, state, output };
}

function assistantMessage(
  id: string,
  parts: Record<string, unknown>[],
): Record<string, unknown> {
  return { id, role: "assistant", parts };
}

function userMessage(id: string, text: string): Record<string, unknown> {
  return { id, role: "user", parts: [{ type: "text", text }] };
}

const NONE: ReadonlySet<string> = new Set();

const material = {
  title: "Fractions with pizza",
  kind: "worksheet",
  skill: "Halves and quarters",
  childName: "Finn",
  previewUrl: "https://blob.example/preview.png",
  pdfUrl: "https://blob.example/page.pdf",
};

describe("deriveOverlaySignals: mapping", () => {
  const cases: {
    name: string;
    part: Record<string, unknown>;
    expected: Partial<OverlaySignal> | null;
  }[] = [
    {
      name: "open_planner opened:true is a planner signal",
      part: toolPart("open_planner", { opened: true }),
      expected: { kind: "planner", refreshCount: 0 },
    },
    {
      name: "open_planner opened:false is nothing",
      part: toolPart("open_planner", { opened: false }),
      expected: null,
    },
    {
      name: "edit_plan updated:true is a planner signal with a write counted",
      part: toolPart("edit_plan", { updated: true, summary: "Swapped Tuesday" }),
      expected: { kind: "planner", refreshCount: 1 },
    },
    {
      name: "schedule_plan_activity scheduled:true is a planner signal",
      part: toolPart("schedule_plan_activity", {
        scheduled: true,
        activityText: "Skip counting",
        scheduledDate: "2026-07-30",
      }),
      expected: { kind: "planner", refreshCount: 1 },
    },
    {
      name: "edit_plan updated:false is nothing",
      part: toolPart("edit_plan", { updated: false }),
      expected: null,
    },
    {
      name: "create_printable with a material payload is a material signal",
      part: toolPart("create_printable", { material }),
      expected: { kind: "material" },
    },
    {
      name: "show_material re-surfaces as the same material signal",
      part: toolPart("show_material", { material }),
      expected: { kind: "material" },
    },
    {
      name: "create_worksheet (legacy alias) with a worksheet payload works",
      part: toolPart("create_worksheet", { worksheet: material }),
      expected: { kind: "material" },
    },
    {
      name: "a material without previewUrl (refusal or legacy) is nothing",
      part: toolPart("create_printable", {
        material: { title: "No page", pdfUrl: "x" },
      }),
      expected: null,
    },
    {
      name: "log_hours success is a receipt with the hours summary",
      part: toolPart("log_hours", { logged: true, subject: "math", minutes: 45 }),
      expected: {
        kind: "receipt",
        toolName: "log_hours",
        summary: "Hours saved: math, 45 min",
      },
    },
    {
      name: "log_hours double-log guard (no fields) still reads Hours saved",
      part: toolPart("log_hours", { logged: true, done: true }),
      expected: { kind: "receipt", summary: "Hours saved" },
    },
    {
      name: "log_hours failure is nothing (Homa narrates it herself)",
      part: toolPart("log_hours", { logged: false, note: "Could not log it" }),
      expected: null,
    },
    {
      name: "remember reuses the transcript chip wording",
      part: toolPart("remember", { saved: true, content: "Maya loves foxes" }),
      expected: { kind: "receipt", summary: "Noted: Maya loves foxes" },
    },
    {
      name: "mark_material_final reuses the transcript chip wording",
      part: toolPart("mark_material_final", {
        finalized: true,
        title: "Fractions with pizza",
      }),
      expected: { kind: "receipt", summary: "Final kept: Fractions with pizza" },
    },
    {
      name: "add_family_event success is a calendar receipt",
      part: toolPart("add_family_event", {
        added: true,
        title: "Zoo day",
        startsOn: "2026-08-01",
      }),
      expected: { kind: "receipt", summary: "On the calendar: Zoo day" },
    },
    {
      name: "an unknown tool with a true success flag falls back to a generic receipt",
      part: toolPart("send_followup_email", { sent: true }),
      expected: { kind: "receipt", summary: "Done: send followup email" },
    },
    {
      name: "an unknown tool with no success flags at all still gets a receipt",
      part: toolPart("some_future_tool", { anything: "at all" }),
      expected: { kind: "receipt", summary: "Done: some future tool" },
    },
    {
      name: "an unknown tool whose only success flags are false is nothing",
      part: toolPart("send_followup_email", { sent: false, done: false }),
      expected: null,
    },
    {
      name: "an unknown tool reporting an error string is nothing",
      part: toolPart("some_future_tool", { error: "nope" }),
      expected: null,
    },
    {
      name: "recall (memory internal) stays hidden",
      part: toolPart("recall", { done: true, matches: [] }),
      expected: null,
    },
    {
      name: "load_skill stays hidden",
      part: toolPart("load_skill", { loaded: true }),
      expected: null,
    },
    {
      name: "manage_child_progress (journal internal) stays hidden",
      part: toolPart("manage_child_progress", { done: true }),
      expected: null,
    },
    {
      name: "generate_image (making internal) stays hidden",
      part: toolPart("generate_image", { done: true }),
      expected: null,
    },
    {
      name: "ask_user_questions (transcript furniture) stays hidden",
      part: toolPart("ask_user_questions", { asked: true, questions: [] }),
      expected: null,
    },
    {
      name: "a still-running tool part is nothing yet",
      part: toolPart("log_hours", undefined, "input-available"),
      expected: null,
    },
  ];

  for (const testCase of cases) {
    it(testCase.name, () => {
      const { signals, keys } = deriveOverlaySignals(
        [assistantMessage("msg-1", [testCase.part])],
        NONE,
      );
      if (testCase.expected === null) {
        assert.equal(signals.length, 0);
        assert.equal(keys.length, 0);
        return;
      }
      assert.equal(signals.length, 1);
      assert.equal(keys.length, 1);
      assert.equal(keys[0], "msg-1:0");
      assert.equal(signals[0].key, "msg-1:0");
      for (const [field, value] of Object.entries(testCase.expected)) {
        assert.deepEqual(
          (signals[0] as unknown as Record<string, unknown>)[field],
          value,
        );
      }
    });
  }

  it("passes the material payload through untouched", () => {
    const { signals } = deriveOverlaySignals(
      [assistantMessage("msg-1", [toolPart("create_printable", { material })])],
      NONE,
    );
    assert.equal(signals[0].kind, "material");
    assert.ok(signals[0].kind === "material");
    assert.deepEqual(signals[0].material, material);
  });
});

describe("deriveOverlaySignals: mount-time dedup", () => {
  const restoredSession = [
    userMessage("u1", "Can you plan the week?"),
    assistantMessage("a1", [
      toolPart("open_planner", { opened: true }),
      toolPart("log_hours", { logged: true, subject: "math", minutes: 30 }),
    ]),
  ];

  it("a restored session never replays: seeding handled with all keys silences everything", () => {
    const mount = deriveOverlaySignals(restoredSession, NONE);
    assert.deepEqual(mount.keys, ["a1:0", "a1:1"]);
    const { signals } = deriveOverlaySignals(restoredSession, new Set(mount.keys));
    assert.equal(signals.length, 0);
  });

  it("only signals appearing after mount fire", () => {
    const mount = deriveOverlaySignals(restoredSession, NONE);
    const handled = new Set(mount.keys);
    const later = [
      ...restoredSession,
      assistantMessage("a2", [toolPart("create_printable", { material })]),
    ];
    const { signals, keys } = deriveOverlaySignals(later, handled);
    assert.deepEqual(keys, ["a1:0", "a1:1", "a2:0"]);
    assert.equal(signals.length, 1);
    assert.equal(signals[0].key, "a2:0");
    assert.equal(signals[0].kind, "material");
  });

  it("returns an empty walk for an empty session", () => {
    assert.deepEqual(deriveOverlaySignals([], NONE), { signals: [], keys: [] });
  });
});

describe("deriveOverlaySignals: ordering and refreshCount", () => {
  it("keeps message-then-part order across kinds", () => {
    const messages = [
      assistantMessage("a1", [
        toolPart("log_hours", { logged: true, subject: "reading", minutes: 20 }),
        toolPart("create_printable", { material }),
      ]),
      assistantMessage("a2", [toolPart("open_planner", { opened: true })]),
    ];
    const { signals } = deriveOverlaySignals(messages, NONE);
    assert.deepEqual(
      signals.map((signal) => signal.kind),
      ["receipt", "material", "planner"],
    );
  });

  it("each plan write increments refreshCount monotonically", () => {
    const messages = [
      assistantMessage("a1", [
        toolPart("open_planner", { opened: true }),
        toolPart("edit_plan", { updated: true }),
        toolPart("schedule_plan_activity", { scheduled: true }),
      ]),
    ];
    const { signals } = deriveOverlaySignals(messages, NONE);
    assert.deepEqual(
      signals.map((signal) =>
        signal.kind === "planner" ? signal.refreshCount : null,
      ),
      [0, 1, 2],
    );
  });

  it("counts handled plan writes too, so refreshCount stays monotonic per session", () => {
    const messages = [
      assistantMessage("a1", [
        toolPart("open_planner", { opened: true }),
        toolPart("edit_plan", { updated: true }),
      ]),
      assistantMessage("a2", [
        toolPart("schedule_plan_activity", { scheduled: true }),
      ]),
    ];
    const { signals } = deriveOverlaySignals(messages, new Set(["a1:0", "a1:1"]));
    assert.equal(signals.length, 1);
    assert.ok(signals[0].kind === "planner");
    assert.equal(signals[0].refreshCount, 2);
  });
});

describe("deriveOverlaySignals: malformed input", () => {
  it("skips user messages, junk entries, and shapeless parts without throwing", () => {
    const messages: unknown[] = [
      null,
      "not a message",
      42,
      userMessage("u1", "hi"),
      { role: "assistant" },
      { id: "a0", role: "assistant", parts: "not an array" },
      assistantMessage("a1", [
        { type: "text", text: "hello" },
        { type: "dynamic-tool", state: "output-available" },
        toolPart("log_hours", { logged: true, subject: "art", minutes: 15 }),
      ]),
    ];
    const { signals, keys } = deriveOverlaySignals(messages, NONE);
    assert.deepEqual(keys, ["a1:2"]);
    assert.equal(signals.length, 1);
    assert.ok(signals[0].kind === "receipt");
    assert.equal(signals[0].summary, "Hours saved: art, 15 min");
  });

  it("falls back to a positional message id when id is missing", () => {
    const { keys } = deriveOverlaySignals(
      [
        {
          role: "assistant",
          parts: [toolPart("log_hours", { logged: true, subject: "math", minutes: 5 })],
        },
      ],
      NONE,
    );
    assert.deepEqual(keys, ["m0:0"]);
  });
});

describe("applyOverlaySignal and dismissActiveOverlay", () => {
  const planner: OverlaySignal = { kind: "planner", key: "a1:0", refreshCount: 0 };
  const plannerRefresh: OverlaySignal = {
    kind: "planner",
    key: "a1:1",
    refreshCount: 1,
  };
  const receiptA: OverlaySignal = {
    kind: "receipt",
    key: "a1:2",
    toolName: "log_hours",
    summary: "Hours saved: math, 45 min",
  };
  const receiptB: OverlaySignal = {
    kind: "receipt",
    key: "a1:3",
    toolName: "remember",
    summary: "Noted: Maya loves foxes",
  };

  it("a receipt with nothing up shows immediately", () => {
    const state = applyOverlaySignal(EMPTY_OVERLAY_MODEL, receiptA);
    assert.deepEqual(state, { active: receiptA, receipts: [] });
  });

  it("receipts queue FIFO behind an open sheet and drain on dismiss", () => {
    let state = applyOverlaySignal(EMPTY_OVERLAY_MODEL, planner);
    state = applyOverlaySignal(state, receiptA);
    state = applyOverlaySignal(state, receiptB);
    assert.deepEqual(state.active, planner);
    assert.deepEqual(state.receipts, [receiptA, receiptB]);
    state = dismissActiveOverlay(state);
    assert.deepEqual(state, { active: receiptA, receipts: [receiptB] });
    state = dismissActiveOverlay(state);
    assert.deepEqual(state, { active: receiptB, receipts: [] });
    state = dismissActiveOverlay(state);
    assert.deepEqual(state, { active: null, receipts: [] });
  });

  it("a planner refresh while the planner is up stays planner (no reopen, higher refreshCount)", () => {
    let state = applyOverlaySignal(EMPTY_OVERLAY_MODEL, planner);
    state = applyOverlaySignal(state, plannerRefresh);
    assert.ok(state.active?.kind === "planner");
    assert.equal(state.active.refreshCount, 1);
    assert.deepEqual(state.receipts, []);
  });
});
