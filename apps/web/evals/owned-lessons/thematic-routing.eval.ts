import { defineEval } from "eve/evals";

export default defineEval({
  description: "Optional relevant owned resources can enrich a theme without making a second project.",
  timeoutMs: 300_000,
  async test(t) {
    const turn = await t.send("Make Maya a seed observation page for our plant theme. If our uploaded Blossom and Root science has a useful seed activity, include a brief connection to it. Shared family resources are fine. Just this page, no scheduled or extra packet.");
    t.loadedSkill("family-librarian"); t.loadedSkill("materials-studio");
    t.eventsSatisfy("the optional shared-resource search is unfiltered and bounded", () => {
      const searches = turn.toolCalls.filter(call => call.name === "find_family_assets");
      return searches.length === 1 && searches[0].input.childId === undefined &&
        turn.toolCalls.filter(call => call.name === "get_family_asset").length <= 2 &&
        turn.toolCalls.filter(call => call.name === "read_family_curriculum").length <= 2;
    });
    t.eventsSatisfy("no durable decomposition or schedule", () => turn.toolCalls.every(call =>
      !["preview_family_curriculum", "approve_family_curriculum", "schedule_plan_activity", "preview_month_plan"].includes(call.name)));
  },
});
