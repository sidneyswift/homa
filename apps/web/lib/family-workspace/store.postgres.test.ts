import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after } from "node:test";

import { mapDb } from "../map/db";
import { foldStubFamilyIntoTx } from "../family-fold";
import { workspaceHash } from "./contract";
import { getWorkspaceFile, listWorkspaceFiles, markWorkspaceFileDeleted, moveWorkspaceFile, saveWorkspaceFile } from "./store";

const databaseUrl = process.env.HOMA_EVAL_DATABASE_URL;
after(async () => { if (databaseUrl) await mapDb().end({ timeout: 5 }); });

test("real workspace SQL isolates families, serializes edits and quota, and refuses unsafe folds", { skip: !databaseUrl }, async () => {
  const sql = mapDb();
  const family = randomUUID();
  const other = randomUUID();
  await sql`insert into public.families (id, name, sandbox) values (${family}, 'Drive fixture', true), (${other}, 'Other fixture', true)`;
  const makeFile = (path = "drafts/a.md") => ({ id: randomUUID(), path, revision: randomUUID(), sha256: workspaceHash(Buffer.from("test")), byte_size: 4, blob_url: "https://fixture.invalid/checkpoint" });
  const file = makeFile();
  assert.equal(await saveWorkspaceFile(family, "production", file, null), true);
  assert.equal((await getWorkspaceFile(family, "production", file.path))?.revision, file.revision);
  assert.equal(await getWorkspaceFile(other, "production", file.path), null);
  assert.equal((await listWorkspaceFiles(family, "preview")).length, 0);
  assert.equal(await moveWorkspaceFile(other, "production", file.path, "drafts/stolen.md", file.revision), false);
  assert.equal(await markWorkspaceFileDeleted(other, "production", file.path, file.revision), false);
  assert.equal(await saveWorkspaceFile(other, "production", { ...makeFile(), path: file.path }, file.revision), false);
  const versions = [{ ...file, revision: randomUUID() }, { ...file, revision: randomUUID() }];
  const results = await Promise.all(versions.map((version) => saveWorkspaceFile(family, "production", version, file.revision)));
  assert.equal(results.filter(Boolean).length, 1, "only one concurrent edit wins");
  const current = (await getWorkspaceFile(family, "production", file.path))!;
  assert.equal(await moveWorkspaceFile(family, "production", file.path, "drafts/renamed.md", current.revision), true);
  assert.equal(await getWorkspaceFile(family, "production", file.path), null);
  assert.equal(await markWorkspaceFileDeleted(family, "production", "drafts/renamed.md", current.revision), true);
  assert.equal((await listWorkspaceFiles(family, "production")).length, 0);
  assert.equal(await sql.begin((tx) => foldStubFamilyIntoTx(tx, family, other)), false, "even a tombstoned workspace blocks a stub fold");
  const restored = { ...current, path: "drafts/renamed.md", revision: randomUUID() };
  assert.equal(await saveWorkspaceFile(family, "production", restored, null), true);
  for (let i = 0; i < 98; i++) assert.equal(await saveWorkspaceFile(family, "production", makeFile(`drafts/quota-${i}.md`), null), true);
  const quotaRace = await Promise.all(["left", "right"].map((name) => saveWorkspaceFile(family, "production", makeFile(`drafts/${name}.md`), null)));
  assert.equal(quotaRace.filter(Boolean).length, 1);
  assert.equal((await listWorkspaceFiles(family, "production")).length, 100);
  // Browser and anonymous roles have neither table privileges nor permissive RLS.
  for (const role of ["authenticated", "anon"]) {
    await assert.rejects(sql.begin(async (tx) => {
      await tx.unsafe(`set local role ${role}`);
      await tx`select * from public.family_workspace_files`;
    }), /permission denied/);
  }
});
