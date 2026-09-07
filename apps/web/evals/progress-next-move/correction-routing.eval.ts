import { defineEval } from "eve/evals";

export default defineEval({
  description: "A too-easy cutting correction requesting one current-fit activity loads progress-next-move, not material creation or scheduling.",
  tags: ["progress-next-move", "routing"],
  async test(t) {
    const turn = await t.send("Those straight-line cutting strips are already easy for Maya. What one activity fits her fine-motor Progress now? I am not asking for a printable or a schedule.");
    t.succeeded();
    t.loadedSkill("progress-next-move");
    t.eventsSatisfy("No material, schedule, assessment, or internal-persistence effect", () => turn.toolCalls.every(call =>
      !["create_printable", "edit_plan", "schedule_plan_activity", "persist_progress_next_move"].includes(call.name)
      && !(call.name === "manage_child_progress" && ["start_check_in", "resume_check_in", "respond_check_in", "pause_check_in", "stop_check_in", "takeover_check_in"].includes(String(call.input.action)))));
  },
});
