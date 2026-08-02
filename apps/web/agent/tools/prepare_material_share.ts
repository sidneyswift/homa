import { z } from "zod";

import {
  defineBoundedTool,
  TOOL_DEADLINE,
} from "../../lib/agent-tool-deadline";
import { MissingFamilyContextError, resolveAgentAccess } from "../../lib/agent-db";
import { emitMapEvent } from "../../lib/map/events";
import {
  prepareMaterialShareCaller,
  prepareMaterialSharePinned,
} from "../../lib/materials/share";
import { usageChannelFromAttributes } from "../../lib/model-usage";

export default defineBoundedTool({
  description:
    "Prepare the server-verified visible material for the parent's native share sheet. Use only after the parent asks to share or send that material through an app they choose. The result opens a parent-controlled handoff, never proves delivery.",
  deadlineMs: TOOL_DEADLINE.fetch,
  repeatable: true,
  inputSchema: z.object({
    materialId: z.uuid().describe("The exact server-verified visible material id."),
  }),
  async execute(input, ctx) {
    const channel = usageChannelFromAttributes(ctx.session.auth.current?.attributes);
    if (channel === "subject_lesson") {
      return {
        ready: false,
        note: "Automatic lesson builds cannot approve or share materials. A parent must choose a material first.",
      };
    }
    let access;
    try {
      access = await resolveAgentAccess(ctx.session.auth.current?.attributes);
    } catch (error) {
      if (error instanceof MissingFamilyContextError) {
        return { ready: false, note: error.message };
      }
      throw error;
    }
    const result = access.mode === "pinned"
      ? await prepareMaterialSharePinned({ familyId: access.familyId, materialId: input.materialId })
      : await prepareMaterialShareCaller({ db: access.db, familyId: access.familyId, materialId: input.materialId });
    if (!result.ready) return result;

    if (result.finalizedNow) {
      await emitMapEvent("materials.finalized", {
        family_id: access.familyId,
        channel,
        versions_superseded: result.versionsSuperseded,
      });
    }

    return {
      ready: true,
      done: true,
      material: {
        id: result.material.id,
        title: result.material.title,
        kind: result.material.kind,
        skill: result.material.skill,
        childName: null,
        previewUrl: result.material.previewUrl,
        pdfUrl: result.material.pdfUrl,
        pageCount: result.material.pageCount,
        status: result.material.status,
      },
      shareRequest: result.request,
      note: "The parent can edit the optional note and choose the app and account. Say that Homa is getting the PDF ready, then showing her apps. Never say that the file was sent or delivered.",
    };
  },
});
