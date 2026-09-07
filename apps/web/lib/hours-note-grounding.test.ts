import assert from "node:assert/strict";
import { test } from "node:test";

import { hoursNoteGroundingRequest, validateHoursNoteProposal, verifyHoursNoteGrounding } from "./hours-note-grounding";

const id="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const foreign="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const note="Independent reading for 20 minutes";
const sources=[{sourceMessageId:id,text:"Finn read on his own for twenty minutes."}];
const supported={decision:"supported",supportedBy:[{sourceMessageId:id,quote:"read on his own for twenty minutes"}],unsupportedNoteQuotes:[]};

test("verified paraphrases do not require notes to be exact source wording",()=>{
  assert.equal(sources[0].text.includes(note),false);assert.equal(validateHoursNoteProposal(note,sources,supported),true);
});
test("a model cannot invent a source ID or source quote",()=>{
  assert.equal(validateHoursNoteProposal(note,sources,{...supported,supportedBy:[{sourceMessageId:foreign,quote:sources[0].text}]}),false);
  assert.equal(validateHoursNoteProposal(note,sources,{...supported,supportedBy:[{sourceMessageId:id,quote:"Read Narnia"}]}),false);
});
test("unsupported, empty, contradictory and malformed proposals refuse",()=>{
  assert.equal(validateHoursNoteProposal("Narnia reading",sources,{decision:"unsupported",supportedBy:[],unsupportedNoteQuotes:["Narnia"]}),false);
  assert.equal(validateHoursNoteProposal(note,sources,{...supported,supportedBy:[]}),false);
  assert.equal(validateHoursNoteProposal(note,sources,{...supported,unsupportedNoteQuotes:["reading"]}),false);
  assert.equal(validateHoursNoteProposal(note,sources,{...supported,unsupportedNoteQuotes:["invented"]}),false);
  assert.equal(validateHoursNoteProposal(note,sources,{}),false);
});
test("complete current-message quotes need no model or database access",async()=>{
  assert.deepEqual(await verifyHoursNoteGrounding({familyId:foreign,memberUserId:null,sourceMessageId:id,
    canonicalInboundText:sources[0].text,note:sources[0].text,workContext:null,channel:"web"}),{supported:true});
});
test("a literal fragment cannot bypass source and semantic verification",async()=>{
  assert.deepEqual(await verifyHoursNoteGrounding({familyId:foreign,memberUserId:null,sourceMessageId:id,
    canonicalInboundText:"The copied prompt says Narnia reading, but that is not what we read.",
    note:"Narnia reading",workContext:null,channel:"web"}),{supported:false,reason:"source_unavailable"});
});
test("provenance request uses only supplied verified sources and a real source-ID enum",()=>{
  const request=hoursNoteGroundingRequest({familyId:foreign,note,sources});
  assert.deepEqual(JSON.parse(request.prompt),{note,currentParentSource:sources[0],verifiedEarlierParentSources:[]});
  assert.equal(request.schema.safeParse({...supported,supportedBy:[{sourceMessageId:foreign,quote:sources[0].text}]}).success,false);
});
