import {
  planActivityCheckRequestSchema,
  planActivityCheckResponseSchema,
  planActivityCheckRpcReceiptSchema,
  type PlanActivityCheckRequest,
} from "@homa/core";

export interface PlanActivityCheckRpcResult {
  data: unknown;
  error: { message?: string } | null;
}

export interface PlanActivityCheckActor {
  execute(input: PlanActivityCheckRequest): Promise<PlanActivityCheckRpcResult>;
}

export interface PlanActivityCheckRouteDependencies {
  isRateLimited(request: Request): boolean;
  authorize(request: Request): Promise<PlanActivityCheckActor | null>;
  emitProgress(input: {
    familyId: string;
    childId: string;
    subjectId: string;
    doneCount: number;
  }): Promise<void>;
  analyticsTimeoutMs?: number;
}

const DEFAULT_ANALYTICS_TIMEOUT_MS = 500;

/**
 * Policy shell for the authenticated atomic Planner check-off. The route
 * adapter supplies the caller-scoped Supabase client; this handler validates
 * the exact meaning and interprets the database receipt.
 */
export function createPlanActivityCheckHandler(
  dependencies: PlanActivityCheckRouteDependencies,
): (request: Request) => Promise<Response> {
  return async function handlePlanActivityCheck(request: Request): Promise<Response> {
    if (dependencies.isRateLimited(request)) {
      return Response.json(
        { status: "error", reason: "rate-limited" },
        { status: 429 },
      );
    }

    const actor = await dependencies.authorize(request);
    if (!actor) {
      return Response.json(
        { status: "error", reason: "no-session" },
        { status: 401 },
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json(
        { status: "error", reason: "bad-json" },
        { status: 400 },
      );
    }
    const parsed = planActivityCheckRequestSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { status: "error", reason: "invalid" },
        { status: 400 },
      );
    }
    const input = parsed.data;

    let rpc: PlanActivityCheckRpcResult;
    try {
      rpc = await actor.execute(input);
    } catch (error) {
      console.error(
        "map/plan/check failed:",
        error instanceof Error ? error.message : "operation threw",
      );
      return Response.json(
        { status: "error", reason: "write-uncertain" },
        { status: 502 },
      );
    }

    if (rpc.error || !Array.isArray(rpc.data) || rpc.data.length !== 1) {
      console.error(
        "map/plan/check failed:",
        rpc.error?.message ?? "operation returned no unique receipt",
      );
      return Response.json(
        { status: "error", reason: "write-uncertain" },
        { status: 502 },
      );
    }

    const receiptResult = planActivityCheckRpcReceiptSchema.safeParse(rpc.data[0]);
    if (!receiptResult.success) {
      console.error("map/plan/check failed: malformed operation receipt");
      return Response.json(
        { status: "error", reason: "receipt-invalid" },
        { status: 502 },
      );
    }
    const receipt = receiptResult.data;
    if (receipt.progress_key !== input.checkKey) {
      console.error("map/plan/check failed: receipt key mismatch");
      return Response.json(
        { status: "error", reason: "receipt-invalid" },
        { status: 502 },
      );
    }

    if (receipt.status === "conflict") {
      const conflict = planActivityCheckResponseSchema.parse({
        status: "conflict",
        reason: receipt.reason,
        planId: receipt.plan_id,
        planRevision: receipt.plan_revision,
        progressRevision: receipt.progress_revision,
        checkKey: receipt.progress_key,
      });
      return Response.json(conflict, { status: 409 });
    }

    if (
      receipt.done !== input.done ||
      receipt.plan_revision !== input.planRevision ||
      receipt.progress_snapshot[input.checkKey] !== input.done
    ) {
      console.error("map/plan/check failed: receipt meaning mismatch");
      return Response.json(
        { status: "error", reason: "receipt-invalid" },
        { status: 502 },
      );
    }

    const applied = planActivityCheckResponseSchema.parse({
      status: "applied",
      planId: receipt.plan_id,
      planRevision: receipt.plan_revision,
      progressRevision: receipt.progress_revision,
      progress: receipt.progress_snapshot,
      checkKey: receipt.progress_key,
      done: receipt.done,
    });

    if (receipt.changed) {
      const emission = dependencies.emitProgress({
        familyId: receipt.family_id,
        childId: input.childId,
        subjectId: input.subjectId,
        doneCount: Object.values(receipt.progress_snapshot).filter(Boolean).length,
      }).catch((error: unknown) => {
        console.error(
          "map/plan/check analytics failed:",
          error instanceof Error ? error.message : "unknown",
        );
      });
      let analyticsTimer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          emission,
          new Promise<void>((resolve) => {
            analyticsTimer = setTimeout(
              resolve,
              dependencies.analyticsTimeoutMs ?? DEFAULT_ANALYTICS_TIMEOUT_MS,
            );
          }),
        ]);
      } finally {
        if (analyticsTimer !== undefined) clearTimeout(analyticsTimer);
      }
    }

    return Response.json(applied);
  };
}
