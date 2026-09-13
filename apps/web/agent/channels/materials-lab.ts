import { sendEveChannelMessage } from "../../lib/conversation-continuity/eve-channel-send";
import { defineChannel, GET, POST } from "eve/channels";

import {
  buildStudioBrief,
  STUDIO_RUN_UUID_PATTERN,
  studioRequestProblem,
} from "../../lib/materials/studio-brief";
import {
  completeStudioRunIfStarted,
  createStudioRun,
  failStudioRunIfStarted,
  loadSandboxFamilyForStudio,
  loadStudioChild,
  setStudioRunSession,
} from "../../lib/materials/studio-runs";

/**
 * The founder console's material studio channel (/admin/studio, direction
 * lab 2026-07-18-material-studio-admin-directions.html). It wakes one
 * session as a SANDBOX family to run the materials-studio skill against a
 * founder-written request, exactly the machinery a real family's request
 * exercises: same skill, same tools, same quality check, same materials
 * row. Nothing is ever delivered to anyone from this channel; the founder
 * reads the run, its trace, and its materials in the console.
 *
 * The run route follows the dispatch channel's run-now shape: eve's
 * send() only exists inside the runtime, so the founder-gated server
 * action arrives over HTTP with CRON_SECRET (the deployment's own
 * internal-trigger secret). The route re-verifies the target is a
 * sandbox family server-side, so a customer's family can never become a
 * test target through this door even by a bad request.
 *
 * Terminal events mirror the agent-job channel: a session that ends
 * without finishing flips the run to failed, so nothing vanishes.
 */

interface MaterialsLabState {
  familyId: string | null;
  runId: string | null;
}

async function failIfStarted(state: MaterialsLabState, reason: string): Promise<void> {
  if (!state.familyId || !state.runId) return;
  await failStudioRunIfStarted(state.familyId, state.runId, reason);
}

export default defineChannel({
  state: { familyId: null, runId: null } as MaterialsLabState,

  context(state) {
    return { state };
  },

  metadata(state) {
    return { adapterName: "materials-lab", runId: state.runId };
  },

  async receive(input, channelOps) {
    const target = (input.target ?? {}) as Partial<MaterialsLabState>;
    return await sendEveChannelMessage(channelOps, input.message, {
      auth: input.auth ?? null,
      continuationToken: `materials-lab:${target.runId ?? ""}`,
      state: {
        familyId: target.familyId ?? null,
        runId: target.runId ?? null,
      } satisfies MaterialsLabState,
      title: `materials-lab ${target.runId ?? ""}`.trim(),
    });
  },

  events: {
    async "turn.completed"(_eventData, channel) {
      const { familyId, runId } = channel.state;
      if (!familyId || !runId) return;
      await completeStudioRunIfStarted(familyId, runId);
    },
    async "turn.failed"(_eventData, channel) {
      await failIfStarted(channel.state, "the test session's turn failed");
    },
    async "session.failed"(_eventData, channel) {
      await failIfStarted(channel.state, "the test session failed to run");
    },
  },

  routes: [
    // A channel with zero routes has no route fingerprint and cannot be
    // dispatched to (same note as the dispatch channel's health route).
    GET("/eve/v1/materials-lab/health", async () => Response.json({ ok: true })),

    // The studio page's Run button (launchStudioRunAction) arriving over
    // HTTP. CRON_SECRET is the gate; the founder gate already ran in the
    // server action, and the sandbox re-check below is the belt.
    POST<MaterialsLabState>("/eve/v1/materials-lab/run", async (req, channelOps) => {
      const secret = process.env.CRON_SECRET;
      if (!secret) {
        return Response.json(
          { ok: false, note: "The studio can't start runs on this deployment (no internal secret)." },
          { status: 503 },
        );
      }
      if (req.headers.get("authorization") !== `Bearer ${secret}`) {
        return Response.json({ ok: false }, { status: 401 });
      }

      let body: {
        familyId?: unknown;
        childId?: unknown;
        request?: unknown;
        startedBy?: unknown;
      };
      try {
        body = (await req.json()) as typeof body;
      } catch {
        return Response.json({ ok: false }, { status: 400 });
      }
      const familyId = typeof body.familyId === "string" ? body.familyId : "";
      const childId = typeof body.childId === "string" ? body.childId : null;
      const request = typeof body.request === "string" ? body.request.trim() : "";
      const startedBy = typeof body.startedBy === "string" ? body.startedBy.slice(0, 200) : "";
      if (
        !STUDIO_RUN_UUID_PATTERN.test(familyId) ||
        (childId !== null && !STUDIO_RUN_UUID_PATTERN.test(childId)) ||
        startedBy.length < 3
      ) {
        return Response.json({ ok: false }, { status: 400 });
      }
      const requestProblem = studioRequestProblem(request);
      if (requestProblem) {
        return Response.json({ ok: false, note: requestProblem }, { status: 400 });
      }

      const family = await loadSandboxFamilyForStudio(familyId);
      if (!family) {
        return Response.json(
          { ok: false, note: "Test runs only target a sandbox family. Mark one on its family page first." },
          { status: 409 },
        );
      }
      let childName: string | null = null;
      if (childId) {
        const child = await loadStudioChild(family.id, childId);
        if (!child) {
          return Response.json(
            { ok: false, note: "That child isn't in the picked family. Reload and try again." },
            { status: 409 },
          );
        }
        childName = child.name;
      }

      const run = await createStudioRun({
        familyId: family.id,
        childId,
        request,
        startedBy,
      });
      try {
        const session = await sendEveChannelMessage(channelOps, buildStudioBrief({ request, childName }), {
          auth: {
            authenticator: "materials-lab",
            principalId: `materials-lab:${family.id}`,
            principalType: "user" as const,
            attributes: {
              channel: "materials-lab",
              familyId: family.id,
              studioRunId: run.id,
            },
          },
          continuationToken: `materials-lab:${run.id}`,
          state: { familyId: family.id, runId: run.id } satisfies MaterialsLabState,
          title: `materials-lab ${run.id}`,
        });
        await setStudioRunSession(family.id, run.id, session.id);
        return Response.json({ ok: true, runId: run.id, sessionId: session.id });
      } catch (error) {
        await failStudioRunIfStarted(
          family.id,
          run.id,
          "the test session could not be started",
        );
        console.error(
          "materials-lab run start failed:",
          error instanceof Error ? error.message : "unknown",
        );
        return Response.json(
          { ok: false, note: "The studio couldn't start this run. Try again in a bit." },
          { status: 503 },
        );
      }
    }),
  ],
});
