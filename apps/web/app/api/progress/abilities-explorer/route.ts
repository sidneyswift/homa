import { z } from "zod";

import { abilitiesExplorerEnabled } from "../../../../lib/child-progress/abilities-explorer-flag";
import { resolveApiFamily } from "../../../../lib/api-auth";
import { clientIp, rateLimited } from "../../../../lib/map/ratelimit";
import { emitMapEvent } from "../../../../lib/map/events";

const explorerEventRequestSchema = z
  .object({
    event: z.enum([
      "progress.explorer_opened",
      "progress.explorer_subject_selected",
      "progress.explorer_ability_detail_opened",
      "progress.explorer_find_opened",
      "progress.explorer_connected_ability_opened",
      "progress.explorer_ask_homa_opened",
    ]),
    childId: z.uuid(),
    subject: z.enum(["math", "literacy", "science"]),
    device: z.enum(["desktop", "phone", "tablet", "unknown"]),
  })
  .strict();

type ExplorerEventRequest = z.infer<typeof explorerEventRequestSchema>;

/**
 * The explorer is read-only, but its funnel is still authenticated. The
 * server derives family_id from the session and verifies that the submitted
 * child belongs to that family before inserting a content-free event.
 */
export async function POST(request: Request): Promise<Response> {
  if (!abilitiesExplorerEnabled()) {
    return Response.json({ ok: false, reason: "disabled" }, { status: 404 });
  }

  const auth = await resolveApiFamily(request);
  if (!auth) {
    return Response.json({ ok: false, reason: "no-session" }, { status: 401 });
  }
  if (rateLimited(`progress-explorer:${auth.familyId}:${clientIp(request)}`, 120)) {
    return Response.json({ ok: false, reason: "rate-limited" }, { status: 429 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ ok: false, reason: "bad-json" }, { status: 400 });
  }
  const parsed = explorerEventRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json({ ok: false, reason: "invalid" }, { status: 400 });
  }
  const input = parsed.data;

  const child = await auth.supabase
    .from("children")
    .select("id")
    .eq("id", input.childId)
    .eq("family_id", auth.familyId)
    .maybeSingle();
  if (child.error) {
    return Response.json({ ok: false, reason: "read-failed" }, { status: 500 });
  }
  if (!child.data) {
    return Response.json({ ok: false, reason: "not-found" }, { status: 404 });
  }

  const props = {
    family_id: auth.familyId,
    child_id: input.childId,
    subject: input.subject,
    device: input.device,
  } as const;

  switch (input.event) {
    case "progress.explorer_opened":
      await emitMapEvent(input.event, props);
      break;
    case "progress.explorer_subject_selected":
      await emitMapEvent(input.event, props);
      break;
    case "progress.explorer_ability_detail_opened":
      await emitMapEvent(input.event, props);
      break;
    case "progress.explorer_find_opened":
      await emitMapEvent(input.event, props);
      break;
    case "progress.explorer_connected_ability_opened":
      await emitMapEvent(input.event, props);
      break;
    case "progress.explorer_ask_homa_opened":
      await emitMapEvent(input.event, props);
      break;
  }

  return Response.json({ ok: true });
}

export type { ExplorerEventRequest };
