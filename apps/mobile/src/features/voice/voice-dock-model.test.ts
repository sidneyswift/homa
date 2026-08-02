import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  voiceDockPresentation,
  voiceDockStatusLabel,
  voiceStatusAnnouncement,
} from "./voice-dock-model";

describe("Voice shell dock presentation", () => {
  it("uses the compact Homa puck for routine listening, working, and speaking", () => {
    for (const status of ["listening", "working", "speaking"] as const) {
      assert.equal(
        voiceDockPresentation({ pathname: "/planner", status, muted: false, manuallyExpanded: false }),
        "compact",
      );
    }
  });

  it("expands every state that needs a parent's attention", () => {
    for (const input of [
      { status: "connecting" as const, muted: false },
      { status: "paused" as const, muted: false },
      { status: "failed" as const, muted: false },
      { status: "listening" as const, muted: true },
    ]) {
      assert.equal(
        voiceDockPresentation({ pathname: "/binder", ...input, manuallyExpanded: false }),
        "expanded",
      );
    }
  });

  it("lets the parent expand routine controls and hides the duplicate on Voice", () => {
    assert.equal(
      voiceDockPresentation({ pathname: "/planner", status: "listening", muted: false, manuallyExpanded: true }),
      "expanded",
    );
    assert.equal(
      voiceDockPresentation({ pathname: "/voice", status: "failed", muted: false, manuallyExpanded: true }),
      "hidden",
    );
  });

  it("keeps the reason visible when another microphone owner pauses Voice", () => {
    assert.equal(
      voiceDockStatusLabel({ status: "paused", muted: false, pauseReason: "Voice paused for the recorder." }),
      "Voice paused for the recorder.",
    );
  });

  it("gives every active state one concise spoken outcome", () => {
    assert.equal(
      voiceStatusAnnouncement({ status: "idle", muted: false, pauseReason: null }),
      null,
    );
    assert.equal(
      voiceStatusAnnouncement({ status: "listening", muted: false, pauseReason: null }),
      "Homa is listening.",
    );
    assert.equal(
      voiceStatusAnnouncement({ status: "working", muted: false, pauseReason: null, busyDetail: "Checking the planner." }),
      "Homa is working. Checking the planner.",
    );
    assert.equal(
      voiceStatusAnnouncement({ status: "speaking", muted: false, pauseReason: null }),
      "Homa is speaking.",
    );
    assert.equal(
      voiceStatusAnnouncement({ status: "failed", muted: false, pauseReason: null }),
      "Voice was interrupted. Try again when you are ready.",
    );
  });
});
