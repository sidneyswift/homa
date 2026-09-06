import { z } from "zod";
import { isPrintMaterialId } from "@homa/core";
import type { resolveApiFamily } from "../api-auth";
import type { emitMapEvent } from "../map/events";
import type { prepareMaterialPrintCaller } from "./print";

const optionsSchema = z.object({
  copies: z.number().int().min(1).max(20).default(1),
  includeAnswerKey: z.boolean().default(true),
}).strict();
export function createMaterialPrintPost(deps: {
  resolveFamily: typeof resolveApiFamily;
  prepare: typeof prepareMaterialPrintCaller;
  emit: typeof emitMapEvent;
}) {
  return async function POST(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
    const auth = await deps.resolveFamily(request);
    if (!auth) return Response.json({ ready: false, reason: "no-session" }, { status: 401 });
    const { id } = await params;
    if (!isPrintMaterialId(id)) return Response.json({ ready: false, reason: "bad-material" }, { status: 400 });
    const parsed = optionsSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ ready: false, reason: "bad-options" }, { status: 400 });
    const result = await deps.prepare({ db: auth.supabase, familyId: auth.familyId, materialId: id, ...parsed.data });
    if (!result.ready) return Response.json(result, { status: 409 });
    if (result.finalizedNow) await deps.emit("materials.finalized", { family_id: auth.familyId, channel: "web", versions_superseded: result.versionsSuperseded });
    return Response.json({ ready: true, printRequest: result.printRequest }, { headers: { "Cache-Control": "private, no-store" } });
  };
}
