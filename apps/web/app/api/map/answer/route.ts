import { mapAnswerSchema } from "@homa/core";

import { emitMapEvent } from "../../../../lib/map/events";
import { clientIp, rateLimited } from "../../../../lib/map/ratelimit";
import { requireFamily } from "../../../../lib/map/session";
import { saveAnswer } from "../../../../lib/map/store";

/**
 * POST /api/map/answer
 * Step S3: save one chip tap. Upsert semantics make retries and back-button
 * changes idempotent; the store re-checks the child belongs to the caller's
 * lead before writing (every model-supplied id is re-scoped, the law).
 */
export async function POST(request: Request): Promise<Response> {
  if (rateLimited(`answer:${clientIp(request)}`, 120)) {
    return Response.json({ ok: false }, { status: 429 });
  }

  const family = await requireFamily();
  if (!family) {
    return Response.json({ ok: false, reason: "no-session" }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ ok: false, reason: "bad-json" }, { status: 400 });
  }
  const parsed = mapAnswerSchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json({ ok: false, reason: "invalid" }, { status: 400 });
  }

  try {
    const saved = await saveAnswer(family.id, parsed.data.childId, parsed.data.itemId, parsed.data.answer);
    if (!saved.ok) {
      return Response.json({ ok: false, reason: "unknown-item-or-child" }, { status: 400 });
    }

    await emitMapEvent("map.question_answered", {
      family_id: family.id,
      child_id: parsed.data.childId,
      subject: saved.subject ?? "unknown",
      answer: parsed.data.answer,
    });

    return Response.json({ ok: true });
  } catch (error) {
    console.error("map/answer failed:", error instanceof Error ? error.message : "unknown");
    return Response.json({ ok: false }, { status: 502 });
  }
}
