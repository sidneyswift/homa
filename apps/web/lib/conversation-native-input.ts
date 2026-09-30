/** Native Eve questions and approvals park a runtime. They are distinct from
 * ordinary question cards, whose replies become new conversation requests.
 * The stored batch is server evidence; browsers submit only its opaque ID and
 * exact responses. Validate before send because Eve consumes pending input
 * before the turn.started hook runs. */
export interface NativeInputRequest {
  requestId: string;
  action: { kind: "tool-call"; callId: string; toolName: string; input: Record<string, unknown> };
  prompt: string;
  allowFreeform?: boolean;
  display?: "confirmation" | "select" | "text";
  options?: { id: string; label: string; description?: string; style?: "danger" | "default" | "primary" }[];
}
export interface NativePendingInput {
  id: string; sessionId: string; sourceIndex: number;
  turnId: string; sequence: number; stepIndex: number;
  requests: NativeInputRequest[];
}
export interface NativeInputResponse { requestId: string; optionId?: string; text?: string }

export class NativeInputValidationError extends Error {
  constructor(readonly code: "invalid" | "stale" | "incomplete" | "choice") {
    super(`Native conversation input ${code}`);
  }
}
const fail = (code: NativeInputValidationError["code"] = "invalid"): never => { throw new NativeInputValidationError(code); };
const record = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value));
const text = (value: unknown, max = 64_000): value is string => typeof value === "string" && value.length > 0 && value.length <= max && !value.includes("\0");
const id = (value: unknown): value is string => text(value, 1024);
const integer = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0;
function closed(value: Record<string, unknown>, keys: string[]) {
  if (Object.keys(value).some(key => !keys.includes(key))) fail();
}
function json(value: unknown, depth = 0): boolean {
  if (depth > 64) return false;
  if (value === null || typeof value === "boolean" || typeof value === "string") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(item => json(item, depth + 1));
  return record(value) && Object.values(value).every(item => json(item, depth + 1));
}
function parseRequest(value: unknown): NativeInputRequest {
  if (!record(value)) return fail();
  closed(value, ["requestId", "action", "prompt", "allowFreeform", "display", "options"]);
  if (!id(value.requestId) || !text(value.prompt) || !record(value.action)) return fail();
  closed(value.action, ["kind", "callId", "toolName", "input"]);
  if (value.action.kind !== "tool-call" || !id(value.action.callId) || !id(value.action.toolName) ||
      !record(value.action.input) || !json(value.action.input)) return fail();
  if (value.allowFreeform !== undefined && typeof value.allowFreeform !== "boolean") return fail();
  if (value.display !== undefined && !["confirmation", "select", "text"].includes(String(value.display))) return fail();
  if (value.options !== undefined) {
    if (!Array.isArray(value.options) || value.options.length > 100) return fail();
    const seen = new Set<string>();
    for (const option of value.options) {
      if (!record(option)) return fail();
      closed(option, ["id", "label", "description", "style"]);
      if (!id(option.id) || !text(option.label) || seen.has(option.id) ||
          (option.description !== undefined && !text(option.description)) ||
          (option.style !== undefined && !["danger", "default", "primary"].includes(String(option.style)))) return fail();
      seen.add(option.id);
    }
  }
  // Clone runtime-owned values so later mutation cannot change accepted intent.
  return structuredClone(value) as unknown as NativeInputRequest;
}
export function parseNativePendingInput(event: unknown, serverBatchId: string, sessionId: string, sourceIndex: number): NativePendingInput | null {
  if (!record(event) || event.type !== "input.requested") return null;
  if (!id(serverBatchId) || !id(sessionId) || !integer(sourceIndex) || !record(event.data)) return fail();
  const data = event.data;
  // Proxy events do not pass the root admission hook. Their child router runs
  // before authored channel delivery, so they are not an answerable root batch.
  if(data.nativeInputSource==='proxy')return null;
  if(data.nativeInputSource!==undefined)return fail();
  if (!id(data.turnId) || !integer(data.sequence) || !integer(data.stepIndex) ||
      !Array.isArray(data.requests) || data.requests.length === 0 || data.requests.length > 100) return fail();
  const requests = data.requests.map(parseRequest);
  if (new Set(requests.map(item => item.requestId)).size !== requests.length ||
      new Set(requests.map(item => item.action.callId)).size !== requests.length) return fail();
  return { id: serverBatchId, sessionId, sourceIndex, turnId: data.turnId,
    sequence: data.sequence, stepIndex: data.stepIndex, requests };
}

/** The installed runtime recognizes approval by these ordered IDs, regardless
 * of display. Match that exact rule so approval cannot slip into freeform. */
export function isNativeApproval(request: NativeInputRequest): boolean {
  return request.options?.length === 2 && request.options[0]?.id === "approve" && request.options[1]?.id === "deny";
}
export function validateNativeInputResponses(batch: NativePendingInput, body: unknown): NativeInputResponse[] {
  if (!record(body)) return fail();
  closed(body, ["batchId", "responses"]);
  if (body.batchId !== batch.id) return fail("stale");
  if (!Array.isArray(body.responses) || body.responses.length !== batch.requests.length) return fail("incomplete");
  const byId = new Map<string, NativeInputResponse>();
  for (const value of body.responses) {
    if (!record(value)) return fail();
    closed(value, ["requestId", "optionId", "text"]);
    if (!id(value.requestId) || byId.has(value.requestId)) return fail();
    const request = batch.requests.find(item => item.requestId === value.requestId);
    if (!request) return fail("stale");
    const hasOption = value.optionId !== undefined;
    const hasText = value.text !== undefined;
    // Exactly one selection or freeform answer. No ambiguous approval plus text.
    if (hasOption === hasText) return fail("choice");
    if (hasOption && (!id(value.optionId) || !request.options?.some(item => item.id === value.optionId))) return fail("choice");
    if (hasText && (!text(value.text) || !value.text.trim() || (request.allowFreeform !== true && Boolean(request.options?.length)) || isNativeApproval(request))) return fail("choice");
    byId.set(value.requestId, hasOption ? { requestId: value.requestId, optionId: value.optionId as string }
      : { requestId: value.requestId, text: value.text as string });
  }
  return batch.requests.map(request => byId.get(request.requestId) ?? fail("incomplete"));
}

/** Eve 0.19 emits authorized before provider callback exchange. This is only a
 * matched callback receipt. Connection success needs the provider's verified
 * connection result, and must never be inferred from this event or browser UI. */
export function nativeAuthorizationObservation(event: unknown,
  expected: { name: string; turnId: string; sequence: number; stepIndex: number }): "callback_received" | "declined" | "failed" | "timed-out" | null {
  if (!record(event) || event.type !== "authorization.completed" || !record(event.data)) return null;
  const data = event.data;
  if (data.name !== expected.name || data.turnId !== expected.turnId ||
      data.sequence !== expected.sequence || data.stepIndex !== expected.stepIndex) return null;
  switch (data.outcome) {
    case "authorized": return "callback_received";
    case "declined": case "failed": case "timed-out": return data.outcome;
    default: return null;
  }
}
