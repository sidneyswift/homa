import { defineEval } from "eve/evals";
import { parseMaterialPrintPart } from "@homa/core";
import { EVAL_FIXTURE_MATERIAL_DRAFT_ID } from "../../lib/family-context-eval-fixture";
import { activeMaterialContext } from "../../lib/voice/active-material";

export default defineEval({
  description: "An explicit print request prepares the exact visible draft with the requested copies and exclusion option.",
  async test(t) {
    const turn = await t.send({
      message: "Print two copies of this without an answer key, please.",
      clientContext: activeMaterialContext({ id: EVAL_FIXTURE_MATERIAL_DRAFT_ID, title: "Maya's Fresh Letter Sounds Page", status: "draft", revisesId: null, pageCount: 1, pageRoles: ["child"] }),
    });
    t.succeeded();
    t.loadedSkill("materials-studio");
    t.eventsSatisfy("the exact visible ID and requested options reach preparation", () => turn.toolCalls.some((call) => call.name === "prepare_material_print" && call.input.materialId === EVAL_FIXTURE_MATERIAL_DRAFT_ID && call.input.copies === 2 && call.input.includeAnswerKey === false));
    t.eventsSatisfy("the actual tool result supplies a coherent final material and the requested print selection", () => turn.toolCalls.some((call) => {
      const result = parseMaterialPrintPart({ type: "dynamic-tool", state: "output-available", toolName: call.name, output: call.output });
      return result?.ready === true
        && result.request.materialId === EVAL_FIXTURE_MATERIAL_DRAFT_ID
        && result.request.copies === 2
        && result.request.includeAnswerKey === false
        && result.request.pageCount === 1
        && result.request.pageIndexes.length === 1
        && result.request.pageIndexes[0] === 0
        && result.request.answerKeyExcluded === false;
    }));
    t.notCalledTool("create_printable");
    t.notCalledTool("mark_material_final");
  },
});
