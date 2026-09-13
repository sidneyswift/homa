/** Protocol evidence for the parked-question upgrade regression. */
export const UPGRADE_QUESTION = "Which upgrade probe value should I repeat?";

export function usesSessionHandles(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-[\w.-]+)?$/.exec(version);
  if (!match) throw new Error("The upgrade check requires exact Eve versions.");
  // Eve 0.31.0 removed continuation tokens from the public HTTP protocol.
  return Number(match[1]) > 0 || Number(match[2]) >= 31;
}

/** Acceptance is only admission; the later stream proof must still complete. */
export function acceptedUpgradeSession({ version, response, body, expectedSessionId }) {
  const handles = usesSessionHandles(version);
  if (response.status !== 202 || !body || typeof body !== "object" || Array.isArray(body) || body.ok === false) {
    throw new Error("Upgrade request was not accepted by the session protocol.");
  }
  const sessionId = body.sessionId;
  if (typeof sessionId !== "string" || sessionId.length === 0 || /[\s/?#]/.test(sessionId)) {
    throw new Error("Upgrade response has no valid session identity.");
  }
  const headerId = response.headers.get("x-eve-session-id");
  if ((headerId !== null && headerId !== sessionId) ||
    (expectedSessionId !== undefined && expectedSessionId !== sessionId)) {
    throw new Error("Upgrade response did not preserve the original session identity.");
  }
  if (handles) {
    if ("continuationToken" in body) throw new Error("Handle response unexpectedly contains a legacy continuation token.");
    return { sessionId };
  }
  if (body.ok !== true || typeof body.continuationToken !== "string" || !body.continuationToken.trim()) {
    throw new Error("Legacy upgrade response has no valid continuation token.");
  }
  return { sessionId, continuationToken: body.continuationToken };
}

export function upgradeAnswerBody({ version, continuationToken, requestId, probe }) {
  if (!usesSessionHandles(version) && (typeof continuationToken !== "string" || !continuationToken)) {
    throw new Error("The legacy session protocol requires a continuation token.");
  }
  return {
    ...(!usesSessionHandles(version) ? { continuationToken } : {}),
    inputResponses: [{ requestId, text: probe }],
  };
}

export async function readUpgradeStream(url, timeoutMs, fetchImpl = fetch) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const decoder = new TextDecoder();
  const events = [];
  let buffer = "";
  let reader;
  function append(line) {
    if (!line.trim()) return;
    const event = JSON.parse(line);
    if (!event || typeof event.type !== "string" || !event.data || typeof event.data !== "object") {
      throw new Error("Invalid event in the upgrade proof stream.");
    }
    events.push(event);
  }
  try {
    const response = await fetchImpl(url, { signal: controller.signal });
    if (!response.ok || !response.body) throw new Error(`Upgrade proof stream failed with HTTP ${response.status}.`);
    reader = response.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) append(line);
      if (done) { append(buffer); buffer = ""; break; }
    }
  } catch (error) {
    // A parked conversation leaves its stream open. Only our own observation
    // deadline is expected; malformed events and transport failures invalidate proof.
    if (!controller.signal.aborted || error?.name !== "AbortError") throw error;
    if (buffer.trim()) throw new Error("Upgrade proof ended in a partial event.");
  } finally {
    clearTimeout(timer);
    if (reader) {
      await reader.cancel().catch(() => {});
      reader.releaseLock();
    }
  }
  return events;
}

function requireHealthyStream(events) {
  if (events.some((event) => ["step.failed", "turn.failed", "session.failed"].includes(event.type))) {
    throw new Error("The session stream contains a failed step, turn, or session.");
  }
}

export function parkedUpgradeQuestion(events) {
  requireHealthyStream(events);
  const index = events.findLastIndex((event) => event.type === "input.requested");
  const event = events[index];
  const requests = event?.data?.requests;
  if (!Array.isArray(requests) || requests.length !== 1) {
    throw new Error("Expected one actual pending input request, not just an idle session.");
  }
  const question = requests[0];
  if (
    question.prompt !== UPGRADE_QUESTION || question.allowFreeform !== true ||
    question.action?.kind !== "tool-call" || question.action?.toolName !== "ask_question" ||
    typeof question.requestId !== "string" || question.requestId.length === 0 ||
    typeof question.action.callId !== "string" || question.action.callId.length === 0 ||
    typeof event.data.turnId !== "string" || event.data.turnId.length === 0
  ) {
    throw new Error("The pending request is not the expected freeform upgrade question.");
  }
  const later = events.slice(index + 1);
  if (
    later.some((item) => item.type === "turn.started" || item.type === "session.completed") ||
    !later.some((item) => item.type === "session.waiting" && item.data?.wait === "next-user-message")
  ) {
    throw new Error("The question was not observed parked before the upgrade.");
  }
  return { requestId: question.requestId };
}

export function assertUpgradeReply({ baseline, resumed, probe }) {
  requireHealthyStream(resumed);
  const oldTurns = new Set(baseline.map((event) => event.data?.turnId).filter(Boolean));
  const start = resumed.findIndex((event) =>
    event.type === "turn.started" && typeof event.data?.turnId === "string" &&
    event.data.turnId.length > 0 && !oldTurns.has(event.data.turnId));
  if (start === -1) throw new Error("No new turn was observed on the original session.");
  const turnId = resumed[start].data.turnId;
  const afterStart = resumed.slice(start + 1);
  if (afterStart.some((event) => event.type === "input.requested")) {
    throw new Error("The resumed session requested input again instead of finishing the probe.");
  }
  const reply = afterStart.findIndex((event) => event.type === "message.completed" &&
    event.data?.turnId === turnId && event.data?.message?.trim() === probe &&
    event.data?.finishReason === "stop");
  if (reply === -1) throw new Error("The resumed turn did not repeat the post-upgrade probe value.");
  if (!afterStart.slice(reply + 1).some((event) =>
    event.type === "turn.completed" && event.data?.turnId === turnId)) {
    throw new Error("The probe reply was not followed by successful turn completion.");
  }
}
