import { z } from "zod";

import { resolveInternalEveOrigin } from "../internal-eve-route";

const startResponseSchema = z
  .object({
    ok: z.literal(true),
    sessionId: z.string().min(1),
  })
  .strict();

export async function startProgressNextMoveSession(
  input: {
    familyId: string;
    childId: string;
    contextFingerprint: string;
  },
  dependencies: {
    internalOrigin?: string;
    nodeEnv?: string;
    secret?: string;
    fetch?: typeof fetch;
  } = {},
): Promise<boolean> {
  const internalOrigin = resolveInternalEveOrigin({
    value:
      "internalOrigin" in dependencies
        ? dependencies.internalOrigin
        : process.env.HOMA_INTERNAL_ORIGIN,
    nodeEnv:
      "nodeEnv" in dependencies ? dependencies.nodeEnv : process.env.NODE_ENV,
  });
  const secret = dependencies.secret ?? process.env.CRON_SECRET;
  if (!internalOrigin || !secret) return false;

  try {
    const response = await (dependencies.fetch ?? fetch)(
      new URL("/eve/v1/progress-next-move/start", internalOrigin),
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${secret}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(input),
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
      },
    );
    const body: unknown = await response.json().catch(() => null);
    return response.ok && startResponseSchema.safeParse(body).success;
  } catch {
    return false;
  }
}
