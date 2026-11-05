import { defineEval } from "eve/evals";
import { activityPlanSchema, activityPlanRevisionRequest, readActivityPlan } from "../../lib/materials/activity-plan";

export default defineEval({
  description: "A short adjustable family activity plan uses typed material content without logging learning.",
  async test(t) {
    const turn = await t.send("Make a general example counting plan for a parent and a five-year-old. We have 20 minutes, paper, a pencil and buttons. Save it as an adjustable activity plan with an alternative for each activity. This is preparation, not completed learning.");
    t.succeeded();
    t.loadedSkill("materials-studio");
    t.eventsSatisfy("creates a valid twenty minute activity plan", () => turn.toolCalls.some(call => call.name === "create_printable" && activityPlanSchema.safeParse(call.input.activityPlan).success && (call.input.activityPlan as { minutes: number }).minutes === 20));
    const created = turn.toolCalls.find(call => call.name === "create_printable" && (call.output as { created?: boolean })?.created === true);
    t.eventsSatisfy("material save succeeds", () => Boolean(created));
    const material = (created?.output as { material?: { id?: string } } | undefined)?.material;
    if (material?.id) {
      const reopened = await t.send(`Reopen saved material ${material.id}. Do not create another version.`);
      t.eventsSatisfy("reopened material retains the typed plan", () => reopened.toolCalls.some(call => call.name === "show_material" && activityPlanSchema.safeParse((call.output as { material?: { activityPlan?: unknown } })?.material?.activityPlan).success));
      const plan = readActivityPlan((created?.output as { material?: { activityPlan?: unknown } })?.material?.activityPlan);
      if (plan) {
        const draft = { ...plan, minutes: 25, swapped: [plan.activities[0].id] };
        const revised = await t.send(activityPlanRevisionRequest(material.id, draft));
        t.eventsSatisfy("saving adjustments creates a linked version with the requested choices", () => revised.toolCalls.some(call => {
          const output = call.output as { created?: boolean; material?: { activityPlan?: unknown } };
          const saved = readActivityPlan(output?.material?.activityPlan);
          return call.name === "create_printable" && call.input.revisesId === material.id && output?.created === true && saved?.minutes === 25 && saved.swapped.includes(draft.swapped[0]);
        }));
        t.eventsSatisfy("revision does not approve or log learning", () => revised.toolCalls.every(call => !["mark_material_final", "manage_child_progress", "manage_hours", "manage_family_events"].includes(call.name)));
      }

    }
    t.eventsSatisfy("does not record completion or approve on behalf of parent", () => turn.toolCalls.every(call => !["mark_material_final", "manage_child_progress", "manage_hours", "manage_family_events"].includes(call.name)));
  },
});
