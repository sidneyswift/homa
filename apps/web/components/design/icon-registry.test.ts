import assert from "node:assert/strict";
import test from "node:test";
import { semanticIconAliases, semanticIcons } from "@homa/design/contract";
import { semanticIconRegistry } from "./icon-registry.ts";

test("web icon registry covers every semantic contract name", () => {
  assert.deepEqual(Object.keys(semanticIconRegistry).sort(), [...semanticIcons].sort());
  for (const name of semanticIcons) {
    assert.equal(typeof semanticIconRegistry[name], "object");
    assert.equal(typeof semanticIconAliases[name], "string");
  }
});
