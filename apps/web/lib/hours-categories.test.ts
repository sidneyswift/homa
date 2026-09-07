import assert from "node:assert/strict";
import logHours from "../agent/tools/log_hours";
import { hoursCaptureInputSchema } from "./hours-capture";
import { z } from "zod";
import { test } from "node:test";
import { categorySubtotals, saveHoursCategorySchema } from "./hours-categories";
import { filterEntries, SUBJECT_LABELS, type HoursEntry } from "./hours-view";
const entry = (customLabel: string | null, minutes: number): HoursEntry => ({ id: String(minutes)+customLabel, childId: null, childName: null, subject: "spanish", customLabel, minutes, happenedOn: "2026-09-06", source: "chat", note: null });
test("category subtotals preserve unused choices and reconcile labeled plus uncategorized parent time",()=>{
  const entries=[entry("Portuguese",30),entry("Spanish",30),entry(null,10)];
  const categories=[{ id:"1",subject:"spanish" as const,name:"Portuguese" },{id:"2",subject:"spanish" as const,name:"Future practice"}];
  const rows=categorySubtotals(entries,categories);
  assert.equal(rows.reduce((n,row)=>n+row.minutes,0),70);
  assert.equal(rows.find(row=>row.name==="Future practice")?.minutes,0);
  assert.equal(rows.find(row=>row.name==="")?.minutes,10);
  assert.deepEqual(filterEntries(entries,{subject:"spanish",category:"Portuguese"}),[entries[0]]);
  assert.deepEqual(filterEntries(entries,{subject:"spanish",category:null}),[entries[2]]);
});
test("category identity accepts40 Unicode codepoints, rejects blank or longer and preserves spelling",()=>{
  assert.equal(saveHoursCategorySchema.parse({subject:"reading",name:" 🧡".trim().repeat(40)}).name.length,80);
  for(const name of [" ","a".repeat(41),"🧡".repeat(41)]) assert.equal(saveHoursCategorySchema.safeParse({subject:"reading",name}).success,false);
  assert.equal(saveHoursCategorySchema.parse({subject:"spanish",name:"  Português  "}).name,"Português");
});
test("familiar subject names keep canonical ids unchanged",()=>{
  assert.equal(SUBJECT_LABELS.reading,"Language arts");assert.equal(SUBJECT_LABELS["social studies"],"History and social studies");assert.equal(SUBJECT_LABELS.spanish,"Foreign language");
});

test("a saved supplementary-Unicode category parses through actual chat and pinned writer schemas",()=>{
  const name = "🧡".repeat(40);
  const saved = saveHoursCategorySchema.parse({subject:"spanish",name});
  const input = { subject:"spanish",minutes:10,sourceActivityOrdinal:1,sourceQuote:"Ten minutes of language practice",customLabel:saved.name };
  assert.equal((logHours.inputSchema as z.ZodType).parse(input) !== null,true);
  assert.equal(hoursCaptureInputSchema.parse({...input,familyId:"a0000000-0000-4000-8000-000000000001",sourceMessageId:"b0000000-0000-4000-8000-000000000001",source:"chat"}).customLabel,name);
});
