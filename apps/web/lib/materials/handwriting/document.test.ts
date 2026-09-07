import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { composeHandwritingRow, prepareHandwritingDocument, selectCarriedHandwritingRows, handwritingFailureNote } from "./document";
import { PROFILE_SOURCE } from "./profile";
import { guidedRow, loadProfile, GuidedRowError } from "./row";
import { selectMaterialPages, joinPageBodies } from "../page-shell";

const input = { id: "amalia", text: "Amalia", style: "pale" as const, capHeight: 96 };
const fresh = { body: "<h1>My name</h1><!-- homa:handwriting amalia -->", fresh: true, handwritingRows: [input] };
const prepare = () => prepareHandwritingDocument([fresh], true);

test("frozen measured profile bytes survive deployment embedding without reserialization", () => {
  assert.equal(createHash("sha256").update(PROFILE_SOURCE).digest("hex"), "abc4d2e994b928fd27a940550a6f0210de079441d3b33bf147feee4783da2ccc");
  assert.equal(Object.keys(loadProfile().glyphs).length, 59);
  assert.throws(() => loadProfile(Buffer.from("{}")), GuidedRowError);
  assert.throws(() => loadProfile(undefined, () => { throw Error("private file"); }), /pinned outline profile is unavailable/);
});
test("one literal declaration produces isolated canonical image and server geometry receipt", () => {
  const result = prepare();
  assert.equal(result.receipts.length, 1);
  assert.equal(result.receipts[0].composition.text, "Amalia");
  assert.equal(result.receipts[0].composition.guideHeightPoints, 72);
  assert.ok(result.bodies[0].includes("data:image/svg+xml;base64,"));
  assert.ok(!result.bodies[0].includes("<!-- homa:handwriting"));
  assert.equal(result.receipts[0].markupSha256, createHash("sha256").update(composeHandwritingRow(input).markup).digest("hex"));
});
test("all support levels keep exact path identity and independent rows have no letters", () => {
  const rows = ["model", "pale", "dotted"].map((style) => guidedRow({ ...input, style: style as typeof input.style }));
  assert.deepEqual(rows[0].receipt.glyphs, rows[1].receipt.glyphs);
  assert.deepEqual(rows[1].receipt.glyphs, rows[2].receipt.glyphs);
  assert.equal(guidedRow({ ...input, text: "", style: "independent" }).receipt.glyphs.length, 0);
});
for (const text of ["Zoë", "Ama🙂", "Ade\u0300le", "A<script>", "A&amp;", "Ama\nlia", "W".repeat(25)]) test(`literal refusal without normalization or fallback: ${JSON.stringify(text)}`, () => {
  assert.throws(() => prepareHandwritingDocument([{ ...fresh, handwritingRows: [{ ...input, text }] }]));
});
test("supported accents, spaces, apostrophe and hyphen remain exact", () => {
  for (const text of ["Adèle", "Ève", "Àà Èè", "O'Neil-A"]) assert.equal(composeHandwritingRow({ ...input, text, capHeight: 64 }).receipt.text, text);
});
test("placeholder missing, doubled, undeclared, forged, and duplicate IDs across pages fail", () => {
  for (const body of ["<p>No row</p>", fresh.body + fresh.body, fresh.body + "<!-- homa:handwriting ghost -->", composeHandwritingRow(input).markup]) assert.throws(() => prepareHandwritingDocument([{ ...fresh, body }]));
  assert.throws(() => prepareHandwritingDocument([fresh, fresh]), /repeated/);
  assert.throws(() => prepareHandwritingDocument([{ body: "<p>Manual tracing</p>", fresh: true }], true), /requires declared/);
});
test("packet selection stays 1-based and copied pages remain byte-identical in their new order", () => {
  const made = prepare();
  const original = joinPageBodies(["<p>Unchanged lesson</p>", made.bodies[0], "<p>Answer key</p>"]);
  const selected = selectMaterialPages(original, 2);
  assert.equal(selected.ok, true);
  if (!selected.ok) return;
  const originalReceipts = made.receipts.map((receipt) => ({ ...receipt, page: 2, documentRowId: `2/${receipt.input.id}` }));
  const next = prepareHandwritingDocument([
    { body: "<p>Fresh cover</p>", fresh: true },
    { body: selected.bodies[0], fresh: false, carriedRows: originalReceipts, carriedPage: 2 },
    { body: "<p>Answer key</p>", fresh: false },
  ]);
  assert.equal(next.bodies[1], selected.bodies[0]);
  assert.equal(next.bodies[2], "<p>Answer key</p>");
  assert.equal(next.receipts[0].page, 2);
  assert.equal(next.receipts[0].markupSha256, made.receipts[0].markupSha256);
  assert.equal(selectMaterialPages(original, 4).ok, false);
});
test("carried rows cannot lose receipts, change input/geometry/markup, or duplicate a row within one page", () => {
  const made = prepare();
  const carried = { body: made.bodies[0], fresh: false, carriedRows: made.receipts, carriedPage: 1 };
  assert.throws(() => prepareHandwritingDocument([{ ...carried, carriedRows: [] }]));
  assert.throws(() => prepareHandwritingDocument([{ ...carried, body: carried.body.replace('width="700"', 'width="350"') }]));
  assert.throws(() => prepareHandwritingDocument([{ ...carried, carriedRows: [{ ...made.receipts[0], input: { ...input, text: "Sam" } }] }]));
  const duplicated = prepareHandwritingDocument([carried, carried]);
  assert.deepEqual(duplicated.bodies, [carried.body, carried.body]);
  assert.deepEqual(duplicated.receipts.map((row) => row.documentRowId), ["1/amalia", "2/amalia"]);
  assert.throws(() => prepareHandwritingDocument([{ ...carried, body: carried.body + carried.body }]), /differs/);
  assert.throws(() => selectCarriedHandwritingRows({}));
});
test("ordinary legacy HTML and page bodies are preserved; errors are bounded and specific", () => {
  const bodies = ["<svg><path d='M0 0L100 100'/></svg>", "<h1>Other lesson</h1>"];
  assert.deepEqual(prepareHandwritingDocument(bodies.map((body) => ({ body, fresh: false }))).bodies, bodies);
  assert.equal(handwritingFailureNote(Error("private")), null);
  assert.match(handwritingFailureNote(new GuidedRowError("unsupported_character", "Unsupported character."))!, /Do not substitute/);
});


test("JSON object order does not invalidate unchanged saved handwriting receipts", () => {
  const made = prepare();
  const order = (value: unknown): unknown => Array.isArray(value)
    ? value.map(order)
    : value && typeof value === "object"
      ? Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.length - right.length || left.localeCompare(right)).map(([key, item]) => [key, order(item)]))
      : value;
  const stored = order(JSON.parse(JSON.stringify(made.receipts)));
  assert.deepEqual(stored, made.receipts);
  assert.notEqual(JSON.stringify(stored), JSON.stringify(made.receipts));
  const result = prepareHandwritingDocument([{ body: made.bodies[0], fresh: false, carriedRows: stored, carriedPage: 1 }]);
  assert.equal(result.bodies[0], made.bodies[0]);
  assert.deepEqual(result.receipts[0].composition, made.receipts[0].composition);
});
