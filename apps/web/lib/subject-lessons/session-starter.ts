import { z } from "zod";

import { resolveInternalEveOrigin } from "../internal-eve-route";

import type {
  StartSubjectLessonSessionInput,
  StartSubjectLessonSessionResult,
} from "./route-contracts";

const subjectLessonStartResponseSchema = z
  .object({
    ok: z.boolean(),
    started: z.boolean().optional(),
    attempt: z.number().int().positive().optional(),
  })
  .passthrough();

export function resolveSubjectLessonInternalOrigin(input: {
  value: string | undefined;
  nodeEnv: string | undefined;
}): string | null {
  return resolveInternalEveOrigin(input);
}

export async function startSubjectLessonSession(
  input: StartSubjectLessonSessionInput,
  dependencies: {
    internalOrigin?: string;
    nodeEnv?: string;
    secret?: string;
    fetch?: typeof fetch;
  } = {},
): Promise<StartSubjectLessonSessionResult> {
  const configuredOrigin = "internalOrigin" in dependencies
    ? dependencies.internalOrigin
    : process.env.HOMA_INTERNAL_ORIGIN;
  const nodeEnv = "nodeEnv" in dependencies
    ? dependencies.nodeEnv
    : process.env.NODE_ENV;
  const internalOrigin = resolveSubjectLessonInternalOrigin({
    value: configuredOrigin,
    nodeEnv,
  });
  if (!internalOrigin) {
    return {
      ok: false,
      note: "Subject lesson session did not start.",
    };
  }

  const secret = dependencies.secret ?? process.env.CRON_SECRET;
  if (!secret) {
    return {
      ok: false,
      note: "Subject lesson session secret is unavailable.",
    };
  }
  const fetchImpl = dependencies.fetch ?? fetch;
  let response: Response;
  try {
    response = await fetchImpl(
      new URL("/eve/v1/subject-lesson/start", internalOrigin),
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${secret}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          familyId: input.familyId,
          lessonId: input.lessonId,
          retry: input.retry,
          modelUsageSurface: input.modelUsageSurface,
        }),
        cache: "no-store",
      },
    );
  } catch {
    return {
      ok: false,
      note: "Subject lesson session request did not complete.",
    };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  const parsed = subjectLessonStartResponseSchema.safeParse(body);
  if (!response.ok || !parsed.success || !parsed.data.ok) {
    return {
      ok: false,
      note: "Subject lesson session did not start.",
      ...(parsed.success && parsed.data.started !== undefined
        ? { started: parsed.data.started }
        : {}),
      ...(parsed.success && parsed.data.attempt !== undefined
        ? { attempt: parsed.data.attempt }
        : {}),
    };
  }
  return {
    ok: true,
    started: parsed.data.started === true,
    attempt: parsed.data.attempt ?? null,
  };
}
