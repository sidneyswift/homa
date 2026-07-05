/**
 * A narrow, defensive seed of M1-14 (the harness escape-hatch contract) —
 * not the full contract (startTurn/parkForHuman/scheduleDispatch/
 * persistEvent). This exists solely to close the specific hole found in
 * the M0-01 spike (docs/homa-planning/eve-churn-log.md, 2026-07-04): eve's
 * resume endpoint can claim success (`ok: true`, even with the *correct*
 * sessionId) while the durable workflow underneath has actually diverged
 * and corrupted, silently dropping the message. A second, rarer variant
 * returns `ok: true` naming a *different* sessionId altogether — a fresh,
 * memoryless session standing in for the one that broke.
 *
 * Both variants share one property: the synchronous POST response alone
 * cannot be trusted. eve's own docs describe the POST as accepting the
 * follow-up, not confirming the turn ran — real confirmation only exists on
 * the session's event stream. So this module does not stop at checking the
 * response body; it watches the stream for real forward progress (a new
 * turn distinct from whatever the caller already knew about) before calling
 * a resume successful.
 *
 * Every caller that resumes an eve session (the chat UI's send, a schedule
 * dispatcher waking a parked session, anything else) MUST go through this
 * function rather than calling eve's HTTP endpoint directly, so a silently
 * dropped resume is a loud failure here instead of a silently corrupted
 * conversation three layers up.
 */

export interface ResumeSessionParams {
  /** Base URL of the eve deployment, e.g. "" for same-origin, or a full origin. */
  baseUrl: string;
  /** The session we are trying to resume. */
  sessionId: string;
  /** The continuation token saved from session start or the last turn. */
  continuationToken: string;
  /** The follow-up message (a chat reply, or an inputResponses-style answer). */
  message: string;
  /**
   * The turnId of the last turn the caller already knows about (from the
   * `input.requested`/`session.waiting` event that parked this session).
   * Used to distinguish real forward progress from a replay of old history.
   */
  lastKnownTurnId: string;
  /** How long to wait for stream confirmation before giving up. Default 20s. */
  confirmTimeoutMs?: number;
  /** Injectable for tests; defaults to the global fetch. */
  fetchImpl?: typeof fetch;
}

export interface ResumeSessionResult {
  sessionId: string;
}

/**
 * Thrown when eve's resume response names a session other than the one we
 * asked for. Treat this as the original conversation being unrecoverable —
 * do not continue silently on the returned session as if it were a normal
 * resume. Log it, alert, and surface an honest "let's pick this back up"
 * message to the end user instead.
 */
export class SessionResumeMismatchError extends Error {
  readonly expectedSessionId: string;
  readonly actualSessionId: string;

  constructor(expectedSessionId: string, actualSessionId: string) {
    super(
      `Resume returned a different session than requested (expected ` +
        `${expectedSessionId}, got ${actualSessionId}). The original ` +
        `session cannot be trusted; treat it as lost, not resumed.`,
    );
    this.name = "SessionResumeMismatchError";
    this.expectedSessionId = expectedSessionId;
    this.actualSessionId = actualSessionId;
  }
}

/** Thrown when eve rejects the resume request outright (HTTP error or `ok: false`). */
export class SessionResumeFailedError extends Error {
  readonly sessionId: string;

  constructor(sessionId: string, detail: string) {
    super(`Resume request for session ${sessionId} failed: ${detail}`);
    this.name = "SessionResumeFailedError";
    this.sessionId = sessionId;
  }
}

/**
 * Thrown when the resume POST claimed success but the session's own event
 * stream shows no real forward progress within the timeout — no new turn,
 * and no explicit failure event either. This is the variant that motivated
 * this module: `ok: true` on the wire, silence underneath.
 */
export class SessionResumeUnconfirmedError extends Error {
  readonly sessionId: string;

  constructor(sessionId: string, timeoutMs: number) {
    super(
      `Resume for session ${sessionId} returned ok:true, but no new turn ` +
        `appeared on its event stream within ${timeoutMs}ms. Treat this as ` +
        `a failed resume, not a successful one — eve's POST response alone ` +
        `does not confirm the turn ran.`,
    );
    this.name = "SessionResumeUnconfirmedError";
    this.sessionId = sessionId;
  }
}

interface StreamEvent {
  type?: string;
  data?: { turnId?: string; [key: string]: unknown };
}

async function watchForForwardProgress(
  fetchFn: typeof fetch,
  streamUrl: string,
  lastKnownTurnId: string,
  timeoutMs: number,
): Promise<"progressed" | "failed" | "timed-out"> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchFn(streamUrl, { signal: controller.signal });
    if (!res.body) return "timed-out";
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        let event: StreamEvent;
        try {
          event = JSON.parse(line);
        } catch {
          continue;
        }
        if (event.type === "turn.failed" || event.type === "session.failed") {
          return "failed";
        }
        if (
          event.type === "turn.completed" &&
          event.data?.turnId !== undefined &&
          event.data.turnId !== lastKnownTurnId
        ) {
          return "progressed";
        }
      }
    }
    return "timed-out";
  } catch {
    return "timed-out";
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Resumes an eve session and verifies eve actually resumed *that* session
 * AND made real forward progress on it — not a substitute session, and not
 * a silently dropped message behind a synchronous `ok: true`. Throws one of
 * SessionResumeMismatchError, SessionResumeFailedError, or
 * SessionResumeUnconfirmedError rather than returning a result that looks
 * successful but silently isn't.
 */
export async function resumeSession(
  params: ResumeSessionParams,
): Promise<ResumeSessionResult> {
  const fetchFn = params.fetchImpl ?? fetch;
  const response = await fetchFn(
    `${params.baseUrl}/eve/v1/session/${params.sessionId}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        continuationToken: params.continuationToken,
        message: params.message,
      }),
    },
  );

  if (!response.ok) {
    throw new SessionResumeFailedError(params.sessionId, `HTTP ${response.status}`);
  }

  const body = (await response.json()) as { ok?: boolean; sessionId?: string };
  if (body.ok !== true || typeof body.sessionId !== "string") {
    throw new SessionResumeFailedError(params.sessionId, JSON.stringify(body));
  }

  if (body.sessionId !== params.sessionId) {
    throw new SessionResumeMismatchError(params.sessionId, body.sessionId);
  }

  const timeoutMs = params.confirmTimeoutMs ?? 20_000;
  const outcome = await watchForForwardProgress(
    fetchFn,
    `${params.baseUrl}/eve/v1/session/${params.sessionId}/stream`,
    params.lastKnownTurnId,
    timeoutMs,
  );

  if (outcome === "failed") {
    throw new SessionResumeFailedError(params.sessionId, "turn.failed or session.failed observed on resume");
  }
  if (outcome === "timed-out") {
    throw new SessionResumeUnconfirmedError(params.sessionId, timeoutMs);
  }

  return { sessionId: body.sessionId };
}
