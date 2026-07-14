import { defineSchedule } from "eve/schedules";

import { fetchDemandQueue, type DemandCell } from "../../lib/knowledge/demand";
import type { KnowledgeLens } from "../../lib/knowledge/gate";
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

/** Per-lens research guidance (the corpus plan's lens set). Each lens
 * asks a different question of the same skill line, which is what lets
 * one corpus serve the brief, chat context, and materials. */
const LENS_GUIDANCE: Record<KnowledgeLens, string> = {
  develops_when:
    "Reference lens: what a child in THIS stage typically does in this skill line, age-anchored, from primary developmental sources (CDC, AAP, NAEYC, Head Start ELOF, the method's own scope and sequence). This is the stable 'what to expect' picture, not the latest news.",
  how_to_teach:
    "Practice lens: the current best guidance for TEACHING this skill line at THIS stage at home. What the strong evidence says works, what changed recently, and the common mistakes. Write it so a parent could act on it.",
  current_study:
    "Rolling scan: notable NEW early-childhood or homeschooling research (roughly the last 12 months) relevant to THIS stage. Save only a finding that would change what a parent does.",
  method:
    "This is a homeschool philosophy or format families follow. Research what its practitioners actually do at home today, current providers and communities, recent evidence, and common mix-ups.",
  curriculum:
    "This is a curriculum or product families use. Research what it actually is, current editions and pricing, what reviews consistently say, and who it fits.",
  red_flags:
    "Research-only, NEVER sent to a parent by text. When a pattern in this skill line at this stage genuinely merits a professional look, and how a parent would raise it gently. Handle with the most care; cite strong sources only.",
};

const STAGE_LABEL: Record<string, string> = {
  early_years: "about ages 2 to 5",
  early_elem: "about ages 5 to 8",
  upper_elem: "about ages 8 to 11",
  middle: "about ages 11 to 14",
  high: "about ages 14 to 17",
};

function topicMessage(cell: DemandCell): string {
  const stageLine =
    cell.stage !== null
      ? `Stage: ${cell.stage} (${STAGE_LABEL[cell.stage] ?? "one developmental band"}).`
      : "Stage: not stage-specific.";
  return [
    `Tonight's research cell: ${cell.topicKey} · lens ${cell.lens}${cell.stage ? ` · stage ${cell.stage}` : ""}.`,
    stageLine,
    `${cell.demand} ${cell.demand === 1 ? "family currently needs" : "families currently need"} this cell${cell.hasRows ? ", and the bank's entry has gone stale" : ", and the bank has no entry yet"}.`,
    "",
    LENS_GUIDANCE[cell.lens],
    "",
    `Follow the fleet-research rules in your instructions, then save exactly one gated row with save_knowledge using topicType "${cell.topicType}", topicKey "${cell.topicKey}", lens "${cell.lens}"${cell.stage ? `, and stage "${cell.stage}"` : ""}.`,
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
          const runId = await beginFleetRun(
            `Research: ${topic.topicKey}${topic.stage ? ` (${topic.stage})` : ""}`,
          );
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
