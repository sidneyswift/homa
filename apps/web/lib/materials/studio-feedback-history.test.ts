import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";

/**
 * Founder verdict history on studio runs (D5 of the training-corpus
 * package, gh#328). The 2026-07-18 design kept only the latest verdict, so
 * every time the founder changed their mind the earlier critique was
 * deleted, and a critique plus the version it rejected plus the version
 * that followed is exactly the pair a model learns taste from.
 *
 * These are posture and wiring assertions, deliberately. The write itself
 * needs a database, but the three things that would silently undo this
 * change are all visible in source: dropping the history insert, dropping
 * the deny-all posture on a table holding the founder's own prose, and
 * losing the isolation guard's coverage entry so a future schema audit
 * stops noticing the table exists.
 */

const repoRoot = path.resolve(import.meta.dirname, "..", "..", "..", "..");
const migration = path.join(
  repoRoot,
  "supabase",
  "migrations",
  "20260728210000_materials_studio_feedback_history.sql",
);
const runsSource = path.join(repoRoot, "apps", "web", "lib", "materials", "studio-runs.ts");
const isolationCheck = path.join(repoRoot, "scripts", "isolation-check.mjs");

describe("studio feedback history migration", () => {
  it("is additive: it creates its own table and alters nothing", async () => {
    const sql = await readFile(migration, "utf8");
    assert.match(sql, /create table if not exists public\.materials_studio_run_feedback/);
    // An alter on the parent would make this migration unsafe to apply
    // ahead of its deploy, which is the whole reason it is a child table.
    assert.doesNotMatch(sql, /alter table public\.materials_studio_runs/);
    assert.doesNotMatch(sql, /drop\s+(table|column)/i);
  });

  it("keeps the parent's deny-all posture", async () => {
    const sql = await readFile(migration, "utf8");
    assert.match(sql, /alter table public\.materials_studio_run_feedback enable row level security/);
    assert.match(
      sql,
      /revoke all on table public\.materials_studio_run_feedback from anon, authenticated/,
    );
    // Deny-all means no policies at all, the founder-console posture.
    assert.doesNotMatch(sql, /create policy/i);
  });

  it("pins each verdict to the material it judged", async () => {
    const sql = await readFile(migration, "utf8");
    // Without this column a verdict is a loose note, not a training pair.
    assert.match(sql, /material_id uuid references public\.materials \(id\)/);
    assert.match(sql, /run_id uuid not null[\s\S]*references public\.materials_studio_runs \(id\) on delete cascade/);
  });
});

describe("saveStudioRunFeedback", () => {
  it("still writes the latest verdict to the run row", async () => {
    const source = await readFile(runsSource, "utf8");
    // Every existing reader (list pill, improvement packet, detail page)
    // depends on the parent columns continuing to mean "the latest".
    assert.match(source, /update public\.materials_studio_runs[\s\S]*set feedback =/);
    assert.match(source, /feedback_at = now\(\)/);
  });

  it("also appends the verdict to the history table", async () => {
    const source = await readFile(runsSource, "utf8");
    assert.match(
      source,
      /insert into public\.materials_studio_run_feedback[\s\S]*run_id, feedback, feedback_tags, material_id, left_by/,
    );
  });

  it("saves the verdict even when the history table is not migrated yet", async () => {
    const source = await readFile(runsSource, "utf8");
    // Additive-may-lead cuts both ways: the deploy can reach production
    // before the migration does, and losing the founder's words to an
    // ordering problem is the exact failure this change exists to stop.
    assert.match(source, /code\?: string \}\)\.code !== "42P01"\) throw error/);
  });
});

describe("isolation coverage", () => {
  it("registers the history table with the tenancy guard", async () => {
    const source = await readFile(isolationCheck, "utf8");
    assert.match(source, /expectReadDenied\("materials_studio_run_feedback"\)/);
    // Registered outside the password-gated authenticated fixtures, so the
    // guard covers it in every environment, not only in CI.
    assert.match(source, /coveredTables\.add\("materials_studio_run_feedback"\)/);
  });
});
