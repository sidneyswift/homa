import assert from "node:assert/strict";
import { test } from "node:test";

import { stripCdataWrapper, validatePrintableHtml } from "./page-shell";

test("plain page html passes through untouched", () => {
  const html = "<div class=\"page\"><h1>Counting</h1></div>";
  assert.equal(stripCdataWrapper(html), html);
});

test("a CDATA-wrapped page loses the wrapper, keeps the page", () => {
  const page = "<div class=\"page\"><h1>Counting</h1></div>";
  assert.equal(stripCdataWrapper(`<![CDATA[${page}]]>`), page);
});

test("whitespace and newlines around the wrapper still strip", () => {
  const page = "<style>.a{}</style>\n<div>page</div>";
  assert.equal(stripCdataWrapper(`\n  <![CDATA[\n${page}]]>  \n`), `\n${page}`);
});

test("nested wrappers strip fully", () => {
  const page = "<div>page</div>";
  assert.equal(stripCdataWrapper(`<![CDATA[<![CDATA[${page}]]>]]>`), page);
});

test("a lone ]]> inside page content is preserved", () => {
  const html = "<div>the sequence ]]&gt; appears literally: ]]></div>";
  assert.equal(stripCdataWrapper(html), html);
});

test("an unterminated CDATA opener is left for the gate, not silently eaten", () => {
  const html = "<![CDATA[<div>page</div>";
  assert.equal(stripCdataWrapper(html), html);
});

test("the brand gate still refuses executable markup after stripping", () => {
  const wrapped = "<![CDATA[<script>alert(1)</script>]]>";
  assert.notEqual(validatePrintableHtml(stripCdataWrapper(wrapped), ""), null);
});
