import { defineEval } from "eve/evals";

import { hasTargetedLessonReadOrSourceRefusal } from "./targeted-read-path";

/** Real Eve routing, separate from controlled source/quality evaluation. The
 * shared sandbox fixture can be unreadable, so an honest stop is valid here. */
export default defineEval({
  description: "Named uploaded lesson practice opens the owned source and uses its reader without whole-book mapping.",
  timeoutMs: 300_000,
  async test(t) {
    const turn = await t.send("Use my uploaded Blossom and Root Early Years Science, Volume 1 lesson 12 for Maya. I want one extra practice page from that actual lesson. Read it first; if it cannot be read, tell me exactly that and do not invent it. Do not map the book or schedule lessons.");
    t.succeeded(); t.loadedSkill("family-librarian");
    const names = turn.toolCalls.map(call => call.name);
    t.eventsSatisfy("a ready owned source is actually read, or source access returns an explicit refusal", () =>
      hasTargetedLessonReadOrSourceRefusal(turn.toolCalls));
    t.eventsSatisfy("the owned source is opened before reading or authoring", () => {
      const opened = names.indexOf("get_family_asset");
      return opened >= 0 && names.every((name, index) => !["read_family_curriculum", "create_printable"].includes(name) || index > opened);
    });
    t.eventsSatisfy("no decomposition or scheduling detour", () => turn.toolCalls.every(call =>
      !(call.name === "load_skill" && call.input.skill === "curriculum-mapping") &&
      !["preview_family_curriculum", "approve_family_curriculum", "schedule_plan_activity", "preview_month_plan"].includes(call.name)));
    t.eventsSatisfy("any requested creation has exact source evidence", () => turn.toolCalls.filter(call => call.name === "create_printable")
      .every(call => Array.isArray(call.input.sourceFamilyEvidence) && call.input.sourceFamilyEvidence.length > 0));
  },
});
