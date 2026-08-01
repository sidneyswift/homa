import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  IOS_MODE_MARKDOWN,
  IOS_VOICE_BRIDGE_MARKDOWN,
  iosModeMarkdown,
} from "../../agent/instructions/ios-mode";

describe("iOS voice bridge instructions", () => {
  it("keeps ordinary mobile chat unchanged", () => {
    assert.equal(iosModeMarkdown({ channel: "mobile" }), IOS_MODE_MARKDOWN);
  });

  it("adds live voice delivery rules only to bridge turns", () => {
    const markdown = iosModeMarkdown({
      channel: "mobile",
      voiceBridge: "true",
    });
    assert.equal(markdown, `${IOS_MODE_MARKDOWN}\n\n${IOS_VOICE_BRIDGE_MARKDOWN}`);
    assert.match(markdown ?? "", /full Homa agent/u);
    assert.match(markdown ?? "", /final reply will be spoken aloud exactly as written/u);
    assert.match(markdown ?? "", /Never refuse a capability because this is voice/u);
    assert.match(markdown ?? "", /Do not\n  call ask_for_photo, ask_for_details, or start_checklist/u);
  });

  it("never applies mobile instructions to another channel", () => {
    assert.equal(iosModeMarkdown({ channel: "web", voiceBridge: "true" }), null);
  });
});
