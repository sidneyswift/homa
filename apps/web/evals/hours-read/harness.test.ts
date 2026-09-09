import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import evals from "./behavior.eval";
import routing from "./routing.eval";
import { HOURS_ROUTING_CASES } from "./routing-fixtures";
import { exactFindings, semanticFindings } from "./behavior-harness";
import { HOURS_READ_CASES, FAMILY } from "./fixtures";
import { fullHoursEvalMenu } from "./full-menu";
import { hoursToolForCase } from "./tool-harness";

for (const testCase of HOURS_READ_CASES) {
  test(`actual production-source tool with synthetic reader: ${testCase.id}`, async () => {
    const definition = await hoursToolForCase(testCase);
    const input = definition.inputSchema.parse(testCase.expectedInput);
    const output = await definition.execute(input, { session: { auth: { current: { attributes: { family_id: FAMILY } } } } });
    assert.deepEqual(exactFindings(testCase, [{ name: "find_hours", input: input as Record<string, unknown>, output }], false), []);
    if (testCase.complete === false) {
      assert.equal(Object.hasOwn(output as object, "totalMinutes"), false);
      assert.equal(Object.hasOwn(output as object, "recordedDays"), false);
    }
  });
}
test("installed Eve accepts all eight eval definitions", () => {
  assert.equal(evals.length, 8);
  for (const item of [...evals, ...routing]) assert.equal(item._tag, "EveEval");
  assert.equal(routing.length, HOURS_ROUTING_CASES.length);
});
test("semantic evidence is an exact response quote", () => {
  assert.deepEqual(semanticFindings("155 recorded minutes.", { pass: true, findings: [], evidenceQuote: "155 recorded minutes.", reason: "Exact total." }), []);
  assert.equal(semanticFindings("155 recorded minutes.", { pass: true, findings: [], evidenceQuote: "No school happened.", reason: "Wrong quote." }).length, 1);
});
test("exact checker catches wrong shared argument and state-record routing", () => {
  const c = HOURS_READ_CASES[0]!;
  assert.equal(exactFindings(c, [{ name: "find_hours", input: { ...c.expectedInput, includeShared: false }, output: c.expectedOutput }, { name: "load_skill", input: { skill: "state-records" }, output: {} }], false).length, 2);
});

test("full neutral web menu includes all compiled, framework, and five dynamic tool schemas", async () => {
  const menu = await fullHoursEvalMenu(process.cwd());
  const compiled = JSON.parse(await readFile(".eve/compile/compiled-agent-manifest.json", "utf8")) as { tools: Array<{ name: string }> };
  assert.equal(new Set(menu.map(item => item.name)).size, menu.length);
  for (const entry of compiled.tools) assert.ok(menu.some(item => item.name === entry.name));
  assert.ok(menu.every(item => item.inputSchema && item.inputSchema.type));
  for (const name of ["find_hours", "manage_hours_categories", "load_skill", "log_hours", "create_printable", "generate_image", "ask_user_questions", "start_checklist"]) assert.ok(menu.some(t => t.name === name));
  assert.equal(menu.some(t => t.name === "start_first_making"), false);
});

test("family receipt distinguishes inclusive child totals from direct row attribution", async () => {
  const c = HOURS_READ_CASES.find(item => item.id === "family-counts-shared-once")!;
  const definition = await hoursToolForCase(c);
  const output = JSON.parse(JSON.stringify(await definition.execute(definition.inputSchema.parse(c.expectedInput), { session: { auth: { current: { attributes: { family_id: FAMILY } } } } })));
  assert.deepEqual(output.byChild, [{ childId: "22222222-2222-4222-8222-222222222222", minutes: 155 }, { childId: "33333333-3333-4333-8333-333333333333", minutes: 110 }]);
  assert.deepEqual(output.byEntryScope, [{ childId: "22222222-2222-4222-8222-222222222222", minutes: 105 }, { childId: "33333333-3333-4333-8333-333333333333", minutes: 60 }, { childId: null, minutes: 50 }]);
  assert.equal(output.totalMinutes, 215);
});
