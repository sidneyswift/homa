import { z } from "zod";

import { resolveApiFamily } from "../../../../../lib/api-auth";
import { emitMapEvent } from "../../../../../lib/map/events";
import { prepareMaterialPrintCaller } from "../../../../../lib/materials/print";

const optionsSchema = z.object({
  copies: z.number().int().min(1).max(20).default(1),
  includeAnswerKey: z.boolean().default(true),
});

/** Native Binder button twin of prepare_material_print. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await resolveApiFamily(request);
  if (!auth) return Response.json({ ready: false, reason: "no-session" }, { status: 401 });
  const { id } = await params;
  const parsed = optionsSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return Response.json({ ready: false, reason: "bad-options" }, { status: 400 });
  }
  const result = await prepareMaterialPrintCaller({
    db: auth.supabase,
    familyId: auth.familyId,
    materialId: id,
    ...parsed.data,
  });
  if (!result.ready) return Response.json(result, { status: 409 });
  if (result.finalizedNow) {
    await emitMapEvent("materials.finalized", {
      family_id: auth.familyId,
      channel: "web",
      versions_superseded: result.versionsSuperseded,
    });
  }
  return Response.json({ ready: true, printRequest: result.printRequest });
}
