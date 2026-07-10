import { defineSchedule } from "eve/schedules";

import {
  claimDueJournalJobs,
  completeJournalJob,
  journalPromptEnabled,
  releaseJournalJob,
  seedJournalSchedules,
} from "../../lib/schedule-store";
import dispatchChannel from "../channels/dispatch";

/**
 * The dispatcher (gateway-plan GW-4): the one authored schedule. Every
 * hour it seeds and claims due per-family rows (agent_schedules) and
 * wakes THE agent as each family via the dispatch channel; the agent
 * composes tonight's journal prompt from that family's real context and
 * the channel delivers it (text first, email otherwise). Dark until
 * JOURNAL_PROMPT_ENABLED=true, the same founder gate as before.
 *
 * At-least-once: a crash between receive and complete redelivers, and
 * the per-local-day session token plus the completed row pointing at
 * tomorrow are the idempotency guards.
 */
export default defineSchedule({
  cron: "0 * * * *",
  run({ receive, waitUntil }) {
    waitUntil(
      (async () => {
        if (!journalPromptEnabled()) return;
        const now = new Date();
        await seedJournalSchedules(now);
        const jobs = await claimDueJournalJobs({
          now,
          limit: 50,
          leaseForMs: 10 * 60_000,
        });

        for (const job of jobs) {
          try {
            await receive(dispatchChannel, {
              message: [
                "It is this family's evening check-in moment (their local evening).",
                `Compose tonight's short journal prompt to ${job.parentFirstName ?? "the parent"}.`,
                "1 to 2 sentences in your own voice. When a saved memory or recent conversation gives you something real (a current interest, this week's focus, a recent win), reference it; otherwise keep it simple and ask about the day.",
                `The kids: ${job.kidPhrase}. End with one easy question she can answer in a sentence.`,
                "Your reply is delivered to her EXACTLY as written, as a text message or short email: write only the message itself, no preamble, no quotes, no sign-off.",
              ].join("\n"),
              target: {
                familyId: job.familyId,
                phoneE164: job.phoneE164,
                email: job.email,
              },
              auth: {
                authenticator: "dispatcher",
                principalId: `dispatch:${job.familyId}`,
                principalType: "user",
                attributes: { channel: "dispatch", familyId: job.familyId },
              },
            });
            await completeJournalJob(job, now);
          } catch (error) {
            console.error(
              `dispatch failed for family ${job.familyId}:`,
              error instanceof Error ? error.message : "unknown",
            );
            await releaseJournalJob(job);
          }
        }
      })(),
    );
  },
});
