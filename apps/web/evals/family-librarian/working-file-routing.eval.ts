import { gateway } from "ai";
import { HOMA_MODEL } from "../../agent/model";
import { defineEval } from "eve/evals";

export default defineEval({
  judge: { model: gateway(HOMA_MODEL) },
  description: "An explicit shared Markdown working file loads its procedure and checks the workspace without claiming an unavailable save.",
  async test(t) {
    await t.send("Please open our shared working file drafts/week-2-outline.md so we can continue it. This is a draft file, not a Library original or a finished worksheet.");
    t.succeeded();
    t.loadedSkill("family-librarian");
    t.calledTool("manage_workspace");
    t.judge.autoevals.closedQA("If the workspace tool returns unavailable, clearly say the file could not be opened. Do not invent its contents or claim to have read it.").gate();
  },
});
