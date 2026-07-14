import { defineSchedule } from "eve/schedules";

import { setTaskRunRuntimeSession } from "../../lib/conversation-continuity/delivery-ledger";
import { fetchDemandQueue } from "../../lib/knowledge/demand";
import { loadPriorResearch } from "../../lib/knowledge/research-dedup";
import { startResearchCell } from "../../lib/knowledge/research-run";
import { beginFleetRun, finishTaskRun } from "../../lib/tasks/store";
import researchChannel from "../channels/research";

/**
 * The fleet research job (HT-3, D-ht-1's expensive half): one nightly
 * pass that researches the most-demanded stale or missing topics into
 * knowledge_bank, so every family's morning brief personalizes from a
 * corpus instead of paying for its own web research. Cost scales with
 * topics, never with families; child data never enters the queue or the
 * sessions (topic keys only).
 *
 * 06:47 UTC is the quiet middle of the US night (1:47am ET / 10:47pm
 * PT). One session per topic keeps each run small and lets a failure
 * lose one topic, not the night.
 */

const DEFAULT_TOPICS_PER_NIGHT = 3;

function topicsPerNight(): number {
  const raw = Number(process.env.RESEARCH_TOPICS_PER_NIGHT);
  return Number.isInteger(raw) && raw >= 1 && raw <= 10 ? raw : DEFAULT_TOPICS_PER_NIGHT;
}

export default defineSchedule({
  cron: "47 6 * * *",
  run({ receive, waitUntil }) {
    waitUntil(
      (async () => {
        if (process.env.FLEET_RESEARCH_ENABLED !== "true") return;
        const topics = await fetchDemandQueue(topicsPerNight());

        // receive() resolves when each durable session STARTS; the
        // research channel finishes each run row from its own
        // message.completed, and the dispatcher's reaper catches any
        // session that dies without one.
        for (const topic of topics) {
          try {
            await startResearchCell(topic, "scheduled", {
              beginRun: beginFleetRun,
              loadPrior: loadPriorResearch,
              startSession: async (input) => await receive(researchChannel, input),
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
                  `fleet research session receipt failed for ${topic.topicKey}:`,
                  error instanceof Error ? error.message : "unknown",
                );
              },
            });
          } catch (error) {
            console.error(
              `fleet research failed for ${topic.topicKey}:`,
              error instanceof Error ? error.message : "unknown",
            );
          }
        }
      })(),
    );
  },
});
