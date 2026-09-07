import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { composeHoursNote, hoursWorkContextSchema } from "./hours-note-context";

describe("named work in Hours annotations", () => {
  it("keeps the owned title and lesson detail separate from the current duration quote", () => {
    const value = composeHoursNote({ title: "Narnia reading", note: "Chapter 3 discussion", sourceQuote: "We finished in 25 minutes." });
    assert.equal(value.text, "Narnia reading · Chapter 3 discussion");
    assert.equal(value.fullContext.sourceQuote, "We finished in 25 minutes.");
    assert.equal(value.truncated, false);
  });
  it("retains an earlier named work when the later quote contains only minutes", () => {
    assert.equal(composeHoursNote({ title: "Make Way for Ducklings", sourceQuote: "That took 40 minutes." }).text,
      "Make Way for Ducklings · That took 40 minutes.");
  });
  it("uses the current quote for blank detail and preserves explicit standalone notes", () => {
    assert.equal(composeHoursNote({ title: "Narnia", note: " ", sourceQuote: "25 minutes" }).text,"Narnia · 25 minutes");
    assert.equal(composeHoursNote({ note: "Parent correction", sourceQuote: "25 minutes" }).text,"Parent correction");
  });
  it("deduplicates only exact title prefixes, without interpreting aliases", () => {
    assert.equal(composeHoursNote({ title: "Narnia", note: "Narnia: chapter 3", sourceQuote: "done" }).text,"Narnia: chapter 3");
    assert.equal(composeHoursNote({ title: "Narnia", note: "narnia chapter three", sourceQuote: "done" }).text,"Narnia · narnia chapter three");
  });
  it("retains a fitting title whole when detail cannot fit", () => {
    for (const count of [198,199,200]) {
      const title="É".repeat(count), result=composeHoursNote({ title, sourceQuote:"40 minutes" });
      assert.equal(result.text,title); assert.equal(result.truncated,true); assert.equal(result.fullContext.title,title);
    }
  });
  it("marks a longer title as truncated while retaining its full source context", () => {
    const title="A".repeat(250),result=composeHoursNote({ title, sourceQuote:"40 minutes" });
    assert.equal(Array.from(result.text).length,200); assert.equal(result.text.endsWith("…"),true);
    assert.equal(result.truncated,true); assert.equal(result.fullContext.title,title);
  });
  it("clips Unicode at whole graphemes within the code-point database limit", () => {
    const title="Zoë 👩🏽‍🔬 e\u0301 ".repeat(30), result=composeHoursNote({ title, sourceQuote:"25 minutes" });
    assert.ok(Array.from(result.text).length <=200);
    const boundaries = [...new Intl.Segmenter("en",{granularity:"grapheme"}).segment(title)].map(({index,segment})=>title.slice(0,index+segment.length).trimEnd());
    assert.ok(boundaries.includes(result.text.slice(0,-1))); assert.equal(result.fullContext.title,title.trim());
  });
  it("requires bounded source identifiers and literal title/quote fields", () => {
    const valid={sourceMessageId:"abcdefab-abcd-4abc-8abc-abcdefabcdef",sourceQuote:"We read Narnia",workTitle:"Narnia"};
    assert.equal(hoursWorkContextSchema.parse({...valid,sourceMessageId:valid.sourceMessageId.toUpperCase()}).sourceMessageId,valid.sourceMessageId);
    for (const delta of [{sourceMessageId:"unknown"},{workTitle:" "},{sourceQuote:""},{workTitle:"a".repeat(301)},{extra:"not allowed"}])
      assert.equal(hoursWorkContextSchema.safeParse({...valid,...delta}).success,false);
  });
});
