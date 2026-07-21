import { defineSchedule } from "eve/schedules";

import { sweepMemoryCompaction } from "../../lib/learning/compact-memories";

/**
 * Nightly memory compaction (founder ruling 2026-07-20,
 * memory-render-time-budget). Finds every family whose saved memories
 * crossed the high-water mark and merges the entries that say the same
 * thing, so what rides in each turn's prompt stays worth carrying.
 *
 * No agent session and no channel: this is a direct model pass with
 * guarded writes (lib/learning/compact-memories.ts), the same shape as the
 * post-call extraction loop. Nothing here is parent-facing, so there is
 * nothing to deliver and no one waiting.
 *
 * 05:23 UTC (12:23am ET / 9:23pm PT) sits in the quiet window and well
 * clear of fleet research at 06:47, so the two never contend.
 *
 * Flag-dark by default. Turning it on is a deliberate act after the pinned
 * split has been verified live, per the rollout discipline that ChildProgress
 * established: ship the code, watch READY, then enable.
 */
export default defineSchedule({
  cron: "23 5 * * *",
  run({ waitUntil }) {
    waitUntil(
      (async () => {
        if (process.env.HOMA_MEMORY_COMPACTION_ENABLED !== "true") return;
        try {
          const outcomes = await sweepMemoryCompaction();
          const merged = outcomes.reduce((sum, outcome) => sum + outcome.applied.length, 0);
          const reclaimed = outcomes.reduce(
            (sum, outcome) => sum + (outcome.charsBefore - outcome.charsAfter),
            0,
          );
          if (outcomes.length > 0) {
            console.log(
              `memory compaction: ${outcomes.length} families, ${merged} merges, ${reclaimed} characters reclaimed`,
            );
          }
        } catch (error) {
          // A failed sweep is a quiet night, never a broken deploy: the
          // next run recomputes who is due from live rows.
          console.error(
            "memory compaction sweep failed:",
            error instanceof Error ? error.message : "unknown",
          );
        }
      })(),
    );
  },
});
