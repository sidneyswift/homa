import { defineChannel, POST } from "eve/channels";
import { z } from "zod";

import {
  buildProgressNextMoveAuth,
  buildProgressNextMoveMessage,
} from "../../lib/child-progress/next-move-dispatch";
import { loadProgressNextMoveSnapshot } from "../../lib/child-progress/next-move-snapshot";
import {
  failProgressNextMove,
  loadStoredProgressNextMove,
  setProgressNextMoveRuntimeSession,
} from "../../lib/child-progress/next-move-store";
import { internalEveRouteAuthorizationFailure } from "../../lib/internal-eve-route";

interface ProgressNextMoveChannelState {
  familyId: string | null;
  childId: string | null;
  contextFingerprint: string | null;
}

const startSchema = z
  .object({
    familyId: z.string().uuid(),
    childId: z.string().uuid(),
    contextFingerprint: z.string().regex(/^[a-f0-9]{64}$/u),
  })
  .strict();

async function failPending(state: ProgressNextMoveChannelState): Promise<void> {
  if (!state.familyId || !state.childId || !state.contextFingerprint) return;
  const snapshot = await loadProgressNextMoveSnapshot({
    familyId: state.familyId,
    childId: state.childId,
  });
  if (!snapshot || snapshot.contextFingerprint !== state.contextFingerprint) {
    return;
  }
  await failProgressNextMove({
    familyId: snapshot.familyId,
    childId: snapshot.childId,
    contextFingerprint: snapshot.contextFingerprint,
    sourceRevision: snapshot.sourceRevision,
  });
}

export default defineChannel({
  state: {
    familyId: null,
    childId: null,
    contextFingerprint: null,
  } as ProgressNextMoveChannelState,

  context(state) {
    return { state };
  },

  metadata() {
    return { adapterName: "progress-next-move" };
  },

  events: {
    async "message.completed"(eventData, channel) {
      const data = eventData as { finishReason?: string };
      if (data.finishReason === "tool-calls") return;
      await failPending(channel.state);
    },
    async "turn.failed"(_eventData, channel) {
      await failPending(channel.state);
    },
    async "session.failed"(_eventData, channel) {
      await failPending(channel.state);
    },
  },

  routes: [
    POST<ProgressNextMoveChannelState>(
      "/eve/v1/progress-next-move/start",
      async (request, { send }) => {
        const authorizationFailure =
          internalEveRouteAuthorizationFailure(request);
        if (authorizationFailure) return authorizationFailure;

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ ok: false }, { status: 400 });
        }
        const parsed = startSchema.safeParse(body);
        if (!parsed.success) {
          return Response.json({ ok: false }, { status: 400 });
        }
        const snapshot = await loadProgressNextMoveSnapshot(parsed.data);
        const stored = await loadStoredProgressNextMove(parsed.data);
        if (
          !snapshot ||
          snapshot.contextFingerprint !== parsed.data.contextFingerprint ||
          !stored ||
          stored.status !== "pending"
        ) {
          return Response.json(
            { ok: false, reason: "stale-or-settled" },
            { status: 409 },
          );
        }

        try {
          const session = await send(buildProgressNextMoveMessage(snapshot), {
            auth: buildProgressNextMoveAuth(snapshot),
            continuationToken: `progress-next-move:${snapshot.contextFingerprint}`,
            mode: "task",
            state: {
              familyId: snapshot.familyId,
              childId: snapshot.childId,
              contextFingerprint: snapshot.contextFingerprint,
            },
            title: `One next move for ${snapshot.view.childName}`,
          });
          await setProgressNextMoveRuntimeSession({
            familyId: snapshot.familyId,
            childId: snapshot.childId,
            contextFingerprint: snapshot.contextFingerprint,
            sessionId: session.id,
          });
          return Response.json({ ok: true, sessionId: session.id });
        } catch {
          console.error("Progress next move internal task did not start");
          await failPending({
            familyId: snapshot.familyId,
            childId: snapshot.childId,
            contextFingerprint: snapshot.contextFingerprint,
          });
          return Response.json({ ok: false }, { status: 502 });
        }
      },
    ),
  ],
});
