import { exportFamilyWorkspace } from "../../../../lib/family-workspace/export";
import { mapDb } from "../../../../lib/map/db";
import { requireFamilyWithActorFromRequest } from "../../../../lib/map/session";
import { exportConversationMessagesForAdult } from "../../../../lib/conversation-visibility";

/** A deliberately direct, free record export. It is available before deletion
 * but never participates in the deletion confirmation or job state. */
export async function GET(request: Request): Promise<Response> {
  const actor = await requireFamilyWithActorFromRequest(request);
  if (!actor?.memberUserId) {
    return Response.json({ ok: false, reason: "no-session" }, { status: 401 });
  }
  const sql = mapDb();
  const familyId = actor.family.id;
  const memberUserId = actor.memberUserId;
  const [family, children, hours, materials, library, calendar, memories, conversation, workspace] = await Promise.all([
    sql`select to_jsonb(family) - 'resume_token_hash' - 'link_token_hash' as value from public.families family where id = ${familyId}`,
    sql`select coalesce(jsonb_agg(to_jsonb(child) order by child.created_at), '[]'::jsonb) as value from public.children child where family_id = ${familyId}`,
    sql`select coalesce(jsonb_agg(to_jsonb(entry) order by entry.created_at), '[]'::jsonb) as value from public.hours_log entry where family_id = ${familyId}`,
    sql`select coalesce(jsonb_agg(to_jsonb(material) order by material.created_at), '[]'::jsonb) as value from public.materials material where family_id = ${familyId}`,
    sql`select coalesce(jsonb_agg(to_jsonb(asset) order by asset.created_at), '[]'::jsonb) as value from public.family_assets asset where family_id = ${familyId}`,
    sql`select coalesce(jsonb_agg(to_jsonb(event) order by event.created_at), '[]'::jsonb) as value from public.family_events event where family_id = ${familyId}`,
    sql`select coalesce(jsonb_agg(to_jsonb(memory) order by memory.created_at), '[]'::jsonb) as value from public.family_memories memory where family_id = ${familyId}`,
    exportConversationMessagesForAdult(sql, { familyId, memberUserId }),
    exportFamilyWorkspace(familyId),
  ]);
  const body = JSON.stringify({
    exportedAt: new Date().toISOString(),
    family: family[0]?.value ?? null,
    children: children[0]?.value ?? [],
    hours: hours[0]?.value ?? [],
    materials: materials[0]?.value ?? [],
    library: library[0]?.value ?? [],
    calendar: calendar[0]?.value ?? [],
    memories: memories[0]?.value ?? [],
    conversation,
    workspace,
  });
  return new Response(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="homa-family-record.json"',
      "Cache-Control": "no-store",
    },
  });
}
