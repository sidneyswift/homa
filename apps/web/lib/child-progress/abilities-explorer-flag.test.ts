import assert from "node:assert/strict";
import test from "node:test";

import { abilitiesExplorerEnabled } from "./abilities-explorer-flag";

test("abilities explorer requires the exact true flag", () => {
  const previous = process.env.HOMA_ABILITIES_EXPLORER_ENABLED;
  try {
    delete process.env.HOMA_ABILITIES_EXPLORER_ENABLED;
    assert.equal(abilitiesExplorerEnabled(), false);
    process.env.HOMA_ABILITIES_EXPLORER_ENABLED = "1";
    assert.equal(abilitiesExplorerEnabled(), false);
    process.env.HOMA_ABILITIES_EXPLORER_ENABLED = "true";
    assert.equal(abilitiesExplorerEnabled(), true);
  } finally {
    if (previous === undefined) delete process.env.HOMA_ABILITIES_EXPLORER_ENABLED;
    else process.env.HOMA_ABILITIES_EXPLORER_ENABLED = previous;
  }
});
