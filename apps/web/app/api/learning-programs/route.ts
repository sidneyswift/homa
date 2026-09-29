import { emitMapEvent } from "../../../lib/map/events";
import { z } from "zod";
import { resolveApiFamily } from "../../../lib/api-auth";
import { programDateSchema } from "../../../lib/learning-programs";
import {
  readLearningPrograms,
  saveLearningProgram,
  scheduleLearningProgram,
} from "../../../lib/learning-programs-server";

const headers = { "Cache-Control": "private, no-store" };
const occurrenceSchema = z.object({
  activityId: z.uuid(),
  revision: z.string().datetime({ offset: true }),
  operation: z.enum(["record", "cancel"]),
  minutes: z.number().int().min(1).max(600).nullable(),
});
export async function GET(request: Request) {
  const actor = await resolveApiFamily(request);
  if (!actor)
    return Response.json(
      { error: "Sign in to see your programs." },
      { status: 401, headers },
    );
  const query = new URL(request.url).searchParams;
  try {
    return Response.json(
      await readLearningPrograms(
        { mode: "caller", familyId: actor.familyId, db: actor.supabase },
        programDateSchema.parse(query.get("from")),
        programDateSchema.parse(query.get("through")),
      ),
      { headers },
    );
  } catch {
    return Response.json(
      { error: "Programs could not load. Try again." },
      { status: 503, headers },
    );
  }
}
export async function POST(request: Request) {
  const actor = await resolveApiFamily(request);
  if (!actor)
    return Response.json(
      { error: "Sign in to change your programs." },
      { status: 401, headers },
    );
  try {
    const body = await request.json();
    const access = {
      mode: "caller" as const,
      familyId: actor.familyId,
      db: actor.supabase,
    };
    let receipt;
    if (body.action === "save")
      receipt = await saveLearningProgram(access, body.input);
    else if (body.action === "schedule")
      receipt = await scheduleLearningProgram(access, body.input);
    else if (body.action === "occurrence") {
      const i = occurrenceSchema.parse(body.input);
      const { data, error } = await actor.supabase
        .rpc("change_program_occurrence", {
          f: actor.familyId,
          aid: i.activityId,
          revision: i.revision,
          operation: i.operation,
          minutes: i.minutes,
        })
        .abortSignal(AbortSignal.timeout(15_000));
      if (error) throw error;
      receipt = data;
      if (receipt?.result === "applied")
        await emitMapEvent("planner.program_changed", {
          family_id: actor.familyId,
          operation: i.operation === "record" ? "recorded" : "removed",
          count: 1,
        });
    } else
      return Response.json(
        { error: "Choose a supported change." },
        { status: 400, headers },
      );
    const accepted =
      receipt &&
      (receipt.status === "saved" ||
        receipt.status === "scheduled" ||
        receipt.result === "applied");
    return Response.json(
      accepted
        ? receipt
        : {
            error:
              "This record changed or needs review. Reload it before saving again.",
            receipt,
          },
      { status: accepted ? 200 : 409, headers },
    );
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof z.ZodError
            ? error.issues.map((i) => i.message).join(" ")
            : "The change could not be confirmed. Reload the record before trying again.",
      },
      { status: error instanceof z.ZodError ? 400 : 503, headers },
    );
  }
}
