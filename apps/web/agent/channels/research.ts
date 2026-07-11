import { defineChannel, GET } from "eve/channels";

import { mapDb } from "../../lib/map/db";
import { finishTaskRun, updateFleetRunSummary } from "../../lib/tasks/store";

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
      // One session per run: research sessions never continue each other.
      continuationToken: `research:${target.runId ?? "adhoc"}`,
      state: { runId: target.runId ?? null, finished: false },
      title: `fleet research ${target.runId ?? ""}`.trim(),
    });
  },

  events: {
    async "message.completed"(eventData, channel) {
      const data = eventData as { finishReason?: string };
      if (data.finishReason !== "stop") return;
      const { runId, finished } = channel.state;
      if (!runId || finished) return;
      channel.state.finished = true;

      try {
        const sql = mapDb();
        const saved = await sql<{ active: string; flagged: string }[]>`
          select
            count(*) filter (where status = 'active')::text as active,
            count(*) filter (where status = 'flagged')::text as flagged
          from public.knowledge_bank where run_id = ${runId}
        `;
        const active = Number(saved[0]?.active ?? 0);
        const flagged = Number(saved[0]?.flagged ?? 0);
        await updateFleetRunSummary(
          runId,
          `${active} row${active === 1 ? "" : "s"} merged${flagged > 0 ? `, ${flagged} flagged by the gate` : ""}.`,
        );
        await finishTaskRun(runId, {
          familyId: null,
          kind: "fleet_research",
          status: active > 0 ? "done" : "failed",
          ...(active > 0 ? {} : { error: "no active row merged" }),
        });
      } catch (error) {
        console.error(
          "research run finish failed:",
          error instanceof Error ? error.message : "unknown",
        );
      }
    },
  },

  routes: [GET("/eve/v1/research/health", async () => Response.json({ ok: true }))],
});
