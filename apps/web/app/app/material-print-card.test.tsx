import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { EveMessage } from "eve/react";
import { MessageView, messageRendersSomething } from "./message-parts";
import { MaterialPrintCard } from "./material-print-card";
import { parseMaterialPrintPart } from "@homa/core";
import { printFixtureRequest as request } from "../../lib/materials/print-fixture";
const part = { type: "dynamic-tool", toolName: "prepare_material_print", state: "output-available", output: { ready: true, printRequest: request, material: { id: request.materialId, title: request.title, pageCount: request.pageCount, status: "final" } } };
test("actual web transcript renders tool-only print receipt with explicit action and exact pages", () => {
  const message = { id: "synthetic", role: "assistant", parts: [part] } as unknown as EveMessage;
  assert.equal(messageRendersSomething(message), true);
  const html = renderToStaticMarkup(<MessageView message={message} familyId="synthetic-family" timeZone="UTC" />);
  assert.match(html, /Pages 1, 3 of 3/u); assert.match(html, /2 copies requested/u);
  assert.match(html, /Open selected PDF to print/u); assert.doesNotMatch(html, /Apple.*opening|sent to the printer/u);
});
test("refusal and malformed ready results remain visible without an action", () => {
  for (const output of [{ ready: false, note: "This version is stale. Show it again." }, { ...part.output, material: { ...part.output.material, id: "22222222-2222-4222-8222-222222222222" } }]) {
    const handoff = parseMaterialPrintPart({ ...part, output }); assert.ok(handoff); assert.equal(handoff.ready, false);
    const html = renderToStaticMarkup(<MaterialPrintCard handoff={handoff} />);
    assert.match(html, /Print preparation stopped/u); assert.doesNotMatch(html, /<button/u);
  }
});
