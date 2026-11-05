import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";

import { conversationAttachmentPreparation, conversationRuntimeInput, normalizeConversationAttachmentIds } from "./conversation-attachments";
import { validateConversationIntent } from "./conversation-requests";
import { sameConversationIntentContent } from "../app/app2/conversation-outbox";

const first = randomUUID(), second = randomUUID();
const payload = { version: 1 as const, mediaType: "image/jpeg", filename: "same name.jpg", block: null,
  marker: "[Photo attached · two apples · private-identity]", native: true, outcome: "model_native", kind: "image" as const };

test("receipt identities retain order and reject browser URLs, duplicates and overflow", () => {
  assert.deepEqual(normalizeConversationAttachmentIds([second,first]),[second,first]);
  for (const invalid of [[first,first.toUpperCase()],["https://example.com/file"],Array.from({length:7},randomUUID),{}]) {
    assert.throws(() => normalizeConversationAttachmentIds(invalid));
  }
});

test("equal filenames stay separate native parts and canonical words are unchanged", () => {
  const words = "  Look\n please  ";
  const input = conversationRuntimeInput(words,[{id:first,url:"private:first",payload},{id:second,url:"private:second",payload}]);
  assert(Array.isArray(input.message));
  assert.equal(input.message[0].type,"text");
  assert.equal(input.message[0].text,words);
  assert.equal(input.message.filter(part => part.type === "file").length,2);
  assert.equal(input.summary,`${words}\n${payload.marker}\n[file: same name.jpg (image/jpeg)]\n${payload.marker}\n[file: same name.jpg (image/jpeg)]`);
  assert.notEqual(validateConversationIntent(first,words,[first,second]),validateConversationIntent(first,words,[second,first]));
  assert.throws(() => validateConversationIntent(first,""));
  assert.doesNotThrow(() => validateConversationIntent(first,"",[second]));
});

test("prepared payload stores extraction and durable marker, excluding temporary native URL", () => {
  const prepared = conversationAttachmentPreparation({input:{url:"private:identity",mediaType:"application/pdf",name:"worksheet.pdf"},
    kind:"document",outcome:"model_native",caption:"worksheet.pdf",block:null,marker:"[File attached · worksheet.pdf · private:identity]",
    part:{type:"file",data:"https://temporary.example/secret-signature",mediaType:"application/pdf"}});
  assert.equal(prepared.native,true);
  assert(!JSON.stringify(prepared).includes("secret-signature"));
});

test("outbox acknowledgements cannot change or drop attachment identity", () => {
  const entry = { account:"adult",accessEpoch:randomUUID(),intentId:first,text:"",submittedAt:1,attachmentIds:[first,second] };
  assert(sameConversationIntentContent(entry,structuredClone(entry)));
  assert(!sameConversationIntentContent(entry,{...entry,attachmentIds:[second,first]}));
  assert(!sameConversationIntentContent(entry,{...entry,attachmentIds:[]}));
});
