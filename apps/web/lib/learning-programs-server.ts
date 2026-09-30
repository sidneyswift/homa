import { emitMapEvent } from "./map/events";
import { z } from "zod";
import type { AgentAccess } from "./agent-db";
import {
  programDateSchema,
  programDraftSchema,
  programScheduleSchema,
  type ProgramCatalog,
  type ProgramDraft,
  type ProgramSchedule,
} from "./learning-programs";
import { mapDb, type DbJson } from "./map/db";

export async function readLearningPrograms(
  access: AgentAccess,
  from: string,
  through: string,
): Promise<ProgramCatalog> {
  programDateSchema.parse(from);
  programDateSchema.parse(through);
  if (
    through < from ||
    (Date.parse(through) - Date.parse(from)) / 86400000 > 366
  )
    throw new Error("Choose at most one year.");
  if (access.mode === "caller") {
    const { data, error } = await access.db
      .rpc("read_learning_programs", {
        f: access.familyId,
        first_date: from,
        last_date: through,
      })
      .abortSignal(AbortSignal.timeout(15_000));
    if (error || !data) throw new Error("Programs could not load.");
    return data as ProgramCatalog;
  }
  return (await mapDb().begin("read only", async (tx) => {
    await tx`set local statement_timeout='15s'`;
    return (
      await tx`select public.read_learning_programs_pinned(${access.familyId}::uuid,${from}::date,${through}::date) as result`
    )[0].result as ProgramCatalog;
  })) as ProgramCatalog;
}
const receiptSchema = z.object({
  status: z.enum([
    "saved",
    "scheduled",
    "invalid",
    "not_found",
    "conflict",
    "limit",
    "overlap",
  ]),
  id: z.uuid().optional(),
  revision: z.number().optional(),
  created: z.number().optional(),
  existing: z.number().optional(),
  hoursAdded: z.number().optional(),
});
export async function saveLearningProgram(
  access: AgentAccess,
  request: ProgramDraft,
) {
  const input = programDraftSchema.parse(request);
  if (access.mode === "caller") {
    const { data, error } = await access.db
      .rpc("save_learning_program", { f: access.familyId, payload: input })
      .abortSignal(AbortSignal.timeout(15_000));
    if (error) throw new Error("Program save could not be confirmed.");
    return tracked(access.familyId, receiptSchema.parse(data));
  }
  const receipt = await mapDb().begin(async (tx) => {
    await tx`set local statement_timeout='15s'`;
    await tx`set local lock_timeout='3s'`;
    return receiptSchema.parse(
      (
        await tx`select public.save_learning_program_pinned(${access.familyId}::uuid,${tx.json(input as unknown as DbJson)}) as result`
      )[0].result,
    );
  });
  return tracked(access.familyId, receipt);
}
export async function scheduleLearningProgram(
  access: AgentAccess,
  request: ProgramSchedule,
) {
  const input = programScheduleSchema.parse(request);
  if (access.mode === "caller") {
    const { data, error } = await access.db
      .rpc("schedule_learning_program", {
        f: access.familyId,
        pid: input.programId,
        rev: input.expectedRevision,
        first_date: input.from,
        last_date: input.through,
        excluded: input.excludedDates,
      })
      .abortSignal(AbortSignal.timeout(15_000));
    if (error) throw new Error("Schedule save could not be confirmed.");
    return tracked(access.familyId, receiptSchema.parse(data));
  }
  const receipt = await mapDb().begin(async (tx) => {
    await tx`set local statement_timeout='15s'`;
    await tx`set local lock_timeout='3s'`;
    return receiptSchema.parse(
      (
        await tx`select public.schedule_learning_program_pinned(${access.familyId}::uuid,${input.programId}::uuid,${input.expectedRevision},${input.from}::date,${input.through}::date,${tx.array(input.excludedDates)}::date[]) as result`
      )[0].result,
    );
  });
  return tracked(access.familyId, receipt);
}

async function tracked(
  familyId: string,
  receipt: z.infer<typeof receiptSchema>,
) {
  if (receipt.status === "saved" || receipt.status === "scheduled")
    await emitMapEvent("planner.program_changed", {
      family_id: familyId,
      operation: receipt.status,
      count: receipt.created ?? 1,
    });
  return receipt;
}
