import assert from "node:assert/strict";
import { test } from "node:test";

import { validateProposedClaims } from "./claim-validation";
import { renderSkillCatalog, SKILL_CATALOG } from "./skill-catalog";

test("every validator-eligible option remains available for every authenticated child age", () => {
  for (const ages of [[48], [55], [56], [59], [48, 144], [24, 60, 180]]) {
    const catalog = renderSkillCatalog(ages);
    const included = new Set(catalog.split("\n").filter(line => line.startsWith("  ")).map(line => line.trim().split(" ")[0]));
    for (const ageMonths of ages) {
      const child = {childId: "synthetic-child", name: "Maya", ageMonths};
      for (const item of SKILL_CATALOG) {
        const accepted = validateProposedClaims({message: "Synthetic provenance span", children: [child], claims: [{childId: child.childId, itemId: item.itemId, answer: "getting_there", confidence: "high", quote: "Synthetic provenance span"}]}).accepted.length > 0;
        if (accepted) assert.ok(included.has(item.itemId), `omitted ${item.itemId} at ${ageMonths} months in roster ${ages}`);
      }
    }
    assert.equal(included.size, SKILL_CATALOG.filter(item => item.typicalMonths <= Math.max(...ages) + 24).length);
  }
});

test("age boundary and younger-child coverage repair do not relax a selected child's validator", () => {
  assert.ok(!renderSkillCatalog(55).includes("fine_motor.cuts-curves"));
  assert.ok(renderSkillCatalog(56).includes("fine_motor.cuts-curves"));
  assert.ok(renderSkillCatalog([48, 144]).includes("fine_motor.cuts-line"));
  assert.ok(renderSkillCatalog(144).includes("fine_motor.cuts-line"));
  assert.ok(renderSkillCatalog([48, 144]).includes("fine_motor.cuts-curves"));
  const result = validateProposedClaims({message: "She cuts curves", children: [{childId: "younger", name: "Maya", ageMonths: 48}], claims: [{childId: "younger", itemId: "fine_motor.cuts-curves", answer: "easily", confidence: "high", quote: "She cuts curves"}]});
  assert.equal(result.rejected[0]?.reason, "age_implausible");
  assert.equal(renderSkillCatalog([]), "");
  for (const age of [-1, 55.5, Number.NaN, Number.POSITIVE_INFINITY]) assert.throws(() => renderSkillCatalog(age));
});
