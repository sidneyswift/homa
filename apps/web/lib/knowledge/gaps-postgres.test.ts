import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { after, before, beforeEach, describe, it } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

import postgres, { type Sql } from "postgres";
import ts from "typescript";

import {
  createDisposableResearchBriefPostgresHarness,
  familyAId,
  familyBId,
} from "../tasks/research-brief-postgres-harness";
import type * as GapModule from "./gaps";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const sourcePath = resolve(root, "apps/web/lib/knowledge/gaps.ts");
const source = readFileSync(sourcePath, "utf8");
const harness = createDisposableResearchBriefPostgresHarness("knowledge_gaps");
let database: Sql;
let locker: Sql;
let observer: Sql;
let clusterRoot: string;
let activeDatabase: unknown;

// Execute the actual source; only its adminDb dependency is replaced. No real
// admin module is loaded and no duplicate implementation/SQL drives this test.
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const fixtureModule = { exports: {} };
vm.runInNewContext(compiled, {
  module: fixtureModule,
  exports: fixtureModule.exports,
  require: (id: string) => {
    assert.equal(id, "../admin/db", "Only the database dependency may be substituted");
    return { adminDb: () => activeDatabase };
  },
}, { filename: sourcePath, timeout: 5_000 });
const gaps = fixtureModule.exports as typeof GapModule;

function localConnection(): Sql {
  const { host, port, database: name, user } = observer.options;
  assert.equal(host.length, 1);
  assert.match(host[0]!, /^\/tmp\/homa-research-brief-knowledge_gaps-[^/]+\/socket$/u);
  return postgres({
    host: host[0]!, port: port[0]!, database: name, user, max: 1, prepare: false, connect_timeout: 5,
    connection: { statement_timeout: 5_000, lock_timeout: 5_000 },
  });
}

describe("knowledge gap family provenance", { concurrency: false, timeout: 120_000 }, () => {
  before(async () => {
    for (const key of ["SUPABASE_DB_PASSWORD", "NEXT_PUBLIC_SUPABASE_URL", "VERCEL_OIDC_TOKEN", "AI_GATEWAY_API_KEY", "BLOB_READ_WRITE_TOKEN", "HOMA_EVAL_DATABASE_URL"]) {
      assert.equal(process.env[key], undefined, "Use the package command with its clean child environment");
    }
    await harness.start();
    observer = harness.database();
    clusterRoot = dirname(observer.options.host[0]!);
    const ddl = readFileSync(resolve(root, "supabase/migrations/20260716050000_knowledge_gaps.sql"), "utf8");
    await observer.unsafe(ddl);
    database = localConnection();
    locker = localConnection();
    activeDatabase = database;
    console.log(`knowledge gap source SHA256 ${createHash("sha256").update(source).digest("hex")}`);
  });
  beforeEach(async () => {
    activeDatabase = database;
    await database`truncate public.knowledge_gaps`;
  });
  after(async () => {
    await database?.end({ timeout: 1 });
    await locker?.end({ timeout: 1 });
    await harness.stop();
    if (clusterRoot) assert.equal(existsSync(clusterRoot), false, "Owned cluster was removed");
  });

  it("separates A, B and null ownership while retaining repeat provenance", async () => {
    const a = await gaps.logGap("Same topic", "A exact query", familyAId, "recall_miss");
    const b = await gaps.logGap("Same topic", "B exact query", familyBId, "recall_miss");
    const fleet = await gaps.logGap("Same topic", "Fleet exact query", null, "manual");
    assert.equal(new Set([a, b, fleet]).size, 3);
    assert.equal(await gaps.logGap("Same topic", "A repeat", familyAId, "signal"), a);
    assert.equal(await gaps.logGap("Same topic", "B repeat", familyBId, "signal"), b);
    assert.equal(await gaps.logGap("Same topic", "Fleet repeat", null, "signal"), fleet);
    const rows = await database`select id, family_id, query_text, source, research_priority from public.knowledge_gaps`;
    for (const [id, family, query, sourceKind] of [
      [a, familyAId, "A exact query", "recall_miss"],
      [b, familyBId, "B exact query", "recall_miss"],
      [fleet, null, "Fleet exact query", "manual"],
    ]) {
      const row = rows.find((candidate) => candidate.id === id);
      assert.deepEqual({ ...row }, { id, family_id: family, query_text: query, source: sourceKind, research_priority: 1 });
    }
  });

  it("keeps weighted fleet demand additive and erases only the selected family's origins", async () => {
    const a = await gaps.logGap("Same topic", "A", familyAId, "recall_miss");
    const b = await gaps.logGap("Same topic", "B", familyBId, "recall_miss");
    const fleet = await gaps.logGap("Same topic", "Fleet", null, "manual");
    await gaps.logGap("Same topic", "A again", familyAId, "recall_miss");
    const [aggregate] = await database`select count(*)::int as origins, sum(research_priority + 1)::int as demand from public.knowledge_gaps where status='open' and topic='Same topic'`;
    assert.deepEqual({ ...aggregate }, { origins: 3, demand: 4 });
    const report = await gaps.getGapReport();
    assert.equal(report.openGaps, 3);
    assert.equal(report.topTopics[0]?.topic, "Same topic");
    assert.equal(report.topTopics[0]?.count, 3);
    await database`delete from public.knowledge_gaps where family_id=${familyAId}`;
    const rows = await database`select id from public.knowledge_gaps`;
    assert.equal(rows.some((row) => row.id === a), false);
    assert.deepEqual(rows.map((row) => row.id).sort(), [b, fleet].sort());
  });

  it("creates a new same-family gap after the previous one closes", async () => {
    const first = await gaps.logGap("Closed topic", "First", familyAId, "recall_miss");
    await database`update public.knowledge_gaps set status='filled' where id=${first}`;
    const second = await gaps.logGap("Closed topic", "Second", familyAId, "recall_miss");
    assert.notEqual(second, first);
    const rows = await database`select id, query_text, status, research_priority from public.knowledge_gaps`;
    assert.equal(rows.find((row) => row.id === first)?.research_priority, 0);
    assert.equal(rows.find((row) => row.id === second)?.query_text, "Second");
    assert.equal((await gaps.getGapReport()).filledGaps, 1);
  });

  for (const kind of ["owner", "closed", "deleted"] as const) {
    it(`returns null after ${kind} changes between actual SELECT and UPDATE`, async () => {
      const id = await gaps.logGap("Race topic", "Retained original", familyAId, "recall_miss");
      let changed = false;
      activeDatabase = async (strings: TemplateStringsArray, ...values: unknown[]) => {
        const rows = await database(strings, ...values as never[]);
        if (!changed && strings.join("?").includes("select id::text")) {
          changed = true;
          if (kind === "owner") await locker`update public.knowledge_gaps set family_id=${familyBId} where id=${id}`;
          else if (kind === "closed") await locker`update public.knowledge_gaps set status='filled' where id=${id}`;
          else await locker`delete from public.knowledge_gaps where id=${id}`;
        }
        return rows;
      };
      const result = await gaps.logGap("Race topic", "Must not replace", familyAId, "recall_miss");
      activeDatabase = database;
      assert.equal(changed, true);
      assert.equal(result, null);
      const [row] = await database`select * from public.knowledge_gaps where id=${id}`;
      if (kind === "deleted") assert.equal(row, undefined);
      else {
        assert.equal(row?.research_priority, 0);
        assert.equal(row?.query_text, "Retained original");
      }
    });
  }

  for (const kind of ["family-to-family", "family-to-null", "null-to-family", "closed-under-lock"] as const) {
    it(`rechecks ${kind} after the UPDATE actually waits on a row lock`, async () => {
      const owner = kind === "null-to-family" ? null : familyAId;
      const id = await gaps.logGap("Blocked topic", "Retained original", owner, "recall_miss");
      const [{ pid }] = await database`select pg_backend_pid() as pid`;
      let acquired!: () => void;
      let release!: () => void;
      const locked = new Promise<void>((resolve) => { acquired = resolve; });
      const released = new Promise<void>((resolve) => { release = resolve; });
      const move = locker.begin(async (tx) => {
        await tx`select id from public.knowledge_gaps where id=${id} for update`;
        acquired();
        await released;
        if (kind === "closed-under-lock") await tx`update public.knowledge_gaps set status='researching' where id=${id}`;
        else await tx`update public.knowledge_gaps set family_id=${kind === "family-to-null" ? null : familyBId} where id=${id}`;
      });
      await Promise.race([locked, move.then(() => { throw new Error("Lock transaction ended before acquiring the fixture row"); })]);
      const operation = gaps.logGap("Blocked topic", "Must not replace", owner, "recall_miss");
      let blocked = false;
      try {
        for (let attempt = 0; attempt < 150; attempt++) {
          const [state] = await observer`select wait_event_type, query from pg_stat_activity where pid=${pid}`;
          if (state?.wait_event_type === "Lock" && state.query.trimStart().startsWith("update public.knowledge_gaps")) {
            blocked = true;
            break;
          }
          await delay(10);
        }
      } finally { release(); }
      await move;
      const result = await operation;
      assert.equal(blocked, true, "The actual logGap UPDATE was observed waiting on the held row lock");
      assert.equal(result, null);
      const [row] = await database`select * from public.knowledge_gaps where id=${id}`;
      assert.equal(row?.research_priority, 0);
      assert.equal(row?.query_text, "Retained original");
      assert.equal(row?.family_id, kind === "closed-under-lock" ? owner : kind === "family-to-null" ? null : familyBId);
      assert.equal(row?.status, kind === "closed-under-lock" ? "researching" : "open");
    });
  }
});
