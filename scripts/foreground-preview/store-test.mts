import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { createTurnStore, PreviewConflict, PreviewNotFound, TurnNoLongerActive } from "../../apps/web/lib/foreground-preview/store";

const require = createRequire(resolve("apps/web/package.json"));
const postgres = require("postgres");
const bin = "/opt/homebrew/opt/postgresql@17/bin";
const root = await mkdtemp(join(tmpdir(), "homa-foreground-pg-"));
const data = join(root, "data"), socket = join(root, "socket");
await mkdir(socket);
const run = (name: string, args: string[]) => execFileSync(join(bin, name), args, { stdio: "pipe" });
run("initdb", ["-D", data, "-U", "preview_test", "-A", "trust", "--no-locale", "-E", "UTF8"]);
let sql: ReturnType<typeof postgres> | undefined;
try {
  run("pg_ctl", ["-D", data, "-l", join(root, "postgres.log"), "-o", `-k ${socket} -p 25491 -c listen_addresses=''`, "start"]);
  sql = postgres({ host: socket, port: 25491, database: "postgres", username: "preview_test", max: 5 });
  await sql.unsafe("create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create table public.families(id uuid primary key);");
  await sql.unsafe(await readFile("scripts/foreground-preview/schema.sql", "utf8"));
  const a = { familyId: randomUUID(), userId: randomUUID() }, b = { familyId: randomUUID(), userId: randomUUID() };
  for (const owner of [a,b]) { await sql`insert into public.families values(${owner.familyId}::uuid)`; await sql`insert into auth.users values(${owner.userId}::uuid)`; }
  const store = createTurnStore(sql);
  const session = randomUUID(), id = randomUUID();
  const claims = await Promise.all([store.accept(a,session,id,"Hello"),store.accept(a,session,id,"Hello")]);
  assert.equal(claims.filter(x=>x.claimed).length,1);
  const turn = claims[0].turn;
  await assert.rejects(store.accept(a,session,id,"Different"),PreviewConflict);
  await assert.rejects(store.accept(b,session,randomUUID(),"Other family"),PreviewNotFound);
  assert.equal((await store.read(b,session)).length,0);
  assert.equal(await store.cancel(b,session,id),false);
  assert.equal(await store.start(a,turn),true); assert.equal(await store.start(a,turn),false);
  await assert.rejects(store.accept(a,session,randomUUID(),"Concurrent answer"),PreviewConflict);
  await store.append(a,turn,{type:"reasoning-delta",text:"hidden"});
  await store.append(a,turn,{type:"text-delta",text:"Saved "},"Saved ");
  await store.append(a,turn,{type:"text-delta",text:"answer"},"answer");
  const saved = (await store.read(a,session))[0]; assert.equal(saved.answer,"Saved answer"); assert.equal(saved.event_sequence,3);
  const events = await sql`select event from homa_fg_1171_20260914.events where turn_id=${id}::uuid order by sequence`;
  assert.equal(events.length,4); assert.equal(events[1].event.text,"hidden");
  assert.equal(await store.cancel(a,session,id),true);
  await assert.rejects(store.append(a,turn,{type:"text-delta",text:" late"}," late"),TurnNoLongerActive);
  await store.finish(a,turn,"completed"); assert.equal((await store.read(a,session))[0].status,"cancelled");
  assert.equal((await store.accept(a,session,id,"Hello")).claimed,false);
  const next = (await store.accept(a,session,randomUUID(),"Try again" )).turn;
  await store.start(a,next); await store.append(a,next,{type:"text-delta",text:"Partial"},"Partial");
  await sql`update homa_fg_1171_20260914.turns set heartbeat_at=now()-interval '25 seconds' where id=${next.id}::uuid`;
  const recovered = (await store.read(a,session)).find(x=>x.id===next.id)!;
  assert.equal(recovered.status,"interrupted"); assert.equal(recovered.answer,"Partial");
  assert.equal(await store.heartbeat(a,next),false);
  await assert.rejects(store.append(a,next,{type:"text-delta",text:"stale"},"stale"),TurnNoLongerActive);
  await assert.rejects(sql.begin(async (tx: any)=>{await tx.unsafe('set local role authenticated');await tx.unsafe('select * from homa_fg_1171_20260914.turns');}), /permission denied/);
  console.log(JSON.stringify({tests:["concurrent duplicate admission","request identity conflict","cross-family session denial","cross-family read and cancel denial","single worker start","one active answer","exact event durability","reasoning stays outside visible answer","cancellation fence","completed cannot overwrite cancellation","no automatic rerun","partial recovery after stale worker","stale worker fence","SQL role denial"],passed:14}));
} finally {
  if (sql) await sql.end({timeout:3});
  run("pg_ctl",["-D",data,"-m","fast","stop"]);
}
