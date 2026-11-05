import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { PermanentQuestionCard } from "./permanent-question-card";

const card={questions:[{header:"Format",question:"What would help?",multiSelect:false,
  options:[{label:"A worksheet",description:null},{label:"A game",description:null}]}]};

test("a stored freeform answer renders a clear spent state without empty choices",()=>{
  const rendered=renderToStaticMarkup(<PermanentQuestionCard id="question" card={card} state="answered" answers={null}
    onAnswer={async()=>false} onTypeInstead={()=>{}} />);
  assert.match(rendered,/Answered in the conversation\./);assert(!rendered.includes("<button"));
});

test("structured answers preserve option identity and deleted cards remain distinct",()=>{
  const answered=renderToStaticMarkup(<PermanentQuestionCard id="question" card={card} state="answered"
    answers={[{question:0,kind:"choice",options:[1]}]} onAnswer={async()=>false} onTypeInstead={()=>{}} />);
  assert.match(answered,/A game/);assert(!answered.includes("Answered in the conversation."));
  const deleted=renderToStaticMarkup(<PermanentQuestionCard id="question" card={card} state="deleted" answers={null}
    onAnswer={async()=>false} onTypeInstead={()=>{}} />);
  assert.match(deleted,/This question is no longer available\./);
});
