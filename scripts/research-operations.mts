import type { Sql } from "postgres";

interface TriggerResearchInput {
  baseUrl: string;
  secret: string;
  body: object;
  trigger: "manual" | "lab";
}

export interface TriggeredResearchRun {
  runId: string;
  sessionId: string;
  cellKey: string;
}

export interface ResearchTriggerResponse {
  ok: boolean;
  trigger: "manual" | "lab";
  requested: number;
  started: TriggeredResearchRun[];
  skipped: Array<{ cellKey: string; reason: string }>;
  failed: Array<{ cellKey: string; error: string }>;
}

export interface ResearchKnowledgeRow {
  id: string;
  runId: string;
  topicKey: string;
  lens: string | null;
  stage: string | null;
  title: string;
  summary: string;
  status: string;
  flaggedReason: string | null;
  citations: Array<{ url: string; claim: string }>;
}

export interface ResearchRunSnapshot {
  id: string;
  title: string;
  cellKey: string | null;
  trigger: string | null;
  status: string;
  error: string | null;
  summary: string | null;
  startedAt: string;
  finishedAt: string | null;
  rows: ResearchKnowledgeRow[];
}

let databasePromise: Promise<Sql> | null = null;

async function database(): Promise<Sql> {
  databasePromise ??= import("../apps/web/lib/map/db").then(({ mapDb }) =>
    mapDb(),
  );
  return await databasePromise;
}

export async function triggerResearch(
  input: TriggerResearchInput,
): Promise<ResearchTriggerResponse> {
  const response = await fetch(
    `${input.baseUrl.replace(/\/+$/u, "")}/eve/v1/research/run`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${input.secret}`,
        "content-type": "application/json",
        "x-homa-research-trigger": input.trigger,
      },
      body: JSON.stringify(input.body),
    },
  );
  const body = (await response.json()) as ResearchTriggerResponse & {
    note?: string;
  };
  if (!response.ok) {
    throw new Error(
      `Research trigger failed (${response.status}): ${body.note ?? "unknown"}`,
    );
  }
  return body;
}

export async function loadResearchRuns(
  runIds: string[],
): Promise<ResearchRunSnapshot[]> {
  if (runIds.length === 0) return [];
  const sql = await database();
  const [runs, rows] = await Promise.all([
    sql<
      Array<{
        id: string;
        title: string;
        research_cell_key: string | null;
        research_trigger: string | null;
        status: string;
        error: string | null;
        summary: string | null;
        started_at: string;
        finished_at: string | null;
      }>
    >`
      select id, title, research_cell_key, research_trigger, status,
             error, summary, started_at::text, finished_at::text
      from public.homa_task_runs
      where id = any(${sql.array(runIds)}::uuid[])
      order by started_at
    `,
    sql<
      Array<{
        id: string;
        run_id: string;
        topic_key: string;
        lens: string | null;
        stage: string | null;
        title: string;
        summary: string;
        status: string;
        flagged_reason: string | null;
        citations: Array<{ url: string; claim: string }>;
      }>
    >`
      select id, run_id, topic_key, lens, stage, title, summary, status,
             flagged_reason, citations
      from public.knowledge_bank
      where run_id = any(${sql.array(runIds)}::uuid[])
      order by created_at
    `,
  ]);

  return runs.map((run) => ({
    id: run.id,
    title: run.title,
    cellKey: run.research_cell_key,
    trigger: run.research_trigger,
    status: run.status,
    error: run.error,
    summary: run.summary,
    startedAt: run.started_at,
    finishedAt: run.finished_at,
    rows: rows
      .filter((row) => row.run_id === run.id)
      .map((row) => ({
        id: row.id,
        runId: row.run_id,
        topicKey: row.topic_key,
        lens: row.lens,
        stage: row.stage,
        title: row.title,
        summary: row.summary,
        status: row.status,
        flaggedReason: row.flagged_reason,
        citations: Array.isArray(row.citations) ? row.citations : [],
      })),
  }));
}

export async function waitForResearchRuns(
  runIds: string[],
  options: {
    timeoutMs?: number;
    pollMs?: number;
    onPoll?: (runs: ResearchRunSnapshot[]) => void;
  } = {},
): Promise<ResearchRunSnapshot[]> {
  const deadline = Date.now() + (options.timeoutMs ?? 20 * 60_000);
  const pollMs = options.pollMs ?? 3_000;
  for (;;) {
    const runs = await loadResearchRuns(runIds);
    options.onPoll?.(runs);
    if (
      runs.length === runIds.length &&
      runs.every((run) => run.status !== "running")
    ) {
      return runs;
    }
    if (Date.now() >= deadline) {
      throw new Error(
        `Timed out waiting for ${runIds.length} research run(s) after ${options.timeoutMs ?? 20 * 60_000}ms.`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
}

/**
 * Lab cleanup mirrors knowledge-revert.mts: flag rows produced by the
 * run and restore the predecessors they superseded. Runs stay as audit
 * records, which lets the lab report remain inspectable after cleanup.
 */
export async function revertResearchRuns(
  runIds: string[],
  reason: string,
): Promise<{ flagged: number; restored: number }> {
  const sql = await database();
  let flaggedCount = 0;
  let restoredCount = 0;
  for (const runId of runIds) {
    const flagged = await sql<Array<{ id: string }>>`
      update public.knowledge_bank
      set status = 'flagged',
          flagged_reason = ${reason},
          updated_at = now()
      where run_id = ${runId}
        and status = 'active'
      returning id
    `;
    flaggedCount += flagged.length;
    for (const row of flagged) {
      const restored = await sql<Array<{ id: string }>>`
        update public.knowledge_bank
        set status = 'active',
            superseded_by = null,
            updated_at = now()
        where superseded_by = ${row.id}
          and status = 'superseded'
        returning id
      `;
      restoredCount += restored.length;
    }
  }
  return { flagged: flaggedCount, restored: restoredCount };
}

export async function closeResearchDatabase(): Promise<void> {
  if (!databasePromise) return;
  const sql = await databasePromise;
  await sql.end({ timeout: 5 });
  databasePromise = null;
}
