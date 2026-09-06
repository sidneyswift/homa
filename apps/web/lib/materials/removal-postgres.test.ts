import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";

import postgres from "postgres";

import { mapDb } from "../map/db";
import { selectParentVisibleMaterialRevisions } from "./parent-visible";
import { insertRestoredMaterialPinned } from "./restore-record";

const databaseUrl = process.env.HOMA_EVAL_DATABASE_URL;

describe("Binder collection removal PostgreSQL contract", { skip: !databaseUrl }, () => {
  const sql = postgres(databaseUrl!, { prepare: false, max: 5 });
  const familyId = randomUUID();
  const otherFamilyId = randomUUID();
  const userId = randomUUID();

  before(async () => {
    await sql`insert into auth.users (id, email) values (${userId}, ${`${userId}@example.test`})`;
    await sql`insert into public.families (id, name) values
      (${familyId}, 'Binder sandbox'), (${otherFamilyId}, 'Other binder sandbox')`;
    await sql`insert into public.family_members (family_id, user_id, role)
      values (${familyId}, ${userId}, 'parent')`;
  });
  after(async () => {
    await Promise.all([sql.end(), mapDb().end()]);
  });

  async function member<T>(work: (tx: postgres.TransactionSql) => Promise<T>) {
    return await sql.begin(async (tx) => {
      await tx`set local role authenticated`;
      await tx`select set_config('request.jwt.claim.sub', ${userId}, true)`;
      await tx`set local statement_timeout = '5s'`;
      return await work(tx);
    });
  }

  async function insert(input: {
    id?: string;
    revises?: string;
    family?: string;
    status?: "draft" | "final" | "superseded";
    generation?: Record<string, unknown>;
  } = {}, tx: postgres.Sql | postgres.TransactionSql = sql): Promise<string> {
    const id = input.id ?? randomUUID();
    await tx`insert into public.materials
      (id, family_id, title, pdf_url, preview_url, html, revises, status, generation)
      values (${id}, ${input.family ?? familyId}, 'Same title', 'https://example.test/original.pdf',
        'https://example.test/original.jpg', '<p>Original work</p>', ${input.revises ?? null},
        ${input.status ?? "draft"}, ${tx.json((input.generation ?? { review: { pass: true } }) as never)})`;
    return id;
  }

  async function remove(id: string, family = familyId) {
    return await member(async (tx) => {
      const rows = await tx<{ result: string; versions_removed: number }[]>`
        select * from public.remove_family_material_chain(${family}, ${id})`;
      return rows[0];
    });
  }

  async function snapshot(id: string): Promise<string | null> {
    const rows = await sql<{ deleted_at: string | null }[]>`
      select deleted_at::text from public.materials where id = ${id} and family_id = ${familyId}`;
    return rows[0].deleted_at;
  }

  async function restore(id: string, expected: string | null, family = familyId) {
    return await member(async (tx) => {
      const rows = await tx<{ id: string | null }[]>`
        select public.restore_family_material_version(${family}, ${id}, ${expected}::text::timestamptz,
          'https://example.test/restored.pdf', 'https://example.test/restored.jpg', '{}'::jsonb) as id`;
      return rows[0].id;
    });
  }

  async function visible(ids: string[]) {
    return await member(async (tx) => {
      const rows = await tx<{ id: string; status: "draft" | "final" | "superseded"; revises: string | null; created_at: string; reviewPass: boolean }[]>`
        select id, status, revises, created_at::text, true as "reviewPass"
        from public.materials where family_id = ${familyId} and id = any(${ids}) and deleted_at is null`;
      return selectParentVisibleMaterialRevisions(rows.map((row) => ({
        id: row.id, status: row.status, revisesId: row.revises,
        order: Date.parse(row.created_at), reviewPass: row.reviewPass,
      }))).map((row) => row.id);
    });
  }

  async function waitForBlockedCollectionWrite() {
    const deadline = Date.now() + 2000;
    while (Date.now() < deadline) {
      const rows = await sql`select 1 from pg_locks where locktype = 'advisory' and not granted`;
      if (rows.length > 0) return;
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    assert.fail("second transaction did not block on the collection lock");
  }

  it("removes draft, kept, ancestor and sibling rows without changing bytes or same-title chains", async () => {
    const root = await insert({ status: "superseded" });
    const kept = await insert({ revises: root, status: "final" });
    const draft = await insert({ revises: kept });
    const sibling = await insert({ revises: root });
    const unrelated = await insert({ status: "final" });
    const before = await sql`select id, revises, status, html, pdf_url, preview_url from public.materials
      where family_id = ${familyId} and id = any(${[root, kept, draft, sibling]}) order by id`;
    assert.deepEqual(await remove(draft), { result: "removed", versions_removed: 4 });
    assert.deepEqual(await visible([root, kept, draft, sibling, unrelated]), [unrelated]);
    const afterRows = await member((tx) => tx`select id, revises, status, html, pdf_url, preview_url from public.materials
      where family_id = ${familyId} and id = any(${[root, kept, draft, sibling]}) order by id`);
    assert.deepEqual([...afterRows], [...before], "exact-ID history and file references remain readable");
    const tombstone = await snapshot(root);
    assert.ok(tombstone);
    assert.deepEqual(await remove(kept), { result: "already_removed", versions_removed: 0 });
    assert.equal(await snapshot(root), tombstone, "an idempotent retry does not invalidate a later restore");
  });

  it("repairs an already-deleted tip's resurfaced ancestors through the same scoped operation", async () => {
    const root = await insert();
    const tip = await insert({ revises: root });
    await sql`update public.materials set deleted_at = '2026-09-05T16:39:07.904Z' where id = ${tip}`;
    assert.deepEqual(await visible([root, tip]), [root]);
    assert.deepEqual(await remove(tip), { result: "removed", versions_removed: 1 });
    assert.deepEqual(await visible([root, tip]), []);
  });

  it("has no application list limit and traverses a chain beyond 3,000 rows", async () => {
    const ids = Array.from({ length: 3005 }, () => randomUUID());
    await sql`insert into public.materials ${sql(ids.map((id, index) => ({
      id, family_id: familyId, title: "Long chain", pdf_url: "https://example.test/pdf",
      preview_url: "https://example.test/preview", html: "<p>Long chain</p>",
      revises: index === 0 ? null : ids[index - 1],
    })))}`;
    assert.deepEqual(await remove(ids.at(-1)!), { result: "removed", versions_removed: ids.length });
    assert.deepEqual(await visible(ids), []);
  });

  it("rejects anonymous, foreign-family and missing records without an invented success", async () => {
    const foreign = await insert({ family: otherFamilyId });
    assert.deepEqual(await remove(foreign), { result: "not_found", versions_removed: 0 });
    assert.deepEqual(await remove(randomUUID()), { result: "not_found", versions_removed: 0 });
    await assert.rejects(remove(foreign, otherFamilyId), /Family access denied/u);
    await assert.rejects(restore(foreign, null, otherFamilyId), /Family access denied/u);
    assert.equal(await restore(foreign, null), null);
    await assert.rejects(sql.begin(async (tx) => {
      await tx`set local role anon`;
      return await tx`select * from public.remove_family_material_chain(${familyId}, ${foreign})`;
    }), /permission denied/u);
    assert.equal((await sql`select deleted_at from public.materials where id = ${foreign}`)[0].deleted_at, null);
  });

  it("inherits removal for ordinary revisions even when their generation JSON claims restore", async () => {
    const root = await insert();
    await remove(root);
    const revision = await member((tx) => insert({ revises: root, generation: { restore: { sourceMaterialId: root } } }, tx));
    assert.equal(await snapshot(revision), await snapshot(root));
    assert.deepEqual(await visible([root, revision]), []);
  });

  it("removes a visible lesson worksheet and hidden versions without granting approval or restore", async () => {
    const child = randomUUID();
    const lesson = randomUUID();
    await sql`insert into public.children (id, family_id, name, birth_month)
      values (${child}, ${familyId}, 'Taylor', '2018-01-01')`;
    await sql`insert into public.subject_lessons
      (id, child_id, subject_id, target_statement, source_report_generated_at,
       source_fingerprint, bank_version, idempotency_key)
      values (${lesson}, ${child}, 'math', 'Count shapes', now(),
        ${'a'.repeat(64)}, 'fixture', ${'a'.repeat(64)})`;
    const hidden = await insert();
    const kept = await insert({ revises: hidden, status: "final" });
    await sql`update public.materials set subject_lesson_id = ${lesson}
      where family_id = ${familyId} and id = any(${[hidden, kept]})`;
    assert.deepEqual(await remove(hidden), { result: "not_found", versions_removed: 0 });
    assert.deepEqual(await visible([hidden, kept]), [kept]);
    assert.deepEqual(await remove(kept), { result: "removed", versions_removed: 2 });
    assert.deepEqual(await visible([hidden, kept]), []);
    assert.ok(await snapshot(hidden));
    assert.equal(await restore(kept, await snapshot(kept)), null);
    const direct = await member((tx) => tx`update public.materials set deleted_at = null
      where id = ${kept} and family_id = ${familyId} returning id`);
    assert.equal(direct.length, 0, "ordinary direct writes still cannot edit protected materials");
    await assert.rejects(member(async (tx) => {
      await tx`select * from public.remove_family_material_chain(${familyId}, ${kept})`;
      await tx`select set_config('homa.material_collection_rpc', 'allowed', true)`;
      return await tx`update public.materials set status = 'final'
        where id = ${hidden} and family_id = ${familyId}`;
    }), /Use finalize_family_material/u);
  });

  it("revives only a new explicit restore row and lets later deletion defeat a stale restore", async () => {
    const root = await insert();
    const tip = await insert({ revises: root });
    await remove(tip);
    const expected = await snapshot(root);
    const restored = await restore(root, expected);
    assert.ok(restored);
    assert.deepEqual(await visible([root, tip, restored]), [restored]);
    assert.equal(await snapshot(root), expected);
    await remove(restored);
    assert.equal(await restore(root, expected), null);
    assert.deepEqual(await visible([root, tip, restored]), []);

    const pinned = await insertRestoredMaterialPinned({
      familyId, sourceMaterialId: root, expectedDeletedAt: await snapshot(root),
      pdfUrl: "https://example.test/pinned.pdf", previewUrl: "https://example.test/pinned.jpg",
      generation: {}, channel: "sms",
    });
    assert.ok(pinned);
    assert.deepEqual(await visible([root, tip, restored, pinned.id]), [pinned.id]);
    assert.equal(await insertRestoredMaterialPinned({
      familyId: otherFamilyId, sourceMaterialId: root, expectedDeletedAt: null,
      pdfUrl: "https://example.test/pinned.pdf", previewUrl: "https://example.test/pinned.jpg",
      generation: {}, channel: "sms",
    }), null);
  });

  it("serializes insertion before removal, so a just-created sibling is removed too", async () => {
    const root = await insert();
    const { promise: inserted, resolve: ready } = Promise.withResolvers<string>();
    const { promise: release, resolve: finish } = Promise.withResolvers<void>();
    const inserting = sql.begin(async (tx) => {
      const id = await insert({ revises: root }, tx);
      ready(id);
      await release;
      return id;
    });
    const revision = await inserted;
    const removing = remove(root);
    await waitForBlockedCollectionWrite();
    finish();
    await inserting;
    assert.equal((await removing).versions_removed, 2);
    assert.deepEqual(await visible([root, revision]), []);
  });

  it("serializes removal before insertion and rechecks the parent after waiting", async () => {
    const root = await insert();
    const { promise: removed, resolve: ready } = Promise.withResolvers<void>();
    const { promise: release, resolve: finish } = Promise.withResolvers<void>();
    const removing = member(async (tx) => {
      await tx`select * from public.remove_family_material_chain(${familyId}, ${root})`;
      ready();
      await release;
    });
    await removed;
    const inserting = insert({ revises: root });
    await waitForBlockedCollectionWrite();
    finish();
    await removing;
    const revision = await inserting;
    assert.equal(await snapshot(revision), await snapshot(root));
    assert.deepEqual(await visible([root, revision]), []);
  });

  it("does not deadlock against finalization and a keep never revives removed versions", async () => {
    const root = await insert();
    const tip = await insert({ revises: root });
    await Promise.all([
      remove(tip),
      member((tx) => tx`select * from public.finalize_family_material(${familyId}, ${tip})`),
    ]);
    assert.deepEqual(await visible([root, tip]), []);
    assert.ok(await snapshot(tip));
  });

  it("lets a queued removal include the new row from a concurrent restore", async () => {
    const root = await insert();
    await remove(root);
    const expected = await snapshot(root);
    const { promise: restored, resolve: ready } = Promise.withResolvers<string>();
    const { promise: release, resolve: finish } = Promise.withResolvers<void>();
    const restoring = member(async (tx) => {
      const rows = await tx<{ id: string }[]>`select public.restore_family_material_version(
        ${familyId}, ${root}, ${expected}::text::timestamptz, 'https://example.test/pdf',
        'https://example.test/preview', '{}'::jsonb) as id`;
      ready(rows[0].id);
      await release;
    });
    const id = await restored;
    const removing = remove(root);
    await waitForBlockedCollectionWrite();
    finish();
    await restoring;
    assert.equal((await removing).versions_removed, 1);
    assert.deepEqual(await visible([root, id]), []);
  });

  it("rejects a stale restore queued behind removal without inserting any row", async () => {
    const root = await insert();
    const { promise: removed, resolve: ready } = Promise.withResolvers<void>();
    const { promise: release, resolve: finish } = Promise.withResolvers<void>();
    const removing = member(async (tx) => {
      await tx`select * from public.remove_family_material_chain(${familyId}, ${root})`;
      ready();
      await release;
    });
    await removed;
    const restoring = restore(root, null);
    await waitForBlockedCollectionWrite();
    finish();
    await removing;
    assert.equal(await restoring, null);
    assert.equal((await sql`select id from public.materials where revises = ${root}`).length, 0);
  });
});
