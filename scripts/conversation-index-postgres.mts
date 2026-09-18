import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mapDb } from "../apps/web/lib/map/db";
import { persistConversationMessage } from "../apps/web/lib/conversation-log";
import { conversationIndexDependencies as deps, sweepConversationIndex } from "../apps/web/lib/learning/conversation-index";

const url=process.env.HOMA_EVAL_DATABASE_URL;
assert.ok(url && ["localhost","127.0.0.1"].includes(new URL(url).hostname), "Disposable database required");
const sql=mapDb();
try {
 const [member]=await sql`select family_id,user_id from public.family_members limit 1`;
 assert.ok(member);
 const input={attributes:{familyId:member.family_id,memberUserId:member.user_id},sessionId:`index-test-${randomUUID()}`,channelKind:"eve",sequence:1,role:"user" as const,content:"A saved message awaiting search indexing.",turnId:"turn_0",deferSemanticIndex:true};
 const message=await persistConversationMessage(input);
 assert.ok(message);
 const [saved]=await sql`select content,embedding,embedding_retry_at from public.conversation_messages where id=${message.id} and family_id=${member.family_id}`;
 assert.equal(saved.content,input.content);assert.equal(saved.embedding,null);assert.ok(saved.embedding_retry_at);
 const [first,second]=await Promise.all([deps.claim(),deps.claim()]);
 assert.equal([...first,...second].filter(m=>m.id===message.id).length,1,"One worker claims the message");
 assert.equal((await deps.claim()).some(m=>m.id===message.id),false,"Crash lease blocks premature duplicate claim");
 await sql`update public.conversation_messages set embedding_retry_at=now()-interval '1 second' where id=${message.id} and family_id=${member.family_id}`;
 const failed=await sweepConversationIndex({...deps,embed:async()=>null});assert.equal(failed.retry,1);
 const [pending]=await sql`select embedding_retry_at from public.conversation_messages where id=${message.id} and family_id=${member.family_id}`;assert.ok(pending.embedding_retry_at);
 await sql`update public.conversation_messages set embedding_retry_at=now()-interval '1 second' where id=${message.id} and family_id=${member.family_id}`;
 const vector=JSON.stringify(Array.from({length:1536},(_,i)=>i===0?1:0));
 const success=await sweepConversationIndex({...deps,embed:async()=>vector});assert.equal(success.completed,1);
 const [indexed]=await sql`select embedding is not null as indexed,embedding_retry_at from public.conversation_messages where id=${message.id} and family_id=${member.family_id}`;assert.equal(indexed.indexed,true);assert.equal(indexed.embedding_retry_at,null);
 const claimed={id:message.id,family_id:randomUUID(),content:input.content,embedding:null};
 await deps.finish(claimed,JSON.stringify(Array(1536).fill(0)));
 const [unchanged]=await sql`select embedding::text from public.conversation_messages where id=${message.id} and family_id=${member.family_id}`;assert.equal(unchanged.embedding,vector,"Wrong family cannot overwrite vector");
 await persistConversationMessage(input);
 assert.equal((await deps.claim()).length,0,"Replay does not requeue completed message");
 console.log("PASS: atomic save/queue, exclusive claims, crash lease, retry, completion, tenant scope, replay");
} finally {await sql.end();}
