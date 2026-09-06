import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import { Script } from "node:vm";

const require = createRequire(new URL("../apps/web/package.json", import.meta.url));
const ts = require("typescript");
const root = new URL("../", import.meta.url);

function compiled(relative, imports, clock = Date) {
  const path = new URL(relative, root);
  const source = readFileSync(path, "utf8");
  const output = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText;
  const module = { exports: {} };
  const load = name => imports[name] ?? {};
  new Script(`(function(require, module, exports, Date) { ${output}\n})`, { filename: path.pathname })
    .runInThisContext()(load, module, module.exports, clock);
  return module.exports;
}

function fixture({ family = { id: "owned-family", time_zone: "America/New_York" }, instant = "2027-01-01T02:00:00Z" } = {}) {
  const writes = [], contexts = [], revalidated = [];
  class Clock extends Date { constructor(...args) { super(...(args.length ? args : [instant])); } }
  const sql = async (parts, ...values) => { writes.push({ query: parts.join("?"), values }); return []; };
  const school = compiled("apps/web/lib/compliance/school-year.ts", { "../map/db": { mapDb: () => sql } });
  const time = compiled("apps/web/lib/time-zone.ts", {});
  const action = compiled("apps/web/app/app/settings/profile-actions.ts", {
    "next/cache": { revalidatePath: path => revalidated.push(path) },
    "@homa/core": { HOMESCHOOL_STYLES: ["eclectic"] },
    "../../../lib/family": { getMyFamily: async () => family },
    "../../../lib/compliance/school-year": school,
    "../../../lib/time-zone": time,
    "../../../lib/map/store": { saveFamilyContext: async (...args) => contexts.push(args) },
  }, Clock).updateHomeschoolAction;
  async function run(value, include = true) {
    const form = new FormData();
    if (include) form.set("school_year_start_on", value);
    form.set("family_id", "attacker-family");
    return action({ error: null }, form);
  }
  return { run, writes, contexts, revalidated };
}

test("explicit blank and whitespace clear only the caller's school-year date", async () => {
  for (const raw of ["", "  "]) {
    const f = fixture();
    assert.deepEqual(await f.run(raw), { error: null, saved: true });
    assert.equal(f.writes.length, 2);
    assert.match(f.writes[0].query, /set school_year_start_on = \?.*where id = \?/su);
    assert.deepEqual(f.writes[0].values, [null, "owned-family"]);
    assert.deepEqual(f.contexts[0], ["owned-family", { styles: [], strictness: "", curriculums: [], values: "" }]);
    assert.deepEqual(f.revalidated, ["/app/settings"]);
  }
});
test("absent school-year field preserves the existing value for other form callers", async () => {
  const f = fixture();
  assert.equal((await f.run("", false)).saved, true);
  assert.equal(f.writes.length, 1);
  assert.match(f.writes[0].query, /filing_parent_name/u);
});
test("valid nonblank date goes through the actual validator and scoped writer", async () => {
  const f = fixture();
  assert.equal((await f.run(" 2026-09-10 ")).saved, true);
  assert.deepEqual(f.writes[0].values, ["2026-09-10", "owned-family"]);
});
test("invalid calendar and outside-window dates cause no writes or revalidation", async () => {
  for (const value of ["2026-02-30", "2025-02-29", "2023-01-01", "2028-01-01"]) {
    const f = fixture();
    assert.equal(typeof (await f.run(value)).error, "string");
    assert.deepEqual([f.writes, f.contexts, f.revalidated], [[], [], []]);
  }
});
test("New York keeps the prior local year while UTC is already January 1", async () => {
  const f = fixture();
  assert.equal((await f.run("2024-01-01")).saved, true);
  assert.deepEqual(f.writes[0].values, ["2024-01-01", "owned-family"]);
});
test("a family east of UTC validates against its already-started local year", async () => {
  const f = fixture({ family: { id: "owned-family", time_zone: "Pacific/Kiritimati" }, instant: "2026-12-31T12:30:00Z" });
  assert.equal((await f.run("2028-01-01")).saved, true);
  assert.deepEqual(f.writes[0].values, ["2028-01-01", "owned-family"]);
});
test("unset timezone uses the existing Central-time fallback", async () => {
  const f = fixture({ family: { id: "owned-family", time_zone: null } });
  assert.equal((await f.run("2024-01-01")).saved, true);
});
test("missing authenticated family never clears or writes anything", async () => {
  const f = fixture({ family: null });
  assert.deepEqual(await f.run(""), { error: "Set up your family first." });
  assert.deepEqual([f.writes, f.contexts, f.revalidated], [[], [], []]);
});
