import { defineEval } from "eve/evals";
import { satisfies } from "eve/evals/expect";

import { EVAL_FIXTURE_FAMILY_ID } from "../../lib/family-context-eval-fixture";
import { getMaterialPinned } from "../../lib/materials/library";
import { prepareHandwritingDocument } from "../../lib/materials/handwriting/document";
import { splitPageBodies } from "../../lib/materials/page-shell";

// Sandbox only. This grades the persisted artifact and its server receipts,
// not just model arguments. Run with the existing packet-page-revision eval.
export default defineEval({
  description: "Name practice uses measured rows, preserves exact case, and leaves approval to the parent.",
  timeoutMs: 600_000,
  async test(t) {
    const turn = await t.send("Maya recognizes the letters in her name and is ready to trace it. Make a big, simple name-writing page spelling it exactly Maya: one dark example, a dotted outline row, a pale row, and an empty row to try herself. No pictures or stroke-order arrows. Please show me the draft before saving it as a keeper.");
    t.loadedSkill("materials-studio");
    t.calledTool("read_file", { input: { filePath: /\/recipes\/name-tracing-page\.md$/u } });
    t.calledTool("create_printable", { output: (value) => (value as { created?: boolean })?.created === true });
    const output = turn.toolCalls.filter((call) => call.name === "create_printable")
      .map((call) => call.output as { created?: boolean; material?: { id?: string } })
      .find((result) => result?.created === true);
    const material = output?.material?.id ? await getMaterialPinned(EVAL_FIXTURE_FAMILY_ID, output.material.id) : null;
    const bodies = material?.html ? splitPageBodies(material.html) : [];
    const artifact = prepareHandwritingDocument(bodies.map((body, index) => ({ body, fresh: false, carriedRows: material?.handwritingRows, carriedPage: index + 1 })), true);
    t.check(artifact.receipts, satisfies((value) => {
      const rows = value as typeof artifact.receipts;
      return ["model", "dotted", "pale", "independent"].every((style) => rows.some((row) => row.input.style === style))
        && rows.every((row) => row.input.text === (row.input.style === "independent" ? "" : "Maya"));
    }, "stored rows have all requested support levels and exact spelling with authentic server geometry"));
    t.eventsSatisfy("no image fallback, automatic approval, or external delivery", () => !turn.toolCalls.some((call) => ["generate_image", "mark_material_final", "send_followup_email"].includes(call.name)));
  },
});
