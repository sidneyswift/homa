import {
  progressNextMoveDismissRequestSchema,
  progressNextMoveResponseSchema,
} from "@homa/core";
import { z } from "zod";

const childIdSchema = z.uuid();
const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" };

export interface NativeProgressNextMoveDependencies {
  enabled: () => boolean;
  ipRateLimited: (request: Request) => boolean;
  familyRateLimited: (input: {
    request: Request;
    familyId: string;
    childId: string;
  }) => boolean;
  authenticate: (
    request: Request,
  ) => Promise<{
    familyId: string;
    aiProcessingConsented: boolean;
  } | null>;
  prepare: (input: {
    familyId: string;
    childId: string;
    retryFailed?: boolean;
  }) => Promise<
    | {
        snapshot: {
          contextFingerprint: string;
          sourceRevision: bigint;
          view: unknown;
        };
        stored: {
          status: string;
          nextMove: unknown;
        };
      }
    | null
  >;
  dismiss: (input: {
    familyId: string;
    childId: string;
    contextFingerprint: string;
  }) => Promise<boolean>;
  logError: (message: string, error?: unknown) => void;
}

function json(payload: unknown, status = 200): Response {
  return Response.json(payload, { status, headers: NO_STORE_HEADERS });
}

/** The authenticated, read-only native boundary for one verified next move. */
export function createNativeProgressNextMoveHandler(
  dependencies: NativeProgressNextMoveDependencies,
): (
  request: Request,
  context: { params: Promise<{ childId: string }> },
) => Promise<Response> {
  return async (request, context) => {
    if (dependencies.ipRateLimited(request)) {
      return json({ ok: false, reason: "rate-limited" }, 429);
    }
    if (!dependencies.enabled()) {
      return json({ ok: false, reason: "disabled" }, 404);
    }

    let access: {
      familyId: string;
      aiProcessingConsented: boolean;
    } | null;
    try {
      access = await dependencies.authenticate(request);
    } catch (error) {
      dependencies.logError("progress next move auth lookup failed", error);
      return json({ ok: false, reason: "auth-lookup-failed" }, 502);
    }
    if (!access) return json({ ok: false, reason: "no-session" }, 401);
    if (!access.aiProcessingConsented) {
      return json({ ok: false, reason: "no-ai-consent" }, 403);
    }

    const childId = childIdSchema.safeParse((await context.params).childId);
    if (!childId.success) {
      return json({ ok: false, reason: "invalid-child" }, 400);
    }
    if (
      dependencies.familyRateLimited({
        request,
        familyId: access.familyId,
        childId: childId.data,
      })
    ) {
      return json({ ok: false, reason: "rate-limited" }, 429);
    }

    try {
      const retryFailed =
        new URL(request.url).searchParams.get("retry") === "1";
      const prepared = await dependencies.prepare({
        familyId: access.familyId,
        childId: childId.data,
        ...(retryFailed ? { retryFailed: true } : {}),
      });
      if (!prepared) {
        return json({ ok: false, reason: "unknown-child" }, 404);
      }
      const sharedPayload = {
        ok: true as const,
        contextFingerprint: prepared.snapshot.contextFingerprint,
        sourceRevision: prepared.snapshot.sourceRevision.toString(),
        view: prepared.snapshot.view,
      };
      const payload =
        prepared.stored.status === "pending"
          ? { ...sharedPayload, status: "pending" as const }
          : prepared.stored.status === "failed"
            ? {
                ...sharedPayload,
                status: "failed" as const,
                reason: "producer_unavailable" as const,
              }
            : {
                ...sharedPayload,
                status: "settled" as const,
                nextMove: prepared.stored.nextMove,
              };
      const parsed = progressNextMoveResponseSchema.safeParse(payload);
      if (
        !parsed.success ||
        parsed.data.view.childId !== childId.data ||
        (parsed.data.status === "settled" &&
          (parsed.data.nextMove.childId !== childId.data ||
            parsed.data.nextMove.sourceRevision !==
              parsed.data.sourceRevision))
      ) {
        dependencies.logError("progress next move produced an invalid child result");
        return json({ ok: false, reason: "invalid-result" }, 502);
      }
      return json(parsed.data);
    } catch (error) {
      dependencies.logError("progress next move failed", error);
      return json({ ok: false, reason: "unavailable" }, 502);
    }
  };
}

export function createNativeProgressNextMoveDismissHandler(
  dependencies: NativeProgressNextMoveDependencies,
): (
  request: Request,
  context: { params: Promise<{ childId: string }> },
) => Promise<Response> {
  return async (request, context) => {
    if (dependencies.ipRateLimited(request)) {
      return json({ ok: false, reason: "rate-limited" }, 429);
    }
    let access: {
      familyId: string;
      aiProcessingConsented: boolean;
    } | null;
    try {
      access = await dependencies.authenticate(request);
    } catch (error) {
      dependencies.logError("progress next move dismiss auth failed", error);
      return json({ ok: false, reason: "auth-lookup-failed" }, 502);
    }
    if (!access) return json({ ok: false, reason: "no-session" }, 401);
    const childId = childIdSchema.safeParse((await context.params).childId);
    if (!childId.success) {
      return json({ ok: false, reason: "invalid-child" }, 400);
    }
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return json({ ok: false, reason: "invalid-request" }, 400);
    }
    const parsed = progressNextMoveDismissRequestSchema.safeParse(body);
    if (!parsed.success) {
      return json({ ok: false, reason: "invalid-request" }, 400);
    }
    if (
      dependencies.familyRateLimited({
        request,
        familyId: access.familyId,
        childId: childId.data,
      })
    ) {
      return json({ ok: false, reason: "rate-limited" }, 429);
    }
    try {
      const dismissed = await dependencies.dismiss({
        familyId: access.familyId,
        childId: childId.data,
        contextFingerprint: parsed.data.contextFingerprint,
      });
      return dismissed
        ? json({ ok: true, dismissed: true })
        : json({ ok: false, reason: "stale-result" }, 409);
    } catch (error) {
      dependencies.logError("progress next move dismiss failed", error);
      return json({ ok: false, reason: "unavailable" }, 502);
    }
  };
}
