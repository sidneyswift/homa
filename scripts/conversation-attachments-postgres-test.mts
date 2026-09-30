import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { realpathSync } from "node:fs";
import path from "node:path";

import { recordConversationContent } from "../apps/web/lib/conversation-recording";
import { mapDb } from "../apps/web/lib/map/db";
import { EVAL_FIXTURE_FAMILY_ID, EVAL_FIXTURE_PARENT_USER_ID } from "../apps/web/lib/family-context-eval-fixture";
import { acceptConversationRequest,readConversationAccess,leaseConversationRequest,claimConversationExecution,
  authorizeConversationRequest } from "../apps/web/lib/conversation-requests";
import { storeConversationAttachmentPreparation,loadConversationRuntimeInputInTransaction,loadConversationDispatchInput } from "../apps/web/lib/conversation-attachments";

assert(process.env.HOMA_EVAL_DATABASE_URL && process.env.HOMA_EVAL_BLOB_DIR);
assert(!process.env.VERCEL && process.env.HOMA_EVAL_ALLOW_PROD_WRITES !== "1");
const sql=mapDb();
await sql`update public.conversation_rebuild_settings set enabled = true`; // gh#1158: these suites exercise the rebuild itself.
process.env.HOMA_CONVERSATION_RECORDING ??= "1"; // exact-text recording is part of the rebuild under test.
try {
  const [target]=await sql`select current_setting('data_directory') as directory,host(inet_server_addr()) as address,current_database() as database,current_user as owner`;
  const root=path.dirname(realpathSync(process.env.HOMA_EVAL_BLOB_DIR!));
  assert.equal(target.database,"homa_eval");assert.equal(target.owner,"homa_eval");
  assert.match(path.basename(root),/^homa-eval-sandbox-/u);assert.equal(realpathSync(target.directory),path.join(root,"data"));
  assert([null,"127.0.0.1","::1"].includes(target.address));
  const base={familyId:EVAL_FIXTURE_FAMILY_ID,memberUserId:EVAL_FIXTURE_PARENT_USER_ID};
  const principal={...base,...await readConversationAccess(base)};
  const url=`https://example.private.blob.vercel-storage.com/families/${base.familyId}/chat/worksheet-${randomUUID()}.pdf`;
  const item={input:{url,mediaType:"application/pdf",name:"worksheet.pdf"},kind:"document" as const,outcome:"model_native" as const,
    caption:"worksheet.pdf",block:null,marker:`[File attached · worksheet.pdf · ${url}]`,
    part:{type:"file" as const,data:"https://temporary.example/expired",mediaType:"application/pdf",filename:"worksheet.pdf"}};
  const prepared=await Promise.all(Array.from({length:6},()=>storeConversationAttachmentPreparation({...base,childId:null,item})));
  assert.equal(new Set(prepared.map(row=>row.id)).size,1);
  const id=prepared[0].id;
  assert.equal((await sql`select id from public.chat_attachments where url=${url}`).length,1);
  assert(!JSON.stringify((await sql`select payload from public.conversation_attachment_preparations where attachment_id=${id}`)[0]).includes("expired"));
  const otherUser=randomUUID();
  await sql`insert into auth.users(id,email) values (${otherUser},${`${otherUser}@example.test`})`;
  await sql`insert into public.family_members(family_id,user_id) values (${base.familyId},${otherUser})`;
  const other={familyId:base.familyId,memberUserId:otherUser,...await readConversationAccess({familyId:base.familyId,memberUserId:otherUser})};
  await assert.rejects(acceptConversationRequest(other,{intentId:randomUUID(),text:"",attachmentIds:[id]}),/missing/);
  const intentId=randomUUID();
  const accepted=await acceptConversationRequest(principal,{intentId,text:"",attachmentIds:[id]});
  assert.equal((await acceptConversationRequest(principal,{intentId,text:"",attachmentIds:[id]})).requestId,accepted.requestId);
  await assert.rejects(acceptConversationRequest(principal,{intentId,text:"different",attachmentIds:[id]}),/conflict/);
  assert.equal((await sql`select content from public.conversation_messages where id=${accepted.messageId}`)[0].content,"");
  const lease=await leaseConversationRequest(principal);assert.equal(lease.kind,"leased");if(lease.kind!=="leased")throw new Error();
  const signatures:string[]=[];
  const outgoing=await loadConversationDispatchInput(principal,accepted.requestId,lease.leaseToken,"",async source=>{signatures.push(source);return "https://fresh.example/signed";});
  assert(Array.isArray(outgoing));assert.deepEqual(signatures,[url]);
  assert.equal(outgoing.find(part=>part.type==="file")?.data,"https://fresh.example/signed");
  const runtime=await sql.begin(tx=>loadConversationRuntimeInputInTransaction(tx,principal,accepted.requestId,""));
  const execution={requestId:accepted.requestId,leaseToken:lease.leaseToken,sessionId:`attachment-${randomUUID()}`,turnId:"turn_0",sequence:0};
  await assert.rejects(claimConversationExecution(principal,execution,""),/conflict/);
  assert.equal((await claimConversationExecution(principal,execution,runtime.summary)).text,"");
  await authorizeConversationRequest(principal,{...execution,phase:"execute"});
  await recordConversationContent(principal,execution.sessionId,{type:"message.received",data:{message:runtime.summary,sequence:0,turnId:"turn_0"}},0);
  await sql`delete from public.chat_attachments where id=${id}`;
  assert.equal((await sql`select content from public.conversation_record_events where source_session_id=${execution.sessionId}`).length,0);
  await assert.rejects(recordConversationContent(principal,execution.sessionId,{type:"message.received",data:{message:runtime.summary,sequence:0,turnId:"turn_0"}},0),/deleted/);
  await assert.rejects(authorizeConversationRequest(principal,{...execution,phase:"execute"}),/execution/);
  await assert.rejects(sql.begin(tx=>loadConversationRuntimeInputInTransaction(tx,principal,accepted.requestId,"")),/erased/);
  await sql`delete from public.conversation_messages where id=${accepted.messageId}`;
  assert.equal((await sql`select request_id from public.conversation_request_attachments where request_id=${accepted.requestId}`).length,0);
  await assert.rejects(acceptConversationRequest(principal,{intentId,text:"",attachmentIds:[id]}),/deleted/);
  for(const table of ["conversation_attachment_preparations","conversation_request_attachments"]){
    await assert.rejects(sql.begin(async tx=>{await tx`set local role authenticated`;await tx.unsafe(`select * from public.${table}`);}),/permission denied/);
  }
  console.log("PASS attachment preparation retry, ordered receipts, adult isolation, exact empty text, fresh native parts, erased-file access and input erasure");
}finally{await sql.end({timeout:5});}
