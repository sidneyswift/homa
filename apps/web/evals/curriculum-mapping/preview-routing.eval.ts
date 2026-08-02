import { defineEval } from "eve/evals";

/**
 * The source itself is synthetic in the sandbox, so this eval grades the
 * routing and consent boundary rather than pretending it can judge the model's
 * proposed unit structure without readable source pages.
 */
export default defineEval({
  description:
    "Breaking a ready uploaded curriculum into units loads curriculum-mapping, reads the source, and never approves before review.",
  async test(t) {
    const turn = await t.send(
      "Break my uploaded Blossom and Root Early Years Science, Volume 1 into its own weeks for Maya. Read my copy and show me the review before anything is saved. Do not approve it for me.",
    );

    // The sandbox fixture deliberately has no readable backing Blob. The
    // correct turn can therefore stop honestly after attempting the read.
    // Routing, retrieval, and the no-self-approval boundary are the behavior
    // this eval is equipped to prove.
    t.loadedSkill("family-librarian");
    t.loadedSkill("curriculum-mapping");
    t.calledTool("find_family_assets");
    t.calledTool("get_family_asset");
    t.calledTool("read_family_curriculum");
    t.eventsSatisfy(
      "the first turn does not approve its own preview",
      () => turn.toolCalls.every((call) => call.name !== "approve_curriculum_mapping"),
    );
  },
});
