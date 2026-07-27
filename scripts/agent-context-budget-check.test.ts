import assert from "node:assert/strict";
import test from "node:test";

import {
  checkBudgets,
  checkModuleParity,
  CONTEXT_BUDGETS,
  measureComponents,
} from "./agent-context-budget-check.mts";

test("the real tree is inside every budget", () => {
  assert.deepEqual(checkBudgets(measureComponents(), CONTEXT_BUDGETS), []);
});

test("an oversize component fires", () => {
  const problems = checkBudgets(
    [{ name: "instructions.md", bytes: 999_999 }],
    { "instructions.md": 22_400 },
  );
  assert.equal(problems.length, 1);
  assert.match(problems[0], /over its 22400-byte budget/);
  assert.match(problems[0], /Laws are never deletion candidates/);
});

test("a component with no declared budget fires", () => {
  const problems = checkBudgets([{ name: "new-surface", bytes: 10 }], {});
  assert.match(problems[0], /no budget declared/);
});

test("a fallback-sized family render fires the floor", () => {
  const problems = checkBudgets(
    [{ name: "family-context (eval fixture render)", bytes: 200 }],
    { "family-context (eval fixture render)": 3_000 },
  );
  assert.equal(problems.length, 1);
  assert.match(problems[0], /fixture path looks broken/);
});

test("an unaccounted mode module fires parity", () => {
  const problems = checkModuleParity(["sms-mode.ts", "voice-mode.ts"]);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /voice-mode\.ts is neither measured nor exempt/);
});

test("measured and exempt modules pass parity", () => {
  assert.deepEqual(
    checkModuleParity([
      "sms-mode.ts",
      "email-mode.ts",
      "web-mode.ts",
      "research-mode.ts",
      "family-context.ts",
      "onboarding-mode.ts",
    ]),
    [],
  );
});
