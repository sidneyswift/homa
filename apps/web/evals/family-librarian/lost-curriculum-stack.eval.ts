import { defineEval } from "eve/evals";

/**
 * Regression for the lost curriculum stack journey: when a parent explicitly
 * names her uploaded copy, that family source must be retrieved before any
 * planning or authoring effect begins.
 */
export default defineEval({
  description:
    "Using an uploaded curriculum retrieves the exact Family Library source before planning or creation.",
  async test(t) {
    const turn = await t.send(
      "Use my uploaded Blossom and Root Early Years Science, Volume 1 as the source for a new twelve-week nature-study program for Maya. Find my copy before you plan or create anything.",
    );

    t.succeeded();
    t.loadedSkill("family-librarian");

    const names = turn.toolCalls.map((call) => call.name);
    const findIndex = names.indexOf("find_family_assets");
    const getIndex = names.indexOf("get_family_asset");
    const downstreamIndexes = [
      "start_agent_job",
      "create_printable",
      "preview_month_plan",
      "schedule_plan_activity",
    ]
      .map((name) => names.indexOf(name))
      .filter((index) => index >= 0);

    t.eventsSatisfy(
      "the family source was found and opened before downstream work",
      () =>
        findIndex >= 0 &&
        getIndex > findIndex &&
        downstreamIndexes.every((index) => index > getIndex),
    );
  },
});
