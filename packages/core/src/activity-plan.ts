import { z } from "zod";

const activity = z.object({
  id: z.string().regex(/^[a-z0-9-]{1,40}$/).describe("Stable activity identity, retained across revisions."),
  title: z.string().trim().min(1).max(80).describe("Short activity name."),
  minutes: z.number().int().min(1).max(60).describe("Relative time allocation before fitting the parent's total."),
  instructions: z.string().trim().min(1).max(360).describe("Concrete instructions a parent can follow immediately."),
  materials: z.array(z.string().trim().min(1).max(60)).max(4).describe("Ordinary supplies needed for this activity."),
  alternative: z.object({
    title: z.string().trim().min(1).max(80).describe("Alternative activity for the same learning objective."),
    instructions: z.string().trim().min(1).max(360).describe("Instructions including any supplies needed for the alternative."),
  }).describe("A useful alternative that can be selected without another model call."),
});
export const activityPlanSchema = z.object({
  version: z.literal(1).describe("Activity plan format version."),
  introduction: z.string().trim().max(240).describe("Brief context without fixed timing or claims about mastery."),
  minutes: z.number().int().min(10).max(60).describe("The parent's selected total available minutes."),
  activities: z.array(activity).min(2).max(4).describe("Ordered activities, including any requested break."),
  swapped: z.array(z.string().max(40)).max(4).describe("IDs whose alternatives are selected; empty for the first draft."),
}).superRefine((plan, ctx) => {
  const ids = new Set(plan.activities.map(item => item.id));
  if (ids.size !== plan.activities.length || new Set(plan.swapped).size !== plan.swapped.length || plan.swapped.some(id => !ids.has(id)))
    ctx.addIssue({ code: "custom", message: "Activities need unique IDs and alternatives must name existing activities." });
});
export type ActivityPlan = z.infer<typeof activityPlanSchema>;
export function readActivityPlan(value: unknown): ActivityPlan | undefined {
  const parsed = activityPlanSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}
export function activityPlanMinutes(plan: ActivityPlan): number[] {
  const remainder = plan.minutes - plan.activities.length;
  const sum = plan.activities.reduce((total, item) => total + item.minutes, 0);
  const fractions = plan.activities.map(item => item.minutes / sum * remainder);
  const values = fractions.map(value => 1 + Math.floor(value));
  const order = fractions.map((value, index) => ({ index, fraction: value % 1 })).sort((a, b) => b.fraction - a.fraction);
  const extra = plan.minutes - values.reduce((a, b) => a + b, 0);
  for (let i = 0; i < extra; i++) values[order[i].index]++;
  return values;
}
export function selectedPlanActivities(plan: ActivityPlan) {
  const minutes = activityPlanMinutes(plan);
  return plan.activities.map((item, i) => ({ ...item, ...(plan.swapped.includes(item.id) ? item.alternative : {}), minutes: minutes[i], materials: plan.swapped.includes(item.id) ? [] : item.materials }));
}
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
/** The same typed content powers the interactive card and its printed version. */
export function activityPlanHtml(title: string, plan: ActivityPlan): string {
  return `<style>.activity-plan h1{font-size:26px;margin:0 0 10px}.activity-plan{font-size:15px;line-height:1.4}.activity-plan section{margin:18px 0}.activity-plan h2{font-size:18px;margin:0 0 6px}.activity-plan p{margin:6px 0}</style><article class="activity-plan"><h1>${escapeHtml(title)}</h1><p>${plan.minutes} minutes</p><p>${escapeHtml(plan.introduction)}</p>${selectedPlanActivities(plan).map((item, index) => `<section><h2>${index + 1}. ${escapeHtml(item.title)} · ${item.minutes} min</h2><p>${escapeHtml(item.instructions)}</p>${item.materials.length ? `<p>Gather: ${item.materials.map(escapeHtml).join(", ")}</p>` : ""}</section>`).join("")}</article>`;
}
export function activityPlanRevisionRequest(id: string, plan: ActivityPlan): string {
  return `Please save a new version of material ${id} as an adjustable activity plan with ${plan.minutes} minutes. Keep the same activities and alternatives. Selected alternatives: ${plan.swapped.length ? plan.swapped.join(", ") : "none"}. Use the saved material as the source. Do not schedule or log this as completed learning.`;
}
