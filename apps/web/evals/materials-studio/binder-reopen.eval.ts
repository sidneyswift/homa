import { defineEval } from "eve/evals";
import { EVAL_FIXTURE_PACKET_ID } from "../../lib/family-context-eval-fixture";

export default defineEval({
  description: "A named existing Binder workbook is found by title and reopened without creating or approving work.",
  async test(t) {
    const turn = await t.send("Show me Maya's Letter Sounds Workbook from the Binder.");
    t.succeeded();
    t.loadedSkill("materials-studio");
    t.eventsSatisfy("title retrieval leads to the actual saved workbook", () => {
      const found = turn.toolCalls.findIndex((call) => call.name === "find_materials" && typeof call.input.title === "string");
      const shown = turn.toolCalls.findIndex((call) => call.name === "show_material" && call.input.materialId === EVAL_FIXTURE_PACKET_ID);
      return found >= 0 && shown > found;
    });
    t.eventsSatisfy("Binder reopening does not search uploaded sources or mutate the material", () => turn.toolCalls.every((call) =>
      !["find_family_assets", "get_family_asset", "create_printable", "mark_material_final", "prepare_material_print"].includes(call.name)
      && (call.name !== "load_skill" || call.input.skill !== "family-librarian")));
  },
});
