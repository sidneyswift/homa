import assert from "node:assert/strict";
import test from "node:test";

import { webModeMarkdown } from "../../agent/instructions/web-mode";

test("web reply guidance is present only for authenticated web sessions", () => {
  assert.match(webModeMarkdown({ channel: "web" }) ?? "", /composer/u);
  assert.equal(webModeMarkdown({ channel: "sms" }), null);
  assert.equal(webModeMarkdown(undefined), null);
});
