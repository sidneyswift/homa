import { loadEnvFile } from "node:process";

import { assertSmsReplyCase, runSmsReplyCase, SMS_REPLY_CASES } from "../apps/web/evals/sms-replies/behavior";
import { applyEvalIsolation } from "../apps/web/lib/eval-isolation";

loadEnvFile(new URL("../apps/web/.env.local", import.meta.url));
const isolation = applyEvalIsolation(process.env);
if (isolation.mode !== "scrubbed") throw new Error("This eval requires scrubbed credentials");
const selected = process.argv.find(arg => arg.startsWith("--case="))?.slice(7);
const fixtures = SMS_REPLY_CASES.filter(row => !selected || row.id === selected);
if (!fixtures.length) throw new Error("No matching SMS reply case");
let failures = 0;
for (const fixture of fixtures) {
  try {
    const run = await runSmsReplyCase(fixture.id, AbortSignal.timeout(180_000));
    console.log(JSON.stringify(run));
    assertSmsReplyCase(run);
    console.log(`PASS ${fixture.id}`);
  } catch (error) {
    failures++;
    console.error(`FAIL ${fixture.id}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
process.exitCode = failures ? 1 : 0;
