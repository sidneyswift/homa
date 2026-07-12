import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  LINKED_SMS_PROGRESS_GUIDANCE,
} from "./instruction-guidance";

describe("linked SMS progress guidance", () => {
  it("keeps the durable check-in workflow short and card-free", () => {
    assert.match(
      LINKED_SMS_PROGRESS_GUIDANCE,
      /manage_child_progress/u,
    );
    assert.match(
      LINKED_SMS_PROGRESS_GUIDANCE,
      /one question per text/u,
    );
    assert.match(
      LINKED_SMS_PROGRESS_GUIDANCE,
      /exact server statement/u,
    );
    assert.match(
      LINKED_SMS_PROGRESS_GUIDANCE,
      /one or two sentences/u,
    );
    assert.match(
      LINKED_SMS_PROGRESS_GUIDANCE,
      /no rich cards/u,
    );
    assert.match(
      LINKED_SMS_PROGRESS_GUIDANCE,
      /never call signup tools/iu,
    );
  });

  it("routes activity and time away from skill evidence", () => {
    assert.match(
      LINKED_SMS_PROGRESS_GUIDANCE,
      /log_hours/u,
    );
    assert.match(
      LINKED_SMS_PROGRESS_GUIDANCE,
      /never skill evidence/u,
    );
  });
});
