import { defineDynamic, defineTool } from "eve/tools";
import { z } from "zod";

import { MissingFamilyContextError, resolveAgentAccess } from "../../lib/agent-db";
import { agentJobsEnabled } from "../../lib/jobs/flag";
import { refuseJobSpawnedSession } from "../../lib/jobs/guard";
import { kickAgentJobsRunner } from "../../lib/jobs/kick";
import { startJob } from "../../lib/jobs/store";
import { loadChecklistState } from "../../lib/onboarding/checklist-state";
import { writeOnboardingRecord } from "../../lib/onboarding/store";

/**
 * The artifact moment (founder ruling 2026-07-23, drop-off loop item 1;
 * chat-first onboarding plan §2.6, §4 A3/V-B): during her first days,
 * the parent says one true thing about her kid ("she's obsessed with
 * dinosaurs") and Homa starts making a real page from those words,
 * without holding the conversation open while it renders.
 *
 * The promise is backed before it is spoken. This tool durably enqueues
 * a single-stage materials-studio job; the row exists when the tool
 * returns, the claim-lease runner builds it (with retries) whether or
 * not she stays, and the finished page lands on this card and in the
 * Binder. If this tool did not confirm, nothing was scheduled and
 * nothing may be promised (acceptance and fulfillment must never
 * decouple; that failure is what the 2026-07-23 offer-recovery arc
 * exists for).
 *
 * Web onboarding only, structurally: the dynamic below returns null on
 * every other channel and for every finished family, so Homa cannot
 * spend a call finding out. The build itself runs as its own background
 * session loading materials-studio's craft; this tool only schedules.
 */

const NO_CARD_CHANNELS = new Set(["sms", "email", "dispatch", "agent-job", "subject_lesson"]);

const startFirstMaking = defineTool({
  description:
    "Start making one real printable page for a child in the background, from what the parent just told you about them. Use it once per sitting, at a beat boundary, when her own words hand you a theme (what the child loves). The page builds on its own after your reply ends and lands in the conversation and the Binder when it is ready, usually within several minutes. Never promise the page before this tool confirms it started.",
  inputSchema: z.object({
    childId: z
      .uuid()
      .describe("The child the page is for, using an id from the family context block."),
    title: z
      .string()
      .trim()
      .min(3)
      .max(90)
      .describe(
        "Short name for the making, reusing the parent's own words where they fit, e.g. 'Mia's dinosaur coloring page'.",
      ),
    request: z
      .string()
      .trim()
      .min(10)
      .max(600)
      .describe(
        "What to make, written for the build session: the material, the child it is for with their age, and what the parent said that shaped it.",
      ),
    herWords: z
      .string()
      .trim()
      .min(1)
      .max(300)
      .optional()
      .describe(
        "The parent's exact words that sparked this, verbatim from her message, e.g. \"she's obsessed with dinosaurs\". The build reuses her phrasing.",
      ),
    theme: z
      .string()
      .trim()
      .min(1)
      .max(120)
      .optional()
      .describe("The personalization hook, e.g. 'dinosaurs'."),
    kind: z
      .string()
      .trim()
      .min(1)
      .max(60)
      .optional()
      .describe(
        "What kind of page fits, e.g. 'coloring' for young kids, 'worksheet' when practice fits better. The build may refine this.",
      ),
  }),
  async execute(input, ctx) {
    const attributes = ctx.session.auth.current?.attributes;
    if (!agentJobsEnabled()) {
      return {
        started: false,
        note: "Background makings are not enabled on this deployment. Do not promise the page; keep the conversation going without it.",
      };
    }
    const refusal = refuseJobSpawnedSession(attributes);
    if (refusal) return { started: false, note: refusal };

    let access;
    try {
      access = await resolveAgentAccess(attributes);
    } catch (error) {
      if (error instanceof MissingFamilyContextError) {
        return { started: false, note: error.message };
      }
      throw error;
    }

    const state = await loadChecklistState(access.familyId, input.childId);
    if (!state) {
      return {
        started: false,
        note: "That child id is not in this family. Use an id from the family context block.",
      };
    }

    const memberUserId = (attributes as { memberUserId?: unknown } | undefined)
      ?.memberUserId;
    const result = await startJob({
      familyId: access.familyId,
      requestedByUserId: typeof memberUserId === "string" ? memberUserId : null,
      sessionId: ctx.session.id,
      skill: "materials-studio",
      title: input.title,
      plan: {
        request: input.request,
        ...(input.herWords ? { herWords: input.herWords } : {}),
        ...(input.theme ? { theme: input.theme } : {}),
        ...(input.kind ? { kind: input.kind } : {}),
        childName: state.childName,
      },
      totalStages: 1,
      childId: state.childId,
      // The FIRST making is once per child, ever: a verbatim retry and a
      // second sitting's second try both come back to the same job.
      startIdempotencyKey: `first-making:${state.childId}`,
    });
    if (!result.ok) {
      return {
        started: false,
        note: `${result.note} Nothing is being made, so do not promise the page.`,
      };
    }

    await writeOnboardingRecord(access.familyId, {
      addBeats: ["first_making"],
    });

    // Start the build now rather than at the next sweeper tick (founder
    // directive 2026-07-23). Best-effort: the row above is the promise,
    // the kick only makes it faster.
    if (!result.alreadyExisted) await kickAgentJobsRunner();

    if (result.alreadyExisted) {
      return {
        started: true,
        alreadyStarted: true,
        jobId: result.jobId,
        childId: state.childId,
        childName: state.childName,
        title: input.title,
        note: "This making was already underway; the card shows the same one. Do not promise it again as if it were new; mention it at most once, plainly.",
      };
    }

    return {
      started: true,
      alreadyStarted: false,
      jobId: result.jobId,
      childId: state.childId,
      childName: state.childName,
      title: input.title,
      note: "SPEAK AFTER THIS ONE: the making card is on her screen and it needs one warm line in your voice, naming the child and what is being made. It builds after your reply ends and usually lands within several minutes, here and in her Binder; say roughly that, never a clock time. If you used her words for it, say so once, quietly. Then hand the thread back.",
    };
  },
});

export default defineDynamic({
  events: {
    "turn.started": (_event, ctx) => {
      const adapterName = ctx.channel.metadata?.adapterName;
      if (adapterName === "telnyx" || ctx.channel.kind === "channel:telnyx") {
        return null;
      }
      const attributes = ctx.session.auth.current?.attributes as
        | { channel?: string; onboardingActive?: string }
        | undefined;
      if (attributes?.channel !== undefined && NO_CARD_CHANNELS.has(attributes.channel)) {
        return null;
      }
      // Onboarding families only: the beat belongs to her first days, and
      // a finished family already has the full materials studio in
      // conversation. Absence costs nothing (eve dynamic-tool law).
      if (attributes?.onboardingActive !== "true") return null;
      if (!agentJobsEnabled()) return null;
      return startFirstMaking;
    },
  },
});
