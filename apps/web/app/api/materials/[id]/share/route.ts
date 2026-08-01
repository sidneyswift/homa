import { resolveApiFamily } from "../../../../../lib/api-auth";
import { emitMapEvent } from "../../../../../lib/map/events";
import { prepareMaterialShareCaller } from "../../../../../lib/materials/share";

export function createMaterialSharePost(dependencies: {
  resolveFamily: typeof resolveApiFamily;
  prepareShare: typeof prepareMaterialShareCaller;
  emitEvent: typeof emitMapEvent;
}) {
  return async function materialSharePost(
    request: Request,
    { params }: { params: Promise<{ id: string }> },
  ): Promise<Response> {
    const auth = await dependencies.resolveFamily(request);
    if (!auth) {
      return Response.json({ ready: false, reason: "no-session" }, { status: 401 });
    }

    const { id } = await params;
    const result = await dependencies.prepareShare({
      db: auth.supabase,
      familyId: auth.familyId,
      materialId: id,
    });
    if (!result.ready) return Response.json(result, { status: 409 });

    if (result.finalizedNow) {
      await dependencies.emitEvent("materials.finalized", {
        family_id: auth.familyId,
        channel: "web",
        versions_superseded: result.versionsSuperseded,
      });
    }

    return Response.json({ ready: true, shareRequest: result.request });
  };
}

export const POST = createMaterialSharePost({
  resolveFamily: resolveApiFamily,
  prepareShare: prepareMaterialShareCaller,
  emitEvent: emitMapEvent,
});
