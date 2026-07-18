import { defineChannel, GET, POST } from "eve/channels";
import { z } from "zod";

import { ACTION_COSTS } from "@homa/core";

import { emitMapEvent } from "../../lib/map/events";
import {
  classifySubjectLessonMessageCompletion,
  failSubjectLessonAttempt,
  finishSubjectLessonAttempt,
  startSubjectLessonAttempt,
  type SubjectLessonChannelState,
  type SubjectLessonEventEmitter,
  type SubjectLessonFinishReason,
  type SubjectLessonStartResult,
} from "../../lib/subject-lessons/channel-run";
import {
  claimSubjectLessonSessionInput,
  finishSubjectLessonRun,
  recoverSubjectLessonMaterialPinned,
  setSubjectLessonRuntimeSession,
} from "../../lib/subject-lessons/store";

interface SubjectLessonAdapterState {
  familyId: string | null;
  lessonId: string | null;
  childId: string | null;
  subjectId: string | null;
  attempt: number | null;
  terminal: boolean;
}

export const subjectLessonStartRequestSchema = z
  .object({
    familyId: z.uuid(),
    lessonId: z.uuid(),
    retry: z.boolean().optional().default(false),
    modelUsageSurface: z.literal(
      ACTION_COSTS.subjectLessonWithWorksheet.modelUsageSurface,
    ),
  })
  .strict();

/**
 * Both routes share the deployment's internal trigger boundary. Missing
 * configuration fails closed instead of making the health route public.
 */
export function subjectLessonRouteAuthorizationFailure(
  request: Request,
  secret: string | undefined = process.env.CRON_SECRET,
): Response | null {
  if (!secret) {
    return Response.json({ ok: false }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ ok: false }, { status: 401 });
  }
  return null;
}

export function subjectLessonStartHttpResponse(
  result: SubjectLessonStartResult,
): Response {
  switch (result.status) {
    case "not_started":
      return Response.json({ ok: true, started: false });
    case "started":
      if (!result.sessionRecorded) {
        console.error(
          "subject lesson runtime session receipt was not recorded",
        );
      }
      return Response.json({
        ok: true,
        started: true,
        attempt: result.attempt,
        sessionId: result.sessionId,
      });
    case "failed":
      return Response.json(
        {
          ok: false,
          started: false,
          attempt: result.attempt,
          errorCode: result.errorCode,
        },
        { status: 502 },
      );
    default: {
      const exhaustive: never = result;
      throw new Error(
        `Unhandled subject lesson start result: ${String(exhaustive)}`,
      );
    }
  }
}

function runningSubjectLessonState(
  state: SubjectLessonAdapterState,
): SubjectLessonChannelState | null {
  if (
    !state.familyId
    || !state.lessonId
    || !state.childId
    || !state.subjectId
    || state.attempt === null
    || !Number.isInteger(state.attempt)
    || state.attempt < 1
  ) {
    return null;
  }
  return state as SubjectLessonChannelState;
}

const emitSubjectLessonEvent: SubjectLessonEventEmitter = async (event) => {
  switch (event.name) {
    case "map.subject_lesson_started":
      await emitMapEvent("map.subject_lesson_started", event.props);
      return;
    case "map.subject_lesson_ready":
      await emitMapEvent("map.subject_lesson_ready", event.props);
      return;
    case "map.subject_lesson_failed":
      await emitMapEvent("map.subject_lesson_failed", event.props);
      return;
    default: {
      const exhaustive: never = event;
      throw new Error(
        `Unhandled subject lesson event: ${String(exhaustive)}`,
      );
    }
  }
};

async function finalizeSubjectLessonFailure(
  adapterState: SubjectLessonAdapterState,
  errorCode: "message_content_filter"
    | "message_error"
    | "message_length"
    | "message_other"
    | "turn_failed"
    | "session_failed",
): Promise<void> {
  const state = runningSubjectLessonState(adapterState);
  if (!state) return;
  try {
    await failSubjectLessonAttempt(state, errorCode, {
      finishRun: finishSubjectLessonRun,
      emitEvent: emitSubjectLessonEvent,
    });
  } catch {
    console.error("subject lesson failure finalization failed");
  }
}

export default defineChannel({
  state: {
    familyId: null,
    lessonId: null,
    childId: null,
    subjectId: null,
    attempt: null,
    terminal: false,
  } as SubjectLessonAdapterState,

  context(state) {
    return { state };
  },

  metadata() {
    return { adapterName: "subject-lesson" };
  },

  events: {
    async "message.completed"(eventData, channel) {
      const data = eventData as { finishReason: SubjectLessonFinishReason };
      if (data.finishReason === "tool-calls") return;
      const completion = classifySubjectLessonMessageCompletion(
        data.finishReason,
      );
      switch (completion.kind) {
        case "ignore":
          return;
        case "fail":
          await finalizeSubjectLessonFailure(
            channel.state,
            completion.errorCode,
          );
          return;
        case "complete":
          break;
        default: {
          const exhaustive: never = completion;
          throw new Error(
            `Unhandled subject lesson completion: ${String(exhaustive)}`,
          );
        }
      }

      const state = runningSubjectLessonState(channel.state);
      if (!state) return;
      try {
        await finishSubjectLessonAttempt(state, {
          recoverMaterial: recoverSubjectLessonMaterialPinned,
          finishRun: finishSubjectLessonRun,
          emitEvent: emitSubjectLessonEvent,
        });
      } catch {
        console.error("subject lesson terminal processing failed");
      }
    },
    async "turn.failed"(_eventData, channel) {
      await finalizeSubjectLessonFailure(channel.state, "turn_failed");
    },
    async "session.failed"(_eventData, channel) {
      await finalizeSubjectLessonFailure(channel.state, "session_failed");
    },
  },

  routes: [
    GET("/eve/v1/subject-lesson/health", async (request) => {
      const authorizationFailure =
        subjectLessonRouteAuthorizationFailure(request);
      if (authorizationFailure) return authorizationFailure;
      return Response.json({ ok: true });
    }),

    POST<SubjectLessonAdapterState>(
      "/eve/v1/subject-lesson/start",
      async (request, { send }) => {
        const authorizationFailure =
          subjectLessonRouteAuthorizationFailure(request);
        if (authorizationFailure) return authorizationFailure;

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ ok: false }, { status: 400 });
        }
        const parsed = subjectLessonStartRequestSchema.safeParse(body);
        if (!parsed.success) {
          return Response.json({ ok: false }, { status: 400 });
        }

        try {
          const result = await startSubjectLessonAttempt(parsed.data, {
            claimSessionInput: claimSubjectLessonSessionInput,
            startSession: async (message, options) =>
              await send(message, options),
            setRuntimeSession: setSubjectLessonRuntimeSession,
            finishRun: finishSubjectLessonRun,
            emitEvent: emitSubjectLessonEvent,
          });
          return subjectLessonStartHttpResponse(result);
        } catch {
          console.error("subject lesson start failed");
          return Response.json(
            { ok: false, started: false, errorCode: "start_failed" },
            { status: 502 },
          );
        }
      },
    ),
  ],
});
