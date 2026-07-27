import { mapAnswerSchema } from "@homa/core";
import { z } from "zod";

import { liveProgressEnabled } from "../../../../lib/child-progress/flag";
import { emitMapEvent } from "../../../../lib/map/events";
import { clientIp, rateLimited } from "../../../../lib/map/ratelimit";
import { familyAccountCheckout } from "../../../../lib/billing/wall";
import { requireFamilyWithActor } from "../../../../lib/map/session";
import {
  deleteAnswerWithProgressStatus,
  saveAnswerWithProgressStatus,
} from "../../../../lib/map/store";

const answerAttemptFields = {
  idempotencyKey: z.uuid().optional(),
};
const saveAnswerSchema = mapAnswerSchema.extend({
  ...answerAttemptFields,
  source: z.enum(["checklist", "deep_dive"]).default("checklist"),
});
const clearAnswerSchema = mapAnswerSchema
  .pick({ childId: true, itemId: true })
  .extend(answerAttemptFields);

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

  let access;
  try {
    access = await requireFamilyWithActor();
  } catch (error) {
    console.error(
      "map/answer auth lookup failed:",
      error instanceof Error ? error.message : "unknown",
    );
    return Response.json(
      { ok: false, reason: "auth-lookup-failed" },
      { status: 502 },
    );
  }
  if (!access) {
    return Response.json({ ok: false, reason: "no-session" }, { status: 401 });
  }
  // The signup paywall gates the pipeline, not only the pages: a walled
  // account must not keep answering toward the report the gate exists
  // to sell (the dc4ab64b bypass class).
  if ((await familyAccountCheckout(access.family.id)) !== null) {
    return Response.json({ ok: false, reason: "walled" }, { status: 403 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ ok: false, reason: "bad-json" }, { status: 400 });
  }
  const parsed = saveAnswerSchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json({ ok: false, reason: "invalid" }, { status: 400 });
  }
  if (liveProgressEnabled() && !parsed.data.idempotencyKey) {
    return Response.json(
      { ok: false, reason: "missing-idempotency-key" },
      { status: 400 },
    );
  }

  try {
    const saved = await saveAnswerWithProgressStatus(
      access.family.id,
      parsed.data.childId,
      parsed.data.itemId,
      parsed.data.answer,
      {
        source: parsed.data.source,
        memberUserId: access.memberUserId,
        channel: "web",
        idempotencyKey: parsed.data.idempotencyKey,
      },
    );
    switch (saved.result.status) {
      case "saved":
        break;
      case "unknown_child_or_item":
        return Response.json(
          { ok: false, reason: "unknown-item-or-child" },
          { status: 400 },
        );
      case "unknown_actor":
        return Response.json(
          { ok: false, reason: "unknown-actor" },
          { status: 403 },
        );
      case "idempotency_mismatch":
        return Response.json(
          { ok: false, reason: "idempotency-mismatch" },
          { status: 409 },
        );
      case "conflict_pending":
        return Response.json(
          {
            ok: false,
            reason: "conflict-pending",
            conflictId: saved.result.conflictId,
          },
          { status: 409 },
        );
      default: {
        const exhaustiveResult: never = saved.result;
        return exhaustiveResult;
      }
    }

    await emitMapEvent("map.question_answered", {
      family_id: access.family.id,
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

/**
 * DELETE /api/map/answer
 * Clear one chip tap when the parent undoes an answer. The store re-scopes
 * both child id and item id before deleting so local UI state cannot clear a
 * row outside the caller's family.
 */
export async function DELETE(request: Request): Promise<Response> {
  if (rateLimited(`answer-delete:${clientIp(request)}`, 120)) {
    return Response.json({ ok: false }, { status: 429 });
  }

  let access;
  try {
    access = await requireFamilyWithActor();
  } catch (error) {
    console.error(
      "map/answer delete auth lookup failed:",
      error instanceof Error ? error.message : "unknown",
    );
    return Response.json(
      { ok: false, reason: "auth-lookup-failed" },
      { status: 502 },
    );
  }
  if (!access) {
    return Response.json({ ok: false, reason: "no-session" }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ ok: false, reason: "bad-json" }, { status: 400 });
  }
  const parsed = clearAnswerSchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json({ ok: false, reason: "invalid" }, { status: 400 });
  }
  if (liveProgressEnabled() && !parsed.data.idempotencyKey) {
    return Response.json(
      { ok: false, reason: "missing-idempotency-key" },
      { status: 400 },
    );
  }

  try {
    const deleted = await deleteAnswerWithProgressStatus(
      access.family.id,
      parsed.data.childId,
      parsed.data.itemId,
      {
        memberUserId: access.memberUserId,
        idempotencyKey: parsed.data.idempotencyKey,
      },
    );
    switch (deleted.result.status) {
      case "saved":
        break;
      case "unknown_child_or_item":
        return Response.json(
          { ok: false, reason: "unknown-item-or-child" },
          { status: 400 },
        );
      case "unknown_actor":
        return Response.json(
          { ok: false, reason: "unknown-actor" },
          { status: 403 },
        );
      case "idempotency_mismatch":
        return Response.json(
          { ok: false, reason: "idempotency-mismatch" },
          { status: 409 },
        );
      case "conflict_pending":
        return Response.json(
          {
            ok: false,
            reason: "conflict-pending",
            conflictId: deleted.result.conflictId,
          },
          { status: 409 },
        );
      default: {
        const exhaustiveResult: never = deleted.result;
        return exhaustiveResult;
      }
    }

    return Response.json({ ok: true });
  } catch (error) {
    console.error("map/answer delete failed:", error instanceof Error ? error.message : "unknown");
    return Response.json({ ok: false }, { status: 502 });
  }
}
