import assert from "node:assert/strict";
import { test } from "node:test";

import {
  hasPageBreakMarkup,
  joinPageBodies,
  SHEET_PAGE_CLASS,
  selectMaterialPages,
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

test("a blocked-markup refusal names the actual matched tag", () => {
  const note = validatePrintableHtml("<div><script>alert(1)</script></div>", "");
  assert.match(note ?? "", /"<script"/u);
});

test("a banned word in the page body names the word and says HTML", () => {
  const note = validatePrintableHtml("<div>She is behind in reading</div>", "");
  assert.match(note ?? "", /"behind"/u);
  assert.match(note ?? "", /page HTML/u);
});

test("an em dash in the page body is refused and named", () => {
  const note = validatePrintableHtml("<div>counting—practice</div>", "");
  assert.match(note ?? "", /em dash/u);
});

test("a banned word only in metadata is refused, but the page HTML is cleared", () => {
  const note = validatePrintableHtml(
    "<div>Counting practice</div>",
    "A worksheet for a child who is behind",
  );
  assert.match(note ?? "", /"behind"/u);
  assert.match(note ?? "", /not the HTML/u);
});

test("clean body and clean metadata pass", () => {
  assert.equal(
    validatePrintableHtml("<div>Counting practice</div>", "A fun counting page"),
    null,
  );
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

test("printable shells carry the Quiet contract and semantic artifact tokens", () => {
  const document = wrapPrintablePage("<h1>Counting practice</h1>", "Story");
  assert.match(document, /data-brand-era="quiet-authority-v1"/u);
  assert.match(document, /data-brand-surface="materials-page-shell"/u);
  assert.match(document, /--homa-canvas: #F7F4EE/u);
  assert.match(document, /--homa-ink: #20242B/u);
  assert.match(document, /--homa-midnight-action: #27374D/u);
  assert.match(document, /font-family: var\(--homa-font-interface\)/u);
  assert.doesNotMatch(document, /#FBF7F0|#221E1A|#8A7D6C|Hanken|Schibsted/u);
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

test("no pageIndex takes every page of the material, as reuse always did", () => {
  const stored = joinPageBodies(["<p>one</p>", "<p>two</p>", "<p>three</p>"]);
  const selected = selectMaterialPages(stored, undefined);
  assert.equal(selected.ok, true);
  assert.deepEqual(selected.ok && selected.bodies, [
    "<p>one</p>",
    "<p>two</p>",
    "<p>three</p>",
  ]);
});

test("pageIndex counts from 1, the way the parent counts pages", () => {
  const stored = joinPageBodies(["<p>one</p>", "<p>two</p>", "<p>three</p>"]);
  assert.deepEqual(selectMaterialPages(stored, 1), { ok: true, bodies: ["<p>one</p>"] });
  assert.deepEqual(selectMaterialPages(stored, 3), { ok: true, bodies: ["<p>three</p>"] });
});

test("a page past the end reports the real page count instead of shipping nothing", () => {
  const stored = joinPageBodies(["<p>one</p>", "<p>two</p>"]);
  assert.deepEqual(selectMaterialPages(stored, 3), { ok: false, pageCount: 2 });
});

test("page 0 is out of range, never a silent last page", () => {
  const stored = joinPageBodies(["<p>one</p>", "<p>two</p>"]);
  assert.deepEqual(selectMaterialPages(stored, 0), { ok: false, pageCount: 2 });
});

test("a one-page material still answers pageIndex 1", () => {
  assert.deepEqual(selectMaterialPages("<p>only</p>", 1), {
    ok: true,
    bodies: ["<p>only</p>"],
  });
});

test("rebuilding a packet with one page swapped keeps the other pages byte-identical", () => {
  // The Carolyng case: twelve pages, one edit. Every untouched page must
  // come back exactly as stored, or a one-page edit quietly rewrites the
  // packet (plans/2026-07-27-packet-page-revision-failure.md).
  const original = Array.from({ length: 12 }, (_, i) => `<p>page ${i + 1}</p>`);
  const stored = joinPageBodies(original);
  const rebuilt = original.map((_, i) =>
    i === 3
      ? "<p>page 4, bigger</p>"
      : (() => {
          const one = selectMaterialPages(stored, i + 1);
          assert.equal(one.ok, true);
          return one.ok ? one.bodies[0] : "";
        })(),
  );
  assert.deepEqual(rebuilt, [
    "<p>page 1</p>",
    "<p>page 2</p>",
    "<p>page 3</p>",
    "<p>page 4, bigger</p>",
    ...original.slice(4),
  ]);
});
