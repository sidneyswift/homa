/** No model calls. Run only in the disposable eval sandbox. */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";


const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const require=createRequire(join(root,"package.json"));
const {build}=require(require.resolve("esbuild",{paths:[require.resolve("tsx")]}));
const scratch=await mkdtemp("/tmp/homa-capture-behavior-contract-");
const nativeFetch=globalThis.fetch;
globalThis.fetch=async()=>{throw new Error("No network/provider fetch is authorized in this contract");};
let provider =()=>{throw new Error("Unexpected model invocation");};
const injected=globalThis;
injected.__captureContractGenerate=request=>provider(request);
const providerSeam={name:"offline-provider-only",setup(b){
  b.onResolve({filter:/^ai$/},()=>({path:"offline-ai",namespace:"fixture"}));
  b.onLoad({filter:/.*/,namespace:"fixture"},()=>({loader:"js",contents:`
    export async function generateObject(request){return globalThis.__captureContractGenerate(request);}
    export async function generateText(){throw new Error('No behavior model call in deterministic contract');}
    export const stepCountIs=()=>()=>true;
    export const tool=value=>value;
  `}));
}};
let close,assertions=0;
try{
  const output=await build({absWorkingDir:root,stdin:{contents:`export * from './apps/web/evals/progress-capture/behavior-harness.ts';export {mapDb} from './apps/web/lib/map/db.ts';`,resolveDir:root,loader:"ts"},bundle:true,write:false,platform:"node",format:"esm",target:"node24",packages:"external",plugins:[providerSeam],alias:{"@homa/core":join(root,"packages/core/src/index.ts"),"@homa/taxonomy/progress":join(root,"packages/taxonomy/src/progress.ts")}});
  // External runtime packages resolve from the actual repository dependency root.
  // Repository writes are unnecessary: put the compiled module in the owned tmp
  // directory and resolve externals with a narrow dependency symlink instead.
  const compiled=join(scratch,"contract.mjs");
  await symlink(join(root,"apps/web/node_modules"),join(scratch,"node_modules"),"dir");
  await writeFile(compiled,output.outputFiles[0].contents);
  const h=await import(pathToFileURL(compiled).href);
  h.assertCaptureSandbox();close=async()=>{await h.mapDb().end({timeout:1});};
  // These refusal checks happen before a database client is opened.
  const rejectedEnvironments = [
    ["HOMA_EVAL_DATABASE_URL", "postgres://homa_eval@example.invalid/homa_eval"],
    ["HOMA_EVAL_DATABASE_URL", "postgres://other@127.0.0.1:5432/homa_eval"],
    ["HOMA_EVAL_DATABASE_URL", "postgres://homa_eval@127.0.0.1:5432/other"],
    ["HOMA_EVAL_ISOLATION", "0"], ["HOMA_EVAL_ALLOW_PROD_WRITES", "1"],
    ["VERCEL", "1"], ["SUPABASE_DB_PASSWORD", "offline-sentinel"],
    ["HOMA_LIVE_PROGRESS_ENABLED", "false"], ["HOMA_CLAIM_EXTRACTION_ENABLED", "false"],
  ];
  for (const [key,value] of rejectedEnvironments) {
    const previous=process.env[key];process.env[key]=value;
    try {assert.throws(()=>h.assertCaptureSandbox());}
    finally {if(previous===undefined)delete process.env[key];else process.env[key]=previous;}
  }

  for(const name of ["named","decline","contextual"]){
    const fixture=await h.createCaptureBehaviorFixture(name);let calls=0;
    provider=request=>{
      assert.equal(++calls,1);assert.equal(request.maxRetries,1);
      assert.ok(request.prompt.includes(fixture.scenario.message));
      assert.ok(request.prompt.includes(fixture.childId)&&request.prompt.includes(fixture.siblingId));
      if(fixture.previous)assert.ok(request.prompt.includes(fixture.previous.messageId)&&request.prompt.includes(fixture.previous.text));
      return {object:{claims:[{childId:fixture.childId,itemId:fixture.scenario.itemId,answer:fixture.scenario.answer,quote:fixture.scenario.message,confidence:"high"}]},usage:{inputTokens:1,outputTokens:1}};
    };
    const result=await fixture.execute({action:"record_journal_evidence",childId:fixture.childId});
    const durable=await fixture.durableReceipt();
    h.assertCaptureSaved(fixture,durable,result);assert.equal(calls,1);
    const receipt={fixture,durable,calls:[{name:"load_skill",input:{}},{name:"manage_child_progress",input:{},output:result}]};
    h.assertCaptureBehavior(receipt);
    assert.throws(()=>h.assertCaptureBehavior({...receipt,calls:[...receipt.calls,{name:"manage_child_progress",input:{action:"start_check_in"},error:"Error"}]}));
    assert.throws(()=>h.assertCaptureBehavior({...receipt,calls:[receipt.calls[0],{...receipt.calls[1],error:"Error"}]}));
    assertions++;
  }
  for(const mode of ["provider-failure","invalid-quote"]){
    const fixture=await h.createCaptureBehaviorFixture("decline");let calls=0;
    provider=()=>{calls++;if(mode==="provider-failure")throw new Error("Synthetic provider outage");return {object:{claims:[{childId:fixture.childId,itemId:fixture.scenario.itemId,answer:fixture.scenario.answer,quote:"Not the parent's words",confidence:"high"}]},usage:{inputTokens:1,outputTokens:1}};};
    const result=await fixture.execute({action:"record_journal_evidence",childId:fixture.childId});
    const rows=await fixture.durableReceipt();
    assert.equal(calls,1);assert.equal(rows.evidence.length,0);assert.equal(rows.observations.length,1);
    assert.equal(rows.observations[0]?.quote,fixture.scenario.message);assert.equal(rows.observations[0]?.message_id,fixture.inboundMessageId);
    assert.throws(()=>h.assertCaptureSaved(fixture,rows,result));assertions++;
  }
  const missing=await h.createCaptureBehaviorFixture("named");missing.context.canonicalInboundText=null;
  provider=()=>{throw new Error("Missing provenance must refuse before model extraction");};
  const refused=await missing.execute({action:"record_journal_evidence",childId:missing.childId});
  assert.equal(refused.kind,"refused");assert.equal((await missing.durableReceipt()).operations.length,0);assertions++;
  const revoked=await h.createCaptureBehaviorFixture("named");
  await h.mapDb()`delete from public.family_members where family_id=${revoked.familyId} and user_id=${revoked.memberUserId}`;
  provider=()=>({object:{claims:[{childId:revoked.childId,itemId:revoked.scenario.itemId,answer:revoked.scenario.answer,quote:revoked.scenario.message,confidence:"high"}]},usage:{inputTokens:1,outputTokens:1}});
  const denied=await revoked.execute({action:"record_journal_evidence",childId:revoked.childId});
  const state=await revoked.durableReceipt();assert.equal(state.evidence.length,0);assert.equal(state.operations.length,0);assert.throws(()=>h.assertCaptureSaved(revoked,state,denied));assertions++;
  const source=await readFile(join(root,"apps/web/lib/child-progress/claim-extraction.ts"),"utf8");
  assert.ok(source.includes("await generateObject(buildClaimExtractionRequest(input))"));
  console.log(JSON.stringify({passed:assertions,refusedEnvironments:rejectedEnvironments.length,modelCalls:0,providerSeam:"Only ai.generateObject substituted; actual extraction catches, journal capture, validator, adapter, service and SQL remain",fixtures:"7 dedicated local families; canonical eval sandbox owns cluster disposal"}));
}finally{
  await close?.();delete injected.__captureContractGenerate;globalThis.fetch=nativeFetch;await rm(scratch,{recursive:true,force:true});
}
