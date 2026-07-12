import { z } from "zod";

import { liveProgressEnabled } from "../../../../lib/child-progress/flag";
import { resolveProgressConflict } from "../../../../lib/child-progress/runtime";
import { clientIp, rateLimited } from "../../../../lib/map/ratelimit";
import { requireFamilyWithActor } from "../../../../lib/map/session";

/**
 * POST /api/progress/conflict
 * The Progress page's inline confirm: the signed-in parent taps the
 * saved answer that fits today and the open conflict resolves through
 * the same service the agent uses. Tenant isolation: the family id
 * comes only from the authenticated session (auth-context law), and the
 * service re-scopes the conflict id, locks the resolver's membership
 * row, and validates the answer against the conflict's own two evidence
 * rows, so a foreign or stale id resolves nothing.
 */

const conflictResolutionRequestSchema = z.object({
  conflictId: z.uuid(),
  answer: z.enum(["easily", "getting_there", "not_yet"]),
  idempotencyKey: z.uuid(),
});

export async function POST(request: Request): Promise<Response> {
  if (rateLimited(`progress-conflict:${clientIp(request)}`, 30)) {
    return Response.json({ ok: false }, { status: 429 });
  }
  if (!liveProgressEnabled()) {
    return Response.json(
      { ok: false, reason: "disabled" },
      { status: 404 },
    );
  }

  let access;
  try {
    access = await requireFamilyWithActor();
  } catch (error) {
    console.error(
      "progress/conflict auth lookup failed:",
      error instanceof Error ? error.message : "unknown",
    );
    return Response.json(
      { ok: false, reason: "auth-lookup-failed" },
      { status: 502 },
    );
  }
  if (!access) {
    return Response.json(
      { ok: false, reason: "no-session" },
      { status: 401 },
    );
  }
  // Resolution is attributed to a specific adult; an anonymous
  // resume-cookie sitting cannot pick between two adults' answers.
  if (access.memberUserId === null) {
    return Response.json(
      { ok: false, reason: "no-member" },
      { status: 403 },
    );
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json(
      { ok: false, reason: "bad-json" },
      { status: 400 },
    );
  }
  const parsed = conflictResolutionRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json(
      { ok: false, reason: "invalid" },
      { status: 400 },
    );
  }

  try {
    const result = await resolveProgressConflict(
      {
        familyId: access.family.id,
        memberUserId: access.memberUserId,
        channel: "web",
        providerMessageId: null,
        repliedDeliveryId: null,
        episodeId: null,
        // No chat session exists on the Progress page; empty strings are
        // the codebase's no-session convention (delivery-binding.ts), so
        // a conflict-paused check-in resumes unbound and the next chat
        // turn can pick it up.
        runtimeSessionId: "",
        turnId: "",
        canonicalInboundText: null,
        inboundMessageId: null,
        now: new Date().toISOString(),
      },
      parsed.data,
    );

    const settled =
      result.status === "conflict_resolved" ||
      (result.status === "duplicate" &&
        result.original.status === "conflict_resolved");
    if (settled) {
      return Response.json({ ok: true });
    }
    switch (result.status) {
      case "no_active_check_in":
        return Response.json(
          { ok: false, reason: "unknown-conflict" },
          { status: 404 },
        );
      case "invalid_scope":
        // Already resolved, or the tapped answer is not one of the
        // conflict's two saved answers.
        return Response.json(
          { ok: false, reason: "not-open" },
          { status: 409 },
        );
      case "wrong_recipient":
        return Response.json(
          { ok: false, reason: "no-member" },
          { status: 403 },
        );
      case "idempotency_mismatch":
        return Response.json(
          { ok: false, reason: "idempotency-mismatch" },
          { status: 409 },
        );
      default:
        console.error(
          "progress/conflict unexpected service status:",
          result.status,
        );
        return Response.json(
          { ok: false, reason: "unexpected" },
          { status: 502 },
        );
    }
  } catch (error) {
    console.error(
      "progress/conflict failed:",
      error instanceof Error ? error.message : "unknown",
    );
    return Response.json({ ok: false }, { status: 502 });
  }
}
