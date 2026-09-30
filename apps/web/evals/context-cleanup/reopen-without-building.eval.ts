import { defineEval } from "eve/evals";

export default defineEval({
  description: "Reopening a named Binder material loads retrieval guidance without starting a new build.",
  async test(t) {
    await t.send("Please find Finn's saved Dinosaur counting mat in Binder and reopen it. I want the existing page.");
    t.succeeded();
    t.loadedSkill("materials-studio");
    t.calledTool("read_file", { input: { filePath: "/workspace/skills/materials-studio/references/reopen-work.md" } });
    t.calledTool("find_materials");
    t.notCalledTool("create_printable");
    t.notCalledTool("generate_image");
  },
});
