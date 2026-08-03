import {
  CAPTURE_LOOP_EVENT_NAME,
  captureLoopEventPropsSchema,
  captureLoopTraceIssues,
  type CaptureLoopEventProps,
} from "@homa/core";
import { randomUUID } from "node:crypto";
import { z } from "zod";

import { mapDb } from "./map/db";

const nativeCaptureLoopOutcomeRequestSchema = z
  .object({
    loop_id: z.uuid(),
    receipt_id: z.uuid(),
  })
  .strict();

export interface MobileCaptureLoopOutcomeDependencies {
  rateLimited: (request: Request) => boolean;
  authenticate: (request: Request) => Promise<{ id: string } | null>;
  loadEvents: (familyId: string, loopId: string) => Promise<ReadonlyArray<unknown>>;
  loadReceiptBinding: (
    familyId: string,
    loopId: string,
    receiptId: string,
  ) => Promise<boolean>;
  persist: (familyId: string, props: CaptureLoopEventProps) => Promise<void>;
  logError: (message: string, error?: unknown) => void;
}

function response(body: Record<string, unknown>, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

function parseOutcomeRequest(raw: unknown):
  | { success: true; data: { loop_id: string; receipt_id: string } }
  | { success: false } {
  const parsed = nativeCaptureLoopOutcomeRequestSchema.safeParse(raw);
  return parsed.success ? parsed : { success: false };
}

function parseEvents(rawEvents: ReadonlyArray<unknown>): CaptureLoopEventProps[] | null {
  const parsed = rawEvents.map((raw) => captureLoopEventPropsSchema.safeParse(raw));
  return parsed.every((event) => event.success)
    ? parsed.map((event) => event.data)
    : null;
}

function isSupportedNativeScheduleTrace(
  events: ReadonlyArray<CaptureLoopEventProps>,
): boolean {
  if (events.length !== 2 && events.length !== 3) return false;
  const ordered = [...events].sort((left, right) => left.sequence - right.sequence);
  const first = ordered[0];
  const last = ordered.at(-1);
  if (!first || !last) return false;
  if (
    first.client_context.client !== "ios" &&
    first.client_context.client !== "android"
  ) return false;
  if (
    first.profile !== "direct_mutation" ||
    first.intent !== "schedule_learning" ||
    first.surface !== "planner" ||
    first.object_kind !== "plan_activity"
  ) return false;
  if (
    first.stage !== "entry_intent" ||
    (last.stage !== "effect_attempted" && last.stage !== "outcome_uncertain")
  ) {
    return false;
  }
  if (
    ordered.some(
      (event) =>
        event.object_id !== null ||
        event.profile !== "direct_mutation" ||
        event.intent !== "schedule_learning" ||
        event.surface !== "planner" ||
        event.object_kind !== "plan_activity" ||
        event.client_context.client !== first.client_context.client,
    )
  ) {
    return false;
  }
  if (
    ordered.length === 3 &&
    (ordered[1]?.stage !== "effect_attempted" ||
      ordered[2]?.stage !== "outcome_uncertain")
  ) {
    return false;
  }
  return captureLoopTraceIssues(ordered).length === 0;
}

/**
 * Authenticated server boundary for a native direct schedule mutation. The
 * app can report that it tried; only this route can append a verified outcome
 * after the durable schedule receipt has been re-read and family-scoped by
 * the persistence layer.
 */
export function createMobileCaptureLoopOutcomeHandler(
  dependencies: MobileCaptureLoopOutcomeDependencies,
): (request: Request) => Promise<Response> {
  return async (request) => {
    if (dependencies.rateLimited(request)) {
      return response({ ok: false, reason: "rate-limited" }, 429);
    }

    let family: { id: string } | null;
    try {
      family = await dependencies.authenticate(request);
    } catch (error) {
      dependencies.logError("mobile capture loop auth lookup failed", error);
      return response({ ok: false, reason: "auth-lookup-failed" }, 502);
    }
    if (!family) return response({ ok: false, reason: "no-session" }, 401);

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return response({ ok: false, reason: "bad-json" }, 400);
    }
    const parsedRequest = parseOutcomeRequest(raw);
    if (!parsedRequest.success) {
      return response({ ok: false, reason: "invalid" }, 400);
    }

    let rawEvents: ReadonlyArray<unknown>;
    try {
      rawEvents = await dependencies.loadEvents(
        family.id,
        parsedRequest.data.loop_id,
      );
    } catch (error) {
      dependencies.logError("mobile capture loop lookup failed", error);
      return response({ ok: false, reason: "unavailable" }, 503);
    }
    const events = parseEvents(rawEvents);
    if (!events || events.length === 0) {
      return response({ ok: false, reason: "trace-not-found" }, 409);
    }

    const ordered = [...events].sort((left, right) => left.sequence - right.sequence);
    const existingOutcome = ordered.find(
      (event) =>
        event.stage === "outcome_verified" &&
        event.receipt_id === parsedRequest.data.receipt_id,
    );
    if (existingOutcome) {
      return response({ ok: true, already_recorded: true });
    }
    if (
      ordered.some((event) => event.stage === "outcome_verified") ||
      !isSupportedNativeScheduleTrace(ordered)
    ) {
      return response({ ok: false, reason: "trace-not-eligible" }, 409);
    }

    let receiptBound: boolean;
    try {
      receiptBound = await dependencies.loadReceiptBinding(
        family.id,
        parsedRequest.data.loop_id,
        parsedRequest.data.receipt_id,
      );
    } catch (error) {
      dependencies.logError("mobile capture loop receipt binding lookup failed", error);
      return response({ ok: false, reason: "unavailable" }, 503);
    }
    if (!receiptBound) {
      return response({ ok: false, reason: "receipt-not-bound" }, 409);
    }

    const first = ordered[0];
    const last = ordered.at(-1);
    if (!first || !last) {
      return response({ ok: false, reason: "trace-not-eligible" }, 409);
    }
    const outcome = captureLoopEventPropsSchema.safeParse({
      ...first,
      event_id: randomUUID(),
      stage: "outcome_verified",
      sequence: last.sequence + 1,
      object_id: parsedRequest.data.receipt_id,
      outcome_kind: "durable_change",
      result_state: "complete",
      receipt_kind: "database_receipt",
      receipt_id: parsedRequest.data.receipt_id,
      revision: null,
      revision_id: null,
      corrects_event_id: null,
      correction_result: null,
      exit_reason: null,
    });
    if (!outcome.success) {
      dependencies.logError("mobile capture loop outcome was invalid", outcome.error);
      return response({ ok: false, reason: "invalid-outcome" }, 500);
    }

    const issues = captureLoopTraceIssues([...ordered, outcome.data]);
    if (issues.length > 0) {
      dependencies.logError(
        "mobile capture loop outcome trace was invalid",
        issues.join("; "),
      );
      return response({ ok: false, reason: "trace-not-eligible" }, 409);
    }

    try {
      await dependencies.persist(family.id, outcome.data);
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("capture loop outcome receipt is already claimed")
      ) {
        try {
          const replayed = parseEvents(
            await dependencies.loadEvents(
              family.id,
              parsedRequest.data.loop_id,
            ),
          );
          const replayedOutcome = replayed?.find(
            (event) =>
              event.stage === "outcome_verified" &&
              event.receipt_id === parsedRequest.data.receipt_id,
          );
          if (replayedOutcome) {
            return response({ ok: true, already_recorded: true });
          }
        } catch (reloadError) {
          dependencies.logError(
            "mobile capture loop outcome replay lookup failed",
            reloadError,
          );
        }
        return response({ ok: false, reason: "receipt-already-claimed" }, 409);
      }
      dependencies.logError("mobile capture loop outcome persistence failed", error);
      return response({ ok: false, reason: "unavailable" }, 503);
    }
    return response({ ok: true, already_recorded: false });
  };
}

export async function loadNativeCaptureLoopEvents(
  familyId: string,
  loopId: string,
): Promise<ReadonlyArray<unknown>> {
  const sql = mapDb();
  const rows = await sql<{ props: unknown }[]>`
    select props
    from public.events
    where family_id = ${familyId}::uuid
      and name = ${CAPTURE_LOOP_EVENT_NAME}
      and props ->> 'loop_id' = ${loopId}
    order by created_at asc
  `;
  return rows.map((row) => row.props);
}

export async function hasNativeScheduleReceiptBinding(
  familyId: string,
  loopId: string,
  receiptId: string,
): Promise<boolean> {
  const sql = mapDb();
  const rows = await sql<{ present: boolean }[]>`
    select exists (
      select 1
      from public.mobile_capture_loop_receipts
      where family_id = ${familyId}::uuid
        and loop_id = ${loopId}::uuid
        and receipt_id = ${receiptId}::uuid
    ) as present
  `;
  return rows[0]?.present === true;
}
