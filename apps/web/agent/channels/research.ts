import { defineChannel, GET, POST } from "eve/channels";

import { setTaskRunRuntimeSession } from "../../lib/conversation-continuity/delivery-ledger";
import { fetchDemandQueue } from "../../lib/knowledge/demand";
import { loadPriorResearch } from "../../lib/knowledge/research-dedup";
import {
  parseManualResearchRequest,
  researchCompletionOutcome,
  startResearchCell,
  supabaseProjectRef,
  type ResearchTrigger,
} from "../../lib/knowledge/research-run";
import { mapDb } from "../../lib/map/db";
import {
  beginFleetRun,
  finishTaskRun,
  updateFleetRunSummary,
} from "../../lib/tasks/store";

/**
 * The fleet research channel (HT-3): where the nightly corpus-building
 * sessions run. No family, no delivery, no inbound conversation: the
 * session's only lasting output is what it writes through the
 * save_knowledge tool's gate. Conversation persistence skips these
 * sessions automatically (no familyId on the auth attributes), and the
 * family-context instruction block stands down for channel "research".
 *
 * This channel FINISHES its run row: receive() resolves when the durable
 * session starts, so the schedule handler cannot judge the outcome; the
 * session's own message.completed is where the gate's results exist.
 *
 * The health route exists for the same reason as the dispatch channel's:
 * cross-channel receive() needs a route fingerprint when bundle
 * boundaries break reference identity.
 */

interface ResearchState {
  runId: string | null;
  finished: boolean;
}

function researchSendOptions(target: { runId?: string }) {
  return {
    // One session per run: research sessions never continue each other.
    continuationToken: `research:${target.runId ?? "adhoc"}`,
    state: { runId: target.runId ?? null, finished: false },
    title: `fleet research ${target.runId ?? ""}`.trim(),
  };
}

export default defineChannel({
  state: { runId: null, finished: false } as ResearchState,

  context(state) {
    return { state };
  },

  metadata() {
    return { adapterName: "research" };
  },

  async receive(input, { send }) {
    const target = (input.target ?? {}) as { runId?: string };
    return await send(input.message, {
      auth: input.auth ?? null,
      ...researchSendOptions(target),
    });
  },

  events: {
    async "message.completed"(eventData, channel) {
      const data = eventData as {
        finishReason?: string;
        message?: string | null;
      };
      if (data.finishReason !== "stop") return;
      const { runId, finished } = channel.state;
      if (!runId || finished) return;
      channel.state.finished = true;

      try {
        const sql = mapDb();
        const saved = await sql<
          Array<{
            active: string;
            flagged: string;
            run_status: string | null;
          }>
        >`
          select
            count(*) filter (where status = 'active')::text as active,
            count(*) filter (where status = 'flagged')::text as flagged,
            (select status from public.homa_task_runs where id = ${runId})
              as run_status
          from public.knowledge_bank where run_id = ${runId}
        `;
        // A timed-out lab marks the run failed before cleanup. The model
        // session may finish afterward; never overwrite that cancellation
        // receipt or turn the failed row back into done/skipped.
        if (saved[0]?.run_status !== "running") return;
        const active = Number(saved[0]?.active ?? 0);
        const flagged = Number(saved[0]?.flagged ?? 0);
        const outcome = researchCompletionOutcome({
          active,
          flagged,
          message: data.message,
        });
        await updateFleetRunSummary(runId, outcome.summary);
        await finishTaskRun(runId, {
          familyId: null,
          kind: "fleet_research",
          status: outcome.status,
          ...(outcome.error ? { error: outcome.error } : {}),
          onlyIfRunning: true,
        });
      } catch (error) {
        console.error(
          "research run finish failed:",
          error instanceof Error ? error.message : "unknown",
        );
      }
    },
  },

  routes: [
    GET("/eve/v1/research/health", async () => Response.json({ ok: true })),

    /**
     * Manual/condensed research trigger. The caller may ask for the next
     * N due cells (`{ count: 10 }`) or explicit cells for a focused lab
     * (`{ cells: [{ lens, topicKey, stage }] }`). CRON_SECRET keeps this
     * on the same internal trust boundary as task run-now and Vercel
     * cron. Every cell still enters through startResearchCell, so the
     * running-cell DB lock, prior-source dossier, gate, run ledger, and
     * reaper are identical to the nightly path.
     */
    POST<ResearchState>("/eve/v1/research/run", async (req, { send }) => {
      const secret = process.env.CRON_SECRET;
      if (!secret) {
        return Response.json(
          { ok: false, note: "The research trigger is not configured." },
          { status: 503 },
        );
      }
      if (req.headers.get("authorization") !== `Bearer ${secret}`) {
        return Response.json({ ok: false }, { status: 401 });
      }

      let request;
      let expectedProjectRef: string | null = null;
      try {
        const body = (await req.json()) as {
          expectedProjectRef?: unknown;
        };
        expectedProjectRef =
          typeof body.expectedProjectRef === "string"
            ? body.expectedProjectRef
            : null;
        request = parseManualResearchRequest(body);
      } catch (error) {
        return Response.json(
          {
            ok: false,
            note:
              error instanceof Error
                ? error.message.slice(0, 300)
                : "Invalid research request.",
          },
          { status: 400 },
        );
      }

      const projectRef = supabaseProjectRef(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
      );
      if (
        expectedProjectRef !== null &&
        expectedProjectRef !== projectRef
      ) {
        return Response.json(
          {
            ok: false,
            note: `Research target mismatch: expected ${expectedProjectRef}, runtime is ${projectRef ?? "unknown"}.`,
            projectRef,
          },
          { status: 409 },
        );
      }

      const trigger: ResearchTrigger =
        req.headers.get("x-homa-research-trigger") === "lab" ? "lab" : "manual";
      const cells =
        request.kind === "queue"
          ? await fetchDemandQueue(request.count)
          : request.cells;
      const started: Array<{
        runId: string;
        sessionId: string;
        cellKey: string;
      }> = [];
      const skipped: Array<{ cellKey: string; reason: string }> = [];
      const failed: Array<{ cellKey: string; error: string }> = [];

      for (const cell of cells) {
        try {
          const result = await startResearchCell(cell, trigger, {
            beginRun: beginFleetRun,
            loadPrior: loadPriorResearch,
            startSession: async (input) => {
              const target = input.target as { runId?: string };
              return await send(input.message, {
                auth: input.auth,
                ...researchSendOptions(target),
              });
            },
            markSession: setTaskRunRuntimeSession,
            failRun: async (runId, message) => {
              await finishTaskRun(runId, {
                familyId: null,
                kind: "fleet_research",
                status: "failed",
                error: message,
              });
            },
            onSessionRecordError: (error) => {
              console.error(
                `manual research session receipt failed for ${cell.topicKey}:`,
                error instanceof Error ? error.message : "unknown",
              );
            },
          });
          if (result.started) {
            started.push({
              runId: result.runId,
              sessionId: result.sessionId,
              cellKey: result.cellKey,
            });
          } else {
            skipped.push({
              cellKey: result.cellKey,
              reason: result.reason,
            });
          }
        } catch (error) {
          failed.push({
            cellKey: `${cell.lens}:${cell.stage ?? "all"}:${cell.topicKey}`,
            error:
              error instanceof Error
                ? error.message.slice(0, 300)
                : "session startup failed",
          });
        }
      }

      return Response.json({
        ok: failed.length === 0,
        trigger,
        projectRef,
        requested: cells.length,
        started,
        skipped,
        failed,
      });
    }),
  ],
});
