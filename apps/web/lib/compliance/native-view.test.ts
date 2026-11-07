import assert from "node:assert/strict";
import { test } from "node:test";

import { opensNativeStateRecordsView } from "./native-view";

test("only the iPhone app's channel opens the native state-records view", () => {
  assert.equal(opensNativeStateRecordsView({ channel: "mobile" }), true);
  assert.equal(opensNativeStateRecordsView({ channel: "mobile", voiceBridge: "true" }), true);
  assert.equal(opensNativeStateRecordsView({ channel: "web" }), false);
  assert.equal(opensNativeStateRecordsView({ channel: "sms" }), false);
  assert.equal(opensNativeStateRecordsView({}), false);
  assert.equal(opensNativeStateRecordsView(undefined), false);
});
