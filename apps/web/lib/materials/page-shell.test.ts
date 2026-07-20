import assert from "node:assert/strict";
import { test } from "node:test";

import {
  hasPageBreakMarkup,
  joinPageBodies,
  SHEET_PAGE_CLASS,
  splitPageBodies,
  SPRITE_SLICE_GATE_NOTE,
  stripCdataWrapper,
  validatePrintableHtml,
  wrapPrintableDocument,
  wrapPrintablePage,
} from "./page-shell";

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

test("sprite slicing is refused: the exact shipped 2026-07-19 construct", () => {
  const html =
    "<style>.icon { background-image: url('https://example.com/sheet.png');" +
    " background-size: 400% 400%; }</style>" +
    "<div class=\"icon\" style=\"background-position: 33.333% 66.667%;\"></div>";
  assert.equal(validatePrintableHtml(html, ""), SPRITE_SLICE_GATE_NOTE);
});

test("sprite slicing in an inline style attribute is refused too", () => {
  const html =
    "<div style=\"background-image: url(a.png); background-size: 250% 250%\"></div>";
  assert.equal(validatePrintableHtml(html, ""), SPRITE_SLICE_GATE_NOTE);
});

test("full-bleed and keyword background sizes stay allowed", () => {
  const html =
    "<style>.hero { background-size: 100% 100%; }" +
    " .banner { background-size: cover; }" +
    " .tile { background-size: 48px 48px, 50% auto; }</style><div>page</div>";
  assert.equal(validatePrintableHtml(html, ""), null);
});

test("a packet document boxes every page and repeats the footer on each", () => {
  const document = wrapPrintableDocument(
    ["<div>week one</div>", "<div>week two</div>", "<div>week three</div>"],
    "Story",
  );
  const pageBoxes = document.split(`class="${SHEET_PAGE_CLASS}"`).length - 1;
  const footers = document.split("made with Homa for Story").length - 1;
  assert.equal(pageBoxes, 3);
  assert.equal(footers, 3);
  assert.match(document, /week two/u);
});

test("a single page keeps the exact one-box contract", () => {
  const document = wrapPrintablePage("<div>one page</div>", "");
  const pageBoxes = document.split(`class="${SHEET_PAGE_CLASS}"`).length - 1;
  assert.equal(pageBoxes, 1);
  assert.match(document, /height: 11in/u);
  assert.match(document, /overflow: hidden/u);
});

test("page bodies survive a store round trip through the delimiter", () => {
  const bodies = ["<div>cover</div>", "<style>.a{}</style>\n<div>lesson</div>"];
  assert.deepEqual(splitPageBodies(joinPageBodies(bodies)), bodies);
});

test("a classic single stored body splits to itself", () => {
  assert.deepEqual(splitPageBodies("<div>only page</div>"), ["<div>only page</div>"]);
});

test("page-break CSS is detected however it is spelled", () => {
  assert.equal(hasPageBreakMarkup("<style>.w{page-break-after: always}</style>"), true);
  assert.equal(hasPageBreakMarkup("<style>.w{break-after:page}</style>"), true);
  assert.equal(hasPageBreakMarkup("<style>.w{page-break-before: always}</style>"), true);
  assert.equal(hasPageBreakMarkup("<style>.w{break-inside: avoid}</style>"), false);
  assert.equal(hasPageBreakMarkup("<div>take a break after lunch</div>"), false);
});
