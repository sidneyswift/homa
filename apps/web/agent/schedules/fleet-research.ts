import { defineSchedule } from "eve/schedules";

import { fetchDemandQueue, type DemandTopic } from "../../lib/knowledge/demand";
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

const TOPIC_GUIDANCE: Record<DemandTopic["topicType"], string> = {
  method_philosophy:
    "This is a homeschool philosophy families follow. Research the current state: what its practitioners actually do at home today, current curriculum providers and communities, recent evidence, common mix-ups. TTL about 180 days.",
  method_format:
    "This is a homeschool format/setting (how school happens, not a philosophy). Research the current landscape, costs, and trade-offs families weigh. TTL about 180 days.",
  subject:
    "This is one of the map's subjects for young learners. Research what develops when (age-anchored), what the strongest current guidance says about teaching it at home, and anything new in the last year or two. TTL about 60 days.",
  study:
    "This is a rolling scan for notable NEW early-childhood or homeschooling research (roughly the last 12 months). Save only findings that would change what a parent does. TTL about 14 days.",
  other:
    "This is a curriculum or product families use. Research what it actually is, current editions/pricing, what reviews consistently say, and who it fits. TTL about 90 days.",
};

function topicMessage(topic: DemandTopic): string {
  return [
    `Tonight's research topic: ${topic.topicKey} (type: ${topic.topicType}).`,
    `${topic.demand} ${topic.demand === 1 ? "family currently needs" : "families currently need"} this topic${topic.hasRows ? ", and the bank's entry has gone stale" : ", and the bank has no entry yet"}.`,
    "",
    TOPIC_GUIDANCE[topic.topicType],
    "",
    "Follow the fleet-research rules in your instructions, then save exactly one gated row with save_knowledge using this topicType and topicKey.",
  ].join("\n");
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
          const runId = await beginFleetRun(`Research: ${topic.topicKey}`);
          try {
            await receive(researchChannel, {
              message: topicMessage(topic),
              target: { runId },
              auth: {
                authenticator: "fleet-research",
                principalId: `research:${runId}`,
                principalType: "user",
                attributes: { channel: "research", taskRunId: runId },
              },
            });
          } catch (error) {
            console.error(
              `fleet research failed for ${topic.topicKey}:`,
              error instanceof Error ? error.message : "unknown",
            );
            await finishTaskRun(runId, {
              familyId: null,
              kind: "fleet_research",
              status: "failed",
              error: error instanceof Error ? error.message.slice(0, 500) : "unknown",
            });
          }
        }
      })(),
    );
  },
});
