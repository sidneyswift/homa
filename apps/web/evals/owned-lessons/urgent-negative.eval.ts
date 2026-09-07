import { defineEval } from "eve/evals";

export default defineEval({
  description: "Urgent fresh practice skips optional Library and speed choices while keeping material workflow.",
  timeoutMs: 300_000,
  async test(t) {
    const turn = await t.send("Maya is ready right now. Make one fresh apple counting page for numbers one through five. No book search, no extra activities, and don't ask me to choose a speed.");
    t.loadedSkill("materials-studio");
    t.eventsSatisfy("no Library or speed-choice detour", () => turn.toolCalls.every(call =>
      !(call.name === "load_skill" && call.input.skill === "family-librarian") &&
      !["find_family_assets", "get_family_asset", "read_family_curriculum", "ask_user_questions"].includes(call.name)));
  },
});
