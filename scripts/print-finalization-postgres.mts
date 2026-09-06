import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { checkMaterialTitleSearch } from "../apps/web/lib/materials/library-search-postgres-contract";
import { finalizeMaterialInTransaction } from "../apps/web/lib/materials/library";
import { EVAL_FIXTURE_FAMILY_ID as familyId, EVAL_FIXTURE_PARENT_USER_ID as userId } from "../apps/web/lib/family-context-eval-fixture";

const databaseUrl = process.env.HOMA_EVAL_DATABASE_URL;
if (!databaseUrl || !["127.0.0.1", "localhost"].includes(new URL(databaseUrl).hostname)) throw new Error("Use the disposable eval:sandbox database only");
const sql = postgres(databaseUrl, { max: 6, prepare: false });
const checks: string[] = [];
const foreignFamily = randomUUID();
const check = (name: string, value: boolean) => { assert.ok(value, name); checks.push(name); };
async function seed(id: string, revises: string | null = null, family = familyId, review: boolean | null = true, created = "2026-09-06T12:00:00.000Z") {
  await sql`insert into public.materials(id,family_id,title,pdf_url,preview_url,html,channel,kind,source,status,revises,generation,created_at)
    values(${id},${family},'Synthetic print race','fixture:pdf','fixture:preview','<div class="page">Synthetic</div>','web','worksheet','html','draft',${revises},${sql.json({ pageCount:1,pageRoles:["child"],review:{pass:review} })},${created})`;
}
async function caller(id: string, selectedFamily = familyId, enforce = true) {
  return await sql.begin(async (tx) => {
    await tx`select set_config('request.jwt.claim.sub', ${userId}, true)`;
    await tx`set local role authenticated`;
    return enforce ? await tx`select * from public.finalize_family_material(${selectedFamily}::uuid, ${id}::uuid, true)` : await tx`select * from public.finalize_family_material(${selectedFamily}::uuid, ${id}::uuid)`;
  });
}
async function pinned(id: string) {
  return await sql.begin((tx) => finalizeMaterialInTransaction(tx, familyId, id, true, { requireCurrentVisible: true }));
}
async function waitForLock(pid: number) {
  const deadline = Date.now()+5000;
  while (Date.now()<deadline) {
    const [row] = await sql`select wait_event_type from pg_stat_activity where pid=${pid}`;
    if(row?.wait_event_type==="Lock")return;
    await new Promise(resolve=>setTimeout(resolve,10));
  }
  throw new Error("Finalizer did not enter the coordinated lock wait");
}
try {
  await sql`insert into public.families(id,name,sandbox) values(${foreignFamily},'Synthetic foreign print fixture',true)`;
  checks.push(...await checkMaterialTitleSearch({ sql, familyId, userId, foreignFamilyId: foreignFamily }));
  for (const adapter of ["caller","pinned"] as const) {
    const oldId=randomUUID(), newId=randomUUID(); await seed(oldId);await seed(newId,oldId,familyId,true,"2026-09-06T12:01:00Z");
    const stale=adapter==="caller" ? (await caller(oldId))[0]?.finalized : (await pinned(oldId)).result.finalized;
    check(`${adapter}: old draft refuses`,stale===false);
    const current=adapter==="caller" ? (await caller(newId))[0]?.finalized : (await pinned(newId)).result.finalized;
    check(`${adapter}: exact current draft finalizes`,current===true);
    const [after]=await sql`select status from public.materials where id=${oldId}`;check(`${adapter}: earlier draft superseded only by valid finalization`,after.status==="superseded");
    const replay=adapter==="caller" ? (await caller(newId))[0]?.transitioned : (await pinned(newId)).result.transitioned;check(`${adapter}: replay has no transition`,replay===false);
  }
  for (const adapter of ["caller","pinned"] as const) {
    const finalize = async (id: string) => adapter === "caller" ? (await caller(id))[0]?.finalized : (await pinned(id)).result.finalized;
    const failedOld=randomUUID(), failedNew=randomUUID(); await seed(failedOld); await seed(failedNew,failedOld,familyId,false,"2026-09-06T12:03:00Z");
    check(`${adapter}: failed-review newer draft is excluded`,await finalize(failedOld)===true);
    const finalId=randomUUID(), draftId=randomUUID();await seed(finalId);await finalize(finalId);await seed(draftId,finalId,familyId,true,"2026-09-06T12:03:00Z");
    check(`${adapter}: older final is stale while a newer passing draft exists`,await finalize(finalId)===false);
    check(`${adapter}: exact passing revision of a final can be approved`,await finalize(draftId)===true);
    const [revised] = await sql`select status from public.materials where id=${finalId}`;
    check(`${adapter}: approving the revision supersedes its old final`,revised.status === "superseded");
    const keptId=randomUUID(), failedDraftId=randomUUID();await seed(keptId);await finalize(keptId);
    await seed(failedDraftId,keptId,familyId,false,"2026-09-06T12:03:00Z");
    await sql`update public.materials set generation=jsonb_set(generation,'{review,pass}','false'::jsonb) where id=${keptId}`;
    check(`${adapter}: newer failed draft does not hide a historically kept final`,await finalize(keptId)===true);
    check(`${adapter}: failed draft cannot become current approval target`,await finalize(failedDraftId)===false);
    const [low,high]=[randomUUID(),randomUUID()].sort();await seed(high,null,familyId,true,"2026-09-06T12:00:00.123100Z");await seed(low,high,familyId,true,"2026-09-06T12:00:00.123900Z");
    check(`${adapter}: millisecond timestamp tie uses the UUID ordering`,await finalize(high)===true);
  }
  for (const adapter of ["caller", "pinned"] as const) {
    const finalize = async (id: string) => adapter === "caller" ? (await caller(id))[0]?.finalized : (await pinned(id)).result.finalized;
    const ancestor = randomUUID(), intermediate = randomUUID(), descendant = randomUUID();
    await seed(ancestor); await finalize(ancestor);
    await seed(intermediate,ancestor,familyId,false,"2026-09-06T12:01:00Z");
    await seed(descendant,intermediate,familyId,null,"2026-09-06T12:02:00Z");
    check(`${adapter}: unknown-review descendant through a failed attempt remains eligible`,await finalize(descendant)===true);
    const cyclic = randomUUID(); await seed(cyclic);
    await sql`update public.materials set revises=${cyclic} where id=${cyclic}`;
    check(`${adapter}: malformed cyclic lineage still refuses`,await finalize(cyclic)===false);
  }
  const historical=randomUUID(), newer=randomUUID(); await seed(historical);await seed(newer,historical,familyId,true,"2026-09-06T12:01:00Z");
  check("ordinary two-argument Keep retains explicit older-version behavior",(await caller(historical,familyId,false))[0]?.finalized===true);
  const foreign=randomUUID();await seed(foreign,null,foreignFamily);
  check("foreign ID cannot finalize under caller family",(await caller(foreign))[0]?.finalized===false);
  check("foreign ID cannot finalize under pinned family",(await pinned(foreign)).result.finalized===false);
  await assert.rejects(caller(foreign,foreignFamily));check("foreign family parameter rejects authenticated caller",true);
  // A newer draft commits while each adapter is blocked acquiring the old
  // parent's lock. A stale first SELECT snapshot must not hide the new row.
  for (const adapter of ["caller","pinned"] as const) {
    const oldId=randomUUID(), newId=randomUUID();await seed(oldId);
    let blockerReady!:()=>void, unblock!:()=>void;
    const ready=new Promise<void>(resolve=>{blockerReady=resolve});const release=new Promise<void>(resolve=>{unblock=resolve});
    const blocker=sql.begin(async(tx)=>{
      await tx`insert into public.materials(id,family_id,title,pdf_url,preview_url,html,channel,kind,source,status,revises,generation,created_at)
        values(${newId},${familyId},'Synthetic concurrent revision','fixture:pdf','fixture:preview','<div class="page">Synthetic</div>','web','worksheet','html','draft',${oldId},'{"pageCount":1,"pageRoles":["child"],"review":{"pass":true}}'::jsonb,'2026-09-06T12:02:00Z')`;
      blockerReady();await release;
    });await ready;
    let finalizerPid=0, finalizerStarted!:()=>void;
    const started=new Promise<void>(resolve=>{finalizerStarted=resolve});
    const work=sql.begin(async(tx)=>{
      const [pid]=await tx`select pg_backend_pid() as pid`;finalizerPid=pid.pid;finalizerStarted();
      if(adapter==="pinned")return (await finalizeMaterialInTransaction(tx,familyId,oldId,true,{requireCurrentVisible:true})).result.finalized;
      await tx`select set_config('request.jwt.claim.sub', ${userId}, true)`;await tx`set local role authenticated`;
      const [row]=await tx`select * from public.finalize_family_material(${familyId}::uuid,${oldId}::uuid,true)`;return row.finalized;
    });
    await started;await waitForLock(finalizerPid);
    // Commit the real insertion after the finalizer's first snapshot started.
    // Its FK held KEY SHARE on the parent; FOR UPDATE was observed waiting.
    unblock();await blocker;
    check(`${adapter}: concurrent newer draft causes atomic refusal`,await work===false);
    const rows=await sql`select id,status from public.materials where id in (${oldId},${newId})`;
    check(`${adapter}: refused race changes neither draft`,rows.every(row=>row.status==="draft"));
  }
  console.log(JSON.stringify({ passed:checks.length,checks,scope:"Disposable local PostgreSQL, all real migrations and actual caller RPC/pinned transaction primitive. No provider or production calls."},null,2));
} finally { await sql.end({timeout:5}); }
