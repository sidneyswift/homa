import {
  mobileFamilyEventRequestSchema,
  type EventProps,
  type MobileFamilyEventName,
} from "@homa/core";

export interface MobileFamilyEventDependencies {
  rateLimited: (request: Request) => boolean;
  authenticate: (request: Request) => Promise<{ id: string } | null>;
  persist: (
    name: MobileFamilyEventName,
    props: EventProps<MobileFamilyEventName>,
    familyId: string,
  ) => Promise<void>;
  logError: (message: string, error?: unknown) => void;
}

/**
 * Builds the authenticated native telemetry boundary around injected exact
 * effects. The production route supplies bearer verification, rate limiting,
 * and database persistence; this layer owns strict parsing and family scope.
 */
export function createMobileFamilyEventHandler(
  dependencies: MobileFamilyEventDependencies,
): (request: Request) => Promise<Response> {
  return async (request) => {
    if (dependencies.rateLimited(request)) {
      return Response.json(
        { ok: false, reason: "rate-limited" },
        { status: 429 },
      );
    }

    let family: { id: string } | null;
    try {
      family = await dependencies.authenticate(request);
    } catch (error) {
      dependencies.logError("mobile event auth lookup failed", error);
      return Response.json(
        { ok: false, reason: "auth-lookup-failed" },
        { status: 502 },
      );
    }
    if (!family) {
      return Response.json(
        { ok: false, reason: "no-session" },
        { status: 401 },
      );
    }

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return Response.json(
        { ok: false, reason: "bad-json" },
        { status: 400 },
      );
    }

    const parsed = mobileFamilyEventRequestSchema.safeParse(raw);
    if (!parsed.success) {
      return Response.json(
        { ok: false, reason: "invalid" },
        { status: 400 },
      );
    }

    const scopedProps =
      parsed.data.name === "chat.turn_completed"
        ? parsed.data.props
        : { ...parsed.data.props, family_id: family.id };

    try {
      await dependencies.persist(
        parsed.data.name,
        scopedProps as EventProps<MobileFamilyEventName>,
        family.id,
      );
    } catch (error) {
      dependencies.logError("mobile event persistence failed", error);
      return Response.json(
        { ok: false, reason: "unavailable" },
        { status: 503 },
      );
    }

    return Response.json(
      { ok: true },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  };
}
