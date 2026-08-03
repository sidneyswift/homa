import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { iconContract, semanticIconAliases, semanticIcons } from "@homa/design/contract";

test("native icon registry covers every semantic contract name", async () => {
  // Keep this contract test Node-runnable. Importing lucide-react-native loads
  // React Native's Flow-annotated entrypoint under local Node 23, while the
  // mobile typecheck still validates the executable adapter itself.
  const source = await readFile(new URL("./icon.tsx", import.meta.url), "utf8");
  for (const name of semanticIcons) {
    assert.match(source, new RegExp(`\\b${name}:`), `${name} is missing from the native registry`);
    assert.equal(typeof semanticIconAliases[name], "string");
  }
  assert.match(source, new RegExp(`strokeWidth=\\{iconContract\\.strokePx\\}`));
  assert.equal(iconContract.source, "semantic-adapter-only");
});
