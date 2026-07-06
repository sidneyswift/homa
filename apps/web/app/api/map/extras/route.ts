import { mapExtrasSchema } from "@homa/core";

import { emitMapEvent } from "../../../../lib/map/events";
import { clientIp, rateLimited } from "../../../../lib/map/ratelimit";
import { requireLead } from "../../../../lib/map/session";
import { saveChildContext, saveFamilyContext } from "../../../../lib/map/store";

/**
 * POST /api/map/extras
 * The optional context step after the checklist (founder + Alessa session:
 * interests, multi help-with, what's working, homeschool style, curriculums,
 * values, notes, all AFTER she's invested, never up front). Merges into the
 * jsonb context bags; child ownership is re-checked in the store.
 */
export async function POST(request: Request): Promise<Response> {
  if (rateLimited(`extras:${clientIp(request)}`, 30)) {
    return Response.json({ ok: false }, { status: 429 });
  }

  const lead = await requireLead();
  if (!lead) {
    return Response.json({ ok: false, reason: "no-session" }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ ok: false, reason: "bad-json" }, { status: 400 });
  }
  const parsed = mapExtrasSchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json({ ok: false, reason: "invalid" }, { status: 400 });
  }
  const { child, family } = parsed.data;

  try {
    const savedKeys: string[] = [];

    if (child) {
      const { childId, ...fields } = child;
      const patch = Object.fromEntries(
        Object.entries(fields).filter(([, value]) =>
          Array.isArray(value) ? value.length > 0 : value !== undefined && value !== "",
        ),
      );
      if (Object.keys(patch).length > 0) {
        const saved = await saveChildContext(lead.id, childId, patch);
        if (!saved) return Response.json({ ok: false, reason: "unknown-child" }, { status: 400 });
        savedKeys.push(...Object.keys(patch));
      }
    }

    if (family) {
      const { firstName, usState, ...rest } = family;
      const patch = Object.fromEntries(
        Object.entries(rest).filter(([, value]) =>
          Array.isArray(value) ? value.length > 0 : value !== undefined && value !== "",
        ),
      );
      if (Object.keys(patch).length > 0 || firstName || usState) {
        await saveFamilyContext(lead.id, patch, firstName, usState);
        savedKeys.push(...Object.keys(patch));
      }
    }

    if (savedKeys.length > 0) {
      await emitMapEvent("map.context_added", {
        lead_id: lead.id,
        child_id: child?.childId,
        keys: savedKeys,
      });
    }

    return Response.json({ ok: true });
  } catch (error) {
    console.error("map/extras failed:", error instanceof Error ? error.message : "unknown");
    return Response.json({ ok: false }, { status: 502 });
  }
}
