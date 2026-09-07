import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { installHoursPostgresFixture } from "./hours-postgres-fixture.mjs";
import { foldFamilyDataIntoTx } from "../apps/web/lib/family-fold";
import { mapDb } from "../apps/web/lib/map/db";
import { readHoursCategorySummary } from "../apps/web/lib/hours-category-summary";
import { readHoursCategories, saveHoursCategory } from "../apps/web/lib/hours-categories-server";
const require = createRequire(new URL("../apps/web/package.json", import.meta.url));
const postgres = require("postgres");
const url = process.env.HOMA_EVAL_DATABASE_URL;
assert(url); assert.equal(new URL(url).hostname,"127.0.0.1");
const sql = postgres(url,{max:4,prepare:false});
const familyId=randomUUID(), foreign=randomUUID(), user=randomUUID(), foreignUser=randomUUID(), child=randomUUID();
const access = { mode:"pinned" as const, familyId };
const now = new Date("2026-09-07T16:00:00Z");
const request={period:"all" as const};
const run = async(name:string,work:()=>Promise<void>)=>{await work(); console.log("PASS "+name);};
try {
 await installHoursPostgresFixture(sql);
 await sql`insert into auth.users(id,email) values(${user},${user+'@homatest.invalid'}),(${foreignUser},${foreignUser+'@homatest.invalid'})`;
 await sql`insert into public.families(id,name,status,sandbox,billing_exempt,time_zone) values(${familyId},'Category fixture','claimed',true,true,'America/New_York'),(${foreign},'Other fixture','claimed',true,true,'America/New_York')`;
 await sql`insert into public.family_members(family_id,user_id,role) values(${familyId},${user},'parent'),(${foreign},${foreignUser},'parent')`;
 await sql`insert into public.children(id,family_id,name,birth_month) values(${child},${familyId},'Avery','2020-01-01')`;
 await sql`insert into homa_test_fixture.hours_log(family_id,child_id,subject,minutes,happened_on,custom_label) values(${familyId},${child},'spanish',30,'2026-09-06','Portuguese'),(${familyId},${child},'spanish',30,'2026-09-06','Spanish'),(${familyId},null,'spanish',10,'2026-09-06',null),(${foreign},null,'spanish',500,'2026-09-06','Portuguese')`;
 let categoryId='';
 await run('existing writer labels create distinct reusable categories; equal-duration languages survive',async()=>{
   const rows=await readHoursCategories(access); assert.equal(rows.length,2); categoryId=rows.find(row=>row.name==='Portuguese')!.id;
   const r=await readHoursCategorySummary(access,request,now); assert.equal(r.totalMinutes,70); assert.equal(r.byCategory.length,3); assert.equal(r.byCategory.reduce((n,c)=>n+c.minutes,0),70);
   assert.equal((await readHoursCategorySummary(access,{...request,categoryId},now)).totalMinutes,30);
   assert.equal((await readHoursCategorySummary(access,{...request,uncategorizedOnly:true},now)).totalMinutes,10);
 });
 await run('unused categories persist; exact duplicate create reuses identity; parent subjects stay separate',async()=>{
   const a=await saveHoursCategory(access,{subject:'reading',name:'  Independent reading  '}); assert.equal(a.status,'saved'); if(a.status!=='saved')throw Error();
   const b=await saveHoursCategory(access,{subject:'reading',name:'Independent reading'}); assert.equal(b.status,'saved'); if(b.status!=='saved')throw Error(); assert.equal(a.category.id,b.category.id);
   assert.equal((await readHoursCategorySummary(access,{...request,categoryId:a.category.id},now)).totalMinutes,0);
   assert.equal((await saveHoursCategory(access,{subject:'spanish',name:'Independent reading'})).status,'saved');
 });
 await run('rename updates existing notes category only and keeps canonical parent and exact totals',async()=>{
   const before=await sql`select id,subject,minutes,note,capture_operation_id from public.hours_log where family_id=${familyId} order by id`;
   const saved=await saveHoursCategory(access,{subject:'spanish',name:'Portuguese practice',categoryId,expectedName:'Portuguese'});assert.equal(saved.status,'saved');
   const after=await sql`select id,subject,minutes,note,capture_operation_id from public.hours_log where family_id=${familyId} order by id`;assert.deepEqual(after,before);
   const r=await readHoursCategorySummary(access,{...request,categoryId},now);assert.equal(r.entries[0].customLabel,'Portuguese practice');assert.equal(r.totalMinutes,30);
   assert.equal((await saveHoursCategory(access,{subject:'spanish',name:'Stale',categoryId,expectedName:'Portuguese'})).status,'conflict');
   assert.equal((await saveHoursCategory(access,{subject:'spanish',name:'Spanish',categoryId,expectedName:'Portuguese practice'})).status,'duplicate');
   assert.equal((await readHoursCategorySummary(access,request,now)).totalMinutes,70);
 });
 await run('caller RLS blocks foreign reads and writes and anonymous category access',async()=>{
   await sql.begin(async(tx:any)=>{await tx`select set_config('request.jwt.claim.sub',${foreignUser},true)`;await tx`set local role authenticated`;assert.equal((await tx`select * from public.hours_categories where family_id=${familyId}`).length,0);
    assert.equal((await tx`select public.save_hours_category(${familyId}::uuid,'spanish','Stolen',${categoryId}::uuid,'Portuguese practice') as r`)[0].r.status,'not_found');
    assert.equal((await tx`select public.read_hours_category_summary(${familyId}::uuid,'all') as r`)[0].r.status,'not_found');
   });
   await assert.rejects(sql.begin(async(tx:any)=>{await tx`set local role anon`;await tx`select * from public.hours_categories`;}));
 });
 await run('shared-inclusive child scope, exclusion, foreign ids and malformed category filters',async()=>{
   assert.equal((await readHoursCategorySummary(access,{...request,childId:child},now)).totalMinutes,70);
   assert.equal((await readHoursCategorySummary(access,{...request,childId:child,includeShared:false},now)).totalMinutes,60);
   await assert.rejects(readHoursCategorySummary(access,{...request,categoryId:randomUUID()},now));
   await assert.rejects(readHoursCategorySummary(access,{...request,categoryId,uncategorizedOnly:true},now));
 });
 await run('same-name concurrent creation converges; last-entry deletion retains category',async()=>{
   const result=await Promise.all([1,2].map(()=>saveHoursCategory(access,{subject:'reading',name:'Concurrent'})));assert.equal(result[0].status,'saved');assert.deepEqual(result[0],result[1]);
   await sql`delete from public.hours_log where family_id=${familyId} and custom_label='Portuguese practice'`;
   assert((await readHoursCategories(access)).some(row=>row.id===categoryId));
   assert.equal((await readHoursCategorySummary(access,{...request,categoryId},now)).totalMinutes,0);
 });

 await run('in-flight old-client insert serializes with rename and cannot orphan an annotation',async()=>{
   const category=await saveHoursCategory(access,{subject:'spanish',name:'Race language'}); assert.equal(category.status,'saved');if(category.status!=='saved')throw Error();
   let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});let inserted!:()=>void;const ready=new Promise<void>(resolve=>{inserted=resolve;});
   const first=sql.begin(async(tx:any)=>{await tx`set local statement_timeout='8s'`;await tx`insert into homa_test_fixture.hours_log(family_id,subject,minutes,happened_on,custom_label) values(${familyId},'spanish',7,'2026-09-06','Race language')`;inserted();await gate;});
   await ready;
   let finished=false;
   const rename=saveHoursCategory(access,{subject:'spanish',name:'Renamed language',categoryId:category.category.id,expectedName:'Race language'}).finally(()=>{finished=true;});
   await new Promise(resolve=>setTimeout(resolve,100));assert.equal(finished,false);
   release();await first;assert.equal((await rename).status,'saved');
   const r=await readHoursCategorySummary(access,{...request,categoryId:category.category.id},now);assert.equal(r.totalMinutes,7);assert.equal(r.entries[0].customLabel,'Renamed language');
   assert.equal((await sql`select count(*)::int as n from public.hours_log h left join public.hours_categories c on c.family_id=h.family_id and c.subject=h.subject and c.name=h.custom_label where h.family_id=${familyId} and h.custom_label is not null and c.id is null`)[0].n,0);
 });
 await run('structural category FK rejects orphan labels without weakening receipt validation',async()=>{
   const cat=await saveHoursCategory(access,{subject:'reading',name:'Delete fixture'});assert.equal(cat.status,'saved');
   await sql`insert into homa_test_fixture.hours_log(family_id,subject,minutes,happened_on,custom_label) values(${foreign},'reading',7,'2026-09-06','Owned source')`;
   await assert.rejects(sql.begin(async(tx:any)=>{await tx`delete from public.hours_categories where family_id=${foreign} and name='Owned source'`;}), (error:any)=>error.code==='23503');
 });

 await run('actual family fold carries used and unused categories, reuses destination names and preserves all minutes',async()=>{
   const source=randomUUID(); await sql`insert into public.families(id,name,status,sandbox,billing_exempt) values(${source},'Fold source','claimed',true,true)`;
   const sourceAccess={mode:'pinned' as const,familyId:source};
   await saveHoursCategory(sourceAccess,{subject:'reading',name:'Unused fold category'});
   await saveHoursCategory(sourceAccess,{subject:'reading',name:'Independent reading'});
   await sql`insert into homa_test_fixture.hours_log(family_id,subject,minutes,happened_on,custom_label) values(${source},'reading',19,'2026-09-06','Fold activity')`;
   const before=(await readHoursCategorySummary(access,request,now)).totalMinutes;
   assert.equal(await sql.begin(async(tx:any)=>{await tx`set constraints all deferred`;return foldFamilyDataIntoTx(tx,source,familyId);}),true);
   const categories=await readHoursCategories(access);assert(categories.some(row=>row.name==='Unused fold category'));assert.equal(categories.filter(row=>row.subject==='reading'&&row.name==='Independent reading').length,1);
   assert.equal((await readHoursCategorySummary(access,request,now)).totalMinutes,before+19);
   assert.equal((await sql`select count(*)::int as n from public.hours_categories where family_id=${source}`)[0].n,0);
 });
 console.log('Hours categories PostgreSQL contract passed.');
} finally { await sql.end(); await mapDb().end(); }
