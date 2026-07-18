import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  OPERATIONAL_PHASES,
  operationalDiagnostic,
} from "./operational-diagnostics";

describe("PII-free operational diagnostics", () => {
  it("emits every required phase code from bounded static fields", () => {
    assert.deepEqual(OPERATIONAL_PHASES, [
      "preparation_load",
      "content_guard",
      "canonical_persist",
      "transport",
      "finalization",
      "recovery_lookup",
      "manual_bookkeeping",
      "reactive_email_postprocess",
    ]);
    for (const phase of OPERATIONAL_PHASES) {
      const diagnostic = operationalDiagnostic(
        "morning_brief",
        phase,
        "retry_pending",
      );
      assert.equal(
        diagnostic,
        `[morning_brief] phase=${phase} result=retry_pending`,
      );
      assert.doesNotMatch(
        diagnostic,
        /family-|run-|parent@example|provider rejected/iu,
      );
    }
  });
});
