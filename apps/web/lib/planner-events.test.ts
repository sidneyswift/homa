import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { plannerEventClient } from "./planner-events";

/**
 * The channel-to-client mapping for planner.* events (issue #257, arc
 * PR B0). The one rule worth pinning: unknown channels degrade to
 * "other", never to a dropped or invalid emit, because the registry's
 * enum is strict and a schema failure would silently swallow the event.
 */
describe("plannerEventClient", () => {
  it("treats the un-pinned web session as web", () => {
    assert.equal(plannerEventClient(undefined), "web");
    assert.equal(plannerEventClient(null), "web");
    assert.equal(plannerEventClient(""), "web");
    assert.equal(plannerEventClient("web"), "web");
  });

  it("passes known pinned channels through", () => {
    assert.equal(plannerEventClient("sms"), "sms");
    assert.equal(plannerEventClient("email"), "email");
    assert.equal(plannerEventClient("dispatch"), "dispatch");
    assert.equal(plannerEventClient("mobile"), "mobile");
  });

  it("maps the hyphenated agent-job channel onto the enum", () => {
    assert.equal(plannerEventClient("agent-job"), "agent_job");
  });

  it("degrades unknown channels to other instead of failing the emit", () => {
    assert.equal(plannerEventClient("materials-lab"), "other");
    assert.equal(plannerEventClient("carrier-pigeon"), "other");
  });
});
