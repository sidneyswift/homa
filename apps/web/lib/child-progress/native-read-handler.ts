import { childProgressViewSchema, type ChildProgressView } from "@homa/core";
import { z } from "zod";

const childIdSchema = z.uuid();

export interface NativeProgressReadDependencies {
  enabled: () => boolean;
  rateLimited: (request: Request) => boolean;
  authenticate: (
    request: Request,
  ) => Promise<{ familyId: string } | null>;
  loadView: (
    familyId: string,
    childId: string,
  ) => Promise<ChildProgressView | null>;
  logError: (message: string, error?: unknown) => void;
}

/**
 * Builds the native Progress HTTP boundary around injected, exact effects.
 * The production route owns bearer verification and rate limiting. This pure
 * layer owns ordering, family re-scoping, response semantics, and projection
 * validation so every branch can be executed without weakening production
 * authentication in a test.
 */
export function createNativeProgressReadHandler(
  dependencies: NativeProgressReadDependencies,
): (
  request: Request,
  context: { params: Promise<{ childId: string }> },
) => Promise<Response> {
  return async (request, context) => {
    if (dependencies.rateLimited(request)) {
      return Response.json(
        { ok: false, reason: "rate-limited" },
        { status: 429 },
      );
    }
    if (!dependencies.enabled()) {
      return Response.json({ ok: false, reason: "disabled" }, { status: 404 });
    }

    let access: { familyId: string } | null;
    try {
      access = await dependencies.authenticate(request);
    } catch (error) {
      dependencies.logError("progress read auth lookup failed", error);
      return Response.json(
        { ok: false, reason: "auth-lookup-failed" },
        { status: 502 },
      );
    }
    if (!access) {
      return Response.json({ ok: false, reason: "no-session" }, { status: 401 });
    }

    const childId = childIdSchema.safeParse((await context.params).childId);
    if (!childId.success) {
      return Response.json(
        { ok: false, reason: "invalid-child" },
        { status: 400 },
      );
    }

    try {
      const view = await dependencies.loadView(access.familyId, childId.data);
      if (view === null) {
        return Response.json(
          { ok: false, reason: "unknown-child" },
          { status: 404 },
        );
      }
      const parsed = childProgressViewSchema.safeParse(view);
      if (!parsed.success || parsed.data.childId !== childId.data) {
        dependencies.logError("progress read produced an invalid child projection");
        return Response.json(
          { ok: false, reason: "invalid-projection" },
          { status: 502 },
        );
      }
      return Response.json(
        { ok: true, view: parsed.data },
        { headers: { "Cache-Control": "private, no-store" } },
      );
    } catch (error) {
      dependencies.logError("progress read failed", error);
      return Response.json(
        { ok: false, reason: "unavailable" },
        { status: 502 },
      );
    }
  };
}
