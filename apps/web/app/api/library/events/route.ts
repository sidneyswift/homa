import { z } from "zod";

import { resolveApiFamily } from "../../../../lib/api-auth";
import { FAMILY_ASSET_STATUSES } from "../../../../lib/library/family-assets";
import { mapDb } from "../../../../lib/map/db";
import { emitMapEvent } from "../../../../lib/map/events";
import { clientIp, rateLimited } from "../../../../lib/map/ratelimit";

const libraryBeaconSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("reopened"),
      assetId: z.string().uuid(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("searched"),
      queryLength: z.number().int().min(0).max(180),
      activeFilters: z.number().int().min(0).max(4),
      resultCount: z.number().int().min(0).max(300),
    })
    .strict(),
]);

export async function POST(request: Request): Promise<Response> {
  if (rateLimited(`library-beacon:${clientIp(request)}`, 90)) {
    return Response.json({ ok: true });
  }
  const auth = await resolveApiFamily(request);
  if (!auth) {
    return Response.json({ ok: false, reason: "no-session" }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, reason: "bad-json" }, { status: 400 });
  }
  const parsed = libraryBeaconSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ ok: false, reason: "invalid" }, { status: 400 });
  }

  if (parsed.data.kind === "searched") {
    await emitMapEvent("library.searched", {
      family_id: auth.familyId,
      query_length: parsed.data.queryLength,
      active_filters: parsed.data.activeFilters,
      result_count: parsed.data.resultCount,
    });
    return Response.json({ ok: true });
  }

  const sql = mapDb();
  const rows = await sql<{ status: string }[]>`
    select status
    from public.family_assets
    where id = ${parsed.data.assetId}
      and family_id = ${auth.familyId}
      and deleted_at is null
    limit 1
  `;
  const parsedStatus = z.enum(FAMILY_ASSET_STATUSES).safeParse(rows[0]?.status);
  if (!parsedStatus.success) {
    return Response.json({ ok: true });
  }
  await emitMapEvent("library.asset_reopened", {
    family_id: auth.familyId,
    asset_id: parsed.data.assetId,
    status: parsedStatus.data,
  });
  return Response.json({ ok: true });
}
