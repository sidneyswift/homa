import type { Sql } from "postgres";

interface TriggerResearchInput {
  baseUrl: string;
  secret: string;
  body: object;
  trigger: "manual" | "lab";
  expectedProjectRef?: string | null;
}

export interface TriggeredResearchRun {
  runId: string;
  sessionId: string;
  cellKey: string;
}

export interface ResearchTriggerResponse {
  ok: boolean;
  trigger: "manual" | "lab";
  projectRef: string | null;
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

function isLocalServiceUrl(value: string): boolean {
  const hostname = new URL(value).hostname;
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname.endsWith(".local")
  );
}

/**
 * Polling/revert must inspect the same environment the HTTP trigger
 * started. A local app pointed at hosted Supabase (or the reverse) would
 * otherwise run work in one environment and report/clean another.
 */
export function assertResearchTargetsCompatible(
  baseUrl: string,
  databaseUrl: string | undefined,
): void {
  if (!databaseUrl) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL is required when polling or reverting research.",
    );
  }
  if (isLocalServiceUrl(baseUrl) !== isLocalServiceUrl(databaseUrl)) {
    throw new Error(
      `Research target mismatch: trigger=${baseUrl} database=${databaseUrl}.`,
    );
  }
}

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
      body: JSON.stringify({
        ...input.body,
        ...(input.expectedProjectRef
          ? { expectedProjectRef: input.expectedProjectRef }
          : {}),
      }),
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
  if (
    input.expectedProjectRef &&
    body.projectRef !== input.expectedProjectRef
  ) {
    throw new Error(
      `Research target mismatch: trigger project=${body.projectRef ?? "unknown"} database project=${input.expectedProjectRef}.`,
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
      where id in ${sql(runIds)}
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
      where run_id in ${sql(runIds)}
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
 * Stop accepting output from timed-out lab sessions. The model runtime
 * may still finish later, so the save gate also checks that its run row
 * is still running before it writes. Marking the row failed is therefore
 * the durable cancellation signal, not merely display bookkeeping.
 */
export async function cancelResearchRuns(
  runIds: string[],
  reason: string,
): Promise<number> {
  if (runIds.length === 0) return 0;
  const sql = await database();
  const rows = await sql<Array<{ id: string }>>`
    update public.homa_task_runs
    set status = 'failed',
        error = ${reason},
        finished_at = now()
    where id in ${sql(runIds)}
      and status = 'running'
    returning id
  `;
  return rows.length;
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
  if (runIds.length === 0) return { flagged: 0, restored: 0 };
  const sql = await database();
  return await sql.begin(async (transaction) => {
    let flaggedCount = 0;
    let restoredCount = 0;

    // Newest first is load-bearing. If round B superseded round A,
    // reverting B restores A; the next iteration must then flag A too.
    // Oldest-first would leave A active after a supposedly clean lab.
    for (const runId of [...runIds].reverse()) {
      // A model is instructed to save once, but a corrected retry may
      // create a same-run supersession chain. Keep walking until this run
      // owns no active row; one pass would restore and strand its own
      // predecessor.
      for (;;) {
        const flagged = await transaction<Array<{ id: string }>>`
          update public.knowledge_bank
          set status = 'flagged',
              flagged_reason = ${reason},
              updated_at = now()
          where run_id = ${runId}
            and status = 'active'
          returning id
        `;
        if (flagged.length === 0) break;
        flaggedCount += flagged.length;
        for (const row of flagged) {
          const restored = await transaction<Array<{ id: string }>>`
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
    }
    return { flagged: flaggedCount, restored: restoredCount };
  });
}

export async function closeResearchDatabase(): Promise<void> {
  if (!databasePromise) return;
  const sql = await databasePromise;
  await sql.end({ timeout: 5 });
  databasePromise = null;
}
