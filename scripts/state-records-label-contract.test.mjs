import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import { Script } from "node:vm";

const require = createRequire(new URL("../apps/web/package.json", import.meta.url));
const ts = require("typescript");
const root = new URL("../apps/web/lib/compliance/", import.meta.url);
function load(name, imports) {
  const path = new URL(name, root);
  const output = ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText;
  const module = { exports: {} };
  new Script(`(function(require, module, exports) { ${output}\n})`, { filename: path.pathname })
    .runInThisContext()(name => imports[name] ?? {}, module, module.exports);
  return module.exports;
}
const deadlines = load("deadlines.ts", {});
const { schoolYearLabel } = load("state-records.ts", { "./deadlines": deadlines });
test("State Records names the exact resolved start, without inventing an annual end", () => {
  assert.equal(schoolYearLabel("2026-09-10"), "Since Sep 10, 2026");
  assert.equal(schoolYearLabel(deadlines.schoolYearStartFor("2024-02-29", "2100-03-01")), "Since Feb 29, 2096");
  assert.equal(schoolYearLabel(deadlines.schoolYearStartFor("2024-02-29", "2104-02-29")), "Since Feb 29, 2104");
});
test("State Records refuses malformed or impossible captions", () => {
  for (const value of [null, "", "2026-02-30", "2100-02-29", "2026-9-10", "0000-01-01", "bad"]) {
    assert.equal(schoolYearLabel(value), null);
  }
});
test("date caption is fixed in UTC and does not shift in the process timezone", () => {
  for (const zone of ["America/Los_Angeles", "Pacific/Kiritimati", "UTC"]) {
    const original = process.env.TZ;
    try { process.env.TZ = zone; assert.equal(schoolYearLabel("2026-01-01"), "Since Jan 1, 2026"); }
    finally { if (original === undefined) delete process.env.TZ; else process.env.TZ = original; }
  }
});
