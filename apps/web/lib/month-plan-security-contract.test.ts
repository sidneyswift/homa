import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

const sourceUrl = new URL("./month-plan-draft.ts", import.meta.url);
const workingPlansUrl = new URL("./working-plans.ts", import.meta.url);

describe("month plan deterministic security contract", () => {
  it("accepts reused materials only when the family-owned row is final", async () => {
    const source = await readFile(sourceUrl, "utf8");
    assert.match(
      source,
      /select id from public\.materials[\s\S]*where family_id = \$\{familyId\}[\s\S]*and status = 'final'[\s\S]*and id in/u,
    );
  });

  it("serializes family approval before reading the saved month", async () => {
    const source = await readFile(sourceUrl, "utf8");
    const approval = source.slice(source.indexOf("export async function approveMonthPlanDraft"));
    const lock = approval.indexOf("pg_advisory_xact_lock");
    const savedMonthRead = approval.indexOf("select p.child_id, p.updated_at::text");
    assert.ok(lock >= 0);
    assert.ok(savedMonthRead > lock);
  });

  it("keeps the approval receipt family scoped and server writable only", async () => {
    const migration = await readFile(
      new URL("../../../supabase/migrations/20260801201500_month_plan_approvals.sql", import.meta.url),
      "utf8",
    );
    assert.match(migration, /alter table public\.month_plan_approvals enable row level security/u);
    assert.match(migration, /using \(public\.is_family_member\(family_id\)\)/u);
    assert.match(
      migration,
      /revoke insert, update, delete on public\.month_plan_approvals from authenticated/u,
    );
  });

  it("keeps recoverable working plans family scoped and browser read-only", async () => {
    const migration = await readFile(
      new URL("../../../supabase/migrations/20260816203000_working_plans.sql", import.meta.url),
      "utf8",
    );
    assert.match(migration, /alter table public\.working_plans enable row level security/u);
    assert.match(migration, /using \(public\.is_family_member\(family_id\)\)/u);
    assert.doesNotMatch(migration, /for (?:insert|update|delete)|for all/iu);
    assert.match(
      migration,
      /revoke insert, update, delete on public\.working_plans from authenticated/u,
    );

    const source = await readFile(workingPlansUrl, "utf8");
    assert.match(
      source,
      /where id = \$\{input\.workingPlanId\}[\s\S]*and family_id = \$\{input\.familyId\}/u,
    );
    assert.match(
      source,
      /snapshot\.plan\.children\.flatMap[\s\S]*activity\.reusedMaterialId[\s\S]*artifact_links = excluded\.artifact_links/u,
    );
    assert.match(
      source,
      /effect_receipts = effect_receipts \|\| \$\{sql\.json/u,
    );
    assert.match(
      source,
      /owner_user_id = coalesce\(existing\.owner_user_id, excluded\.owner_user_id\)[\s\S]*source_entries = existing\.source_entries \|\| excluded\.source_entries[\s\S]*current_revision = excluded\.current_revision/u,
    );
  });
});
