import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { Script } from "node:vm";
import test from "node:test";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { abilityQuestion } from "./ability-question";
import { findAbilitiesExplorerAbility } from "./abilities-explorer";

const require = createRequire(import.meta.url);
const esbuild = require(require.resolve("esbuild", { paths: [require.resolve("tsx")] })) as { build(options: Record<string, unknown>): Promise<{ outputFiles: { text: string }[] }> };
const CHILD = "11111111-1111-4111-8111-111111111111";
const fixture = { children: [{id: CHILD, name: "Maya"}], cookie: "" };

test("actual chat route prepares only the authenticated ability question, with no assessment kickoff", async () => {
  const stubs: Record<string, string> = {
    "next/headers": `export async function cookies(){return {get:()=>fixture.cookie ? {value:fixture.cookie}:undefined}}`,
    "next/navigation": `export function redirect(){throw new Error('Unexpected redirect')}`,
    "app-data": `export async function getAppData(){return {family:{id:'synthetic-family',time_zone:'America/New_York'},children:fixture.children,plans:[]}}`,
    "billing/wall": `export async function familyWallCheckout(){return null}`,
    "chat-history": `export async function fetchChatHistory(){return []}`,
    "slash-skills": `export async function getSlashMenuSkills(){return []}`,
    "supabase/server": `export async function createSupabaseServerClient(){return {auth:{getClaims:async()=>({data:{claims:{sub:'synthetic-adult'}}})}}}`,
    "voice/active-material": `export async function resolveActiveMaterialCaller(){throw new Error('Unexpected material read')}`,
    "chat-client": `export function ChatClient(){return null}`,
  };
  const result = await esbuild.build({entryPoints:[fileURLToPath(new URL("../../app/app/page.tsx", import.meta.url))],bundle:true,write:false,platform:"node",format:"cjs",jsx:"automatic",external:["react","react/jsx-runtime"],plugins:[{
    name:"read-only-page-fixture",setup(build: {
      onResolve(options: { filter: RegExp }, callback: (args: { path: string }) => { path: string; namespace: string } | undefined): void;
      onLoad(options: { filter: RegExp; namespace: string }, callback: (args: { path: string }) => { contents: string; loader: string }): void;
    }){
      build.onResolve({filter:/.*/},args=>{
        const key=Object.keys(stubs).find(key=>args.path===key||args.path.endsWith("/"+key));
        return key ? {path:key,namespace:"fixture"}:undefined;
      });
      build.onLoad({filter:/.*/,namespace:"fixture"},args=>({contents:stubs[args.path],loader:"js"}));
    },
  }]});
  const mod={exports:{}};
  new Script(`(function(require,module,exports,fixture){${result.outputFiles[0].text}\n})`).runInThisContext()(require,mod,mod.exports,fixture);
  const page=(mod.exports as {default:(props:{searchParams:Promise<Record<string,string>>})=>Promise<ReactElement>}).default;
  // Use a real catalog id, never synthetic words from a URL.
  const id="math.small-groups", ability=findAbilitiesExplorerAbility(id);
  assert.ok(ability);
  fixture.cookie=JSON.stringify({requestId:"22222222-2222-4222-8222-222222222222",childId:CHILD,subjectId:"math"});
  const rendered=await page({searchParams:Promise.resolve({draft:"ability-question",child:CHILD,ability:id})});
  const elements=(rendered.props as {children: ReactElement[]}).children;
  const props=elements.at(-1)!.props as {initialDraft:string;initialAssessment:unknown;assessmentUnavailable:boolean};
  assert.equal(props.initialDraft,abilityQuestion("Maya",ability.name));
  assert.equal(props.initialAssessment,null);assert.equal(props.assessmentUnavailable,false);
  for(const query of [{child:"foreign",ability:id},{child:CHILD,ability:"missing"}]){
    const failed=await page({searchParams:Promise.resolve({draft:"ability-question",...query})});
    assert.match(renderToStaticMarkup(failed),/role="alert"/);
    assert.match(renderToStaticMarkup(failed),/This ability question is unavailable/);
    const children=(failed.props as {children: ReactElement[]}).children;
    assert.equal((children.at(-1)!.props as {initialDraft?:string}).initialDraft,undefined);
  }
});
