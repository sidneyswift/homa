import assert from "node:assert/strict";
import { it } from "node:test";

import { isWebDeliveryChannel } from "./screen-delivery";

it("binds authenticated browser and native text, leaving other transports with their own delivery", () => {
  for (const channel of [undefined, "web", "mobile"]) assert.equal(isWebDeliveryChannel(channel), true);
  for (const channel of ["voice", "sms", "email", "dispatch", "lesson", "mobile-voice", "invented", null]) assert.equal(isWebDeliveryChannel(channel), false);
});
