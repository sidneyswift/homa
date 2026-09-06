import { defineEval } from "eve/evals";

export default defineEval({
  description: "Reopening an uploaded original stays in Family Library rather than generated Binder work.",
  async test(t) {
    const turn = await t.send("Find the original woodland counting worksheet PDF I uploaded to my Family Library, not a worksheet Homa made. I only want to reopen my copy.");
    t.succeeded();
    t.loadedSkill("family-librarian");
    t.calledTool("find_family_assets");
    t.eventsSatisfy("the uploaded-source request does not search or create Binder work", () => turn.toolCalls.every((call) =>
      !["find_materials", "show_material", "create_printable", "prepare_material_print", "mark_material_final"].includes(call.name)
      && (call.name !== "load_skill" || call.input.skill !== "materials-studio")));
  },
});
