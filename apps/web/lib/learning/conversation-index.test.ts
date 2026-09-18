import assert from "node:assert/strict";
import test from "node:test";

import { sweepConversationIndex, type ConversationIndexDependencies } from "./conversation-index";

test("failed provider and storage work remain retryable while later items proceed", async () => {
  const finished: string[] = [];
  const deps: ConversationIndexDependencies = {
    claim: async () => ["provider", "storage", "success"].map(id => ({id, family_id: "family", content:id, embedding:null})),
    embed: async (text, attribution) => {
      assert.equal(attribution?.familyId, "family");
      assert.ok(attribution?.signal);
      return text === "provider" ? null : "[1]";
    },
    finish: async message => {
      if (message.id === "storage") throw new Error("interrupted");
      finished.push(message.id);
    },
  };
  assert.deepEqual(await sweepConversationIndex(deps), {claimed:3, completed:1, retry:2});
  assert.deepEqual(finished, ["success"]);
});

test("already indexed and short messages finish without another model call", async () => {
  assert.deepEqual(await sweepConversationIndex({
    claim: async () => [
      {id:"a",family_id:"f",content:"already saved",embedding:"[1]"},
      {id:"b",family_id:"f",content:"hi",embedding:null},
    ],
    embed: async () => { throw new Error("must not call"); },
    finish: async () => {},
  }), {claimed:2,completed:2,retry:0});
});
