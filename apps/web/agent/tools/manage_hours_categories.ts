import { z } from "zod";
import { resolveAgentAccess } from "../../lib/agent-db";
import { defineBoundedTool, TOOL_DEADLINE } from "../../lib/agent-tool-deadline";
import { readHoursCategories, saveHoursCategory } from "../../lib/hours-categories-server";
import { HOURS_SUBJECTS } from "../../lib/hours-model";
import { SUBJECT_LABELS } from "../../lib/hours-view";

export default defineBoundedTool({
  description: "Load the hours-records skill first, before creating or renaming categories. Then read, create or rename family Hours categories under a stable subject. Renaming changes the category on its existing time entries; it never changes minutes or progress.",
  deadlineMs: TOOL_DEADLINE.fetch,
  repeatable: false,
  inputSchema: z.object({
    action: z.enum(["list", "create", "rename"]).describe("Catalog operation requested by the parent."),
    subject: z.enum(HOURS_SUBJECTS).optional().describe("Stable parent subject. Required for create and rename; optional filter for list."),
    name: z.string().optional().describe("Requested category name, at most 40 characters. Required for create and rename."),
    categoryId: z.uuid().optional().describe("Owned category id from the catalog. Required for rename."),
    expectedName: z.string().optional().describe("Current name from the catalog. Required for rename to reject stale changes."),
  }),
  async execute(input, ctx) {
    try {
      const access = await resolveAgentAccess(ctx.session.auth.current?.attributes);
      if (input.action === "list") {
        const categories = await readHoursCategories(access);
        return { status: "ready", complete: true, categories: categories.filter(row => !input.subject || row.subject === input.subject).map(row => ({ ...row, subjectLabel: SUBJECT_LABELS[row.subject] })) };
      }
      if (!input.subject || !input.name || (input.action === "rename" && (!input.categoryId || input.expectedName === undefined))) return { status: "invalid", saved: false };
      return await saveHoursCategory(access, { subject: input.subject, name: input.name,
        ...(input.action === "rename" ? { categoryId: input.categoryId, expectedName: input.expectedName } : {}) });
    } catch { return { status: "unavailable", complete: false, note: "The category operation could not be confirmed. Do not claim it saved or that no categories exist." }; }
  },
});
