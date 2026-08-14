import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("server checkout holds the family lock through the Stripe write", async () => {
  const source = await readFile(new URL("./route.ts", import.meta.url), "utf8");

  assert.match(
    source,
    /from public\.families[\s\S]*for update[\s\S]*createServerCheckoutSession/u,
  );
  assert.match(source, /trialPeriodDays: 7/u);
  assert.match(source, /configuredCheckoutOrigin\(\)/u);
  assert.doesNotMatch(source, /headers\.get\(["'](?:host|origin)/iu);
});
