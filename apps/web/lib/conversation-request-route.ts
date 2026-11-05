import { requestAuthTransport } from "./api-auth";
import { resolveConversationRequestPrincipal } from "./conversation-request-auth";
import type { RecordingPrincipal } from "./conversation-recording";
import {
  acceptConversationRequest, acceptConversationQuestionAnswer, ConversationRequestError,
  readConversationAccess, readConversationRequest, readConversationQuestions,
} from "./conversation-requests";
import { rateLimited } from "./map/ratelimit";

export interface ConversationRequestRouteDependencies {
  enabled(): boolean;
  principal(request: Request): Promise<RecordingPrincipal | null>;
  access: typeof readConversationAccess;
  accept: typeof acceptConversationRequest;
  answer: typeof acceptConversationQuestionAnswer;
  receipt: typeof readConversationRequest;
  questions: typeof readConversationQuestions;
  limited(account: string): boolean;
}

const production: ConversationRequestRouteDependencies = {
  // Rollout stays off until the durable dispatcher and readable response feed
  // are certified. Accepting work without its consumer would strand parents.
  enabled: () => process.env.HOMA_CONVERSATION_REQUESTS === "1",
  principal: resolveConversationRequestPrincipal,
  access: readConversationAccess,
  accept: acceptConversationRequest,
  answer: acceptConversationQuestionAnswer,
  receipt: readConversationRequest,
  questions: readConversationQuestions,
  limited: account => rateLimited(`conversation-request:${account}`, 120),
};
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/iu;
export const MAX_CONVERSATION_REQUEST_BYTES = 1024 * 1024;

function response(body: object, status = 200) {
  return Response.json(body, { status, headers: {
    "cache-control": "private, no-store", "vary": "Authorization",
    ...(status === 429 || status === 503 ? { "retry-after": "5" } : {}),
  } });
}

export class BodyError extends Error {
  constructor(readonly status: number, readonly reason: string) { super(reason); }
}

export async function inputBody(request: Request): Promise<Record<string, unknown>> {
  if (request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json") {
    throw new BodyError(415, "invalid");
  }
  // Count actual bytes, including chunked bodies. Never trust Content-Length
  // or truncate a parent's message to fit the admission envelope.
  const reader = request.body?.getReader();
  if (!reader) throw new BodyError(400, "invalid");
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_CONVERSATION_REQUEST_BYTES) {
        await reader.cancel();
        throw new BodyError(413, "too_large");
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try {
    const body: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
    return body as Record<string, unknown>;
  } catch { throw new BodyError(400, "invalid"); }
}

/** GET bootstraps the authenticated account, or retrieves one exact intent.
 * POST acknowledges only a committed canonical message plus dispatch request.
 * The supplied account is a mismatch guard, never an authority selector. */
export async function conversationRequestResponse(
  request: Request, dependencies: ConversationRequestRouteDependencies = production,
): Promise<Response> {
  if (!dependencies.enabled()) return response({ reason: "unavailable" }, 503);
  if (request.method !== "GET" && request.method !== "POST") return response({ reason: "method" }, 405);
  if (requestAuthTransport(request).kind !== "bearer") return response({ reason: "sign_in" }, 401);
  try {
    const principal = await dependencies.principal(request);
    if (!principal) return response({ reason: "sign_in" }, 401);
    const account = `${principal.familyId}:${principal.memberUserId}`;
    if (dependencies.limited(account)) return response({ reason: "retry" }, 429);
    if (request.method === "GET") {
      const params = new URL(request.url).searchParams;
      const intentId = params.get("intentId");
      const questions = params.get("questions") === "true";
      if (!intentId && !questions) return response({ account, ...await dependencies.access(principal) });
      if (params.get("account") !== account) return response({ reason: "account_changed" }, 409);
      const accessEpoch = params.get("accessEpoch");
      if (!accessEpoch || !uuid.test(accessEpoch) || (!questions && (!intentId || !uuid.test(intentId)))) return response({ reason: "invalid" }, 400);
      if (questions) return response({ questions: await dependencies.questions({ ...principal, accessEpoch }) });
      const receipt = await dependencies.receipt({ ...principal, accessEpoch }, intentId!);
      return receipt ? response({ receipt }) : response({ reason: "missing" }, 404);
    }
    const body = await inputBody(request);
    if (Object.keys(body).some(key => !["account", "accessEpoch", "intentId", "text", "questionAnswer", "attachmentIds", "replyToQuestionId"].includes(key)) ||
        typeof body.account !== "string" || typeof body.accessEpoch !== "string" ||
        !uuid.test(body.accessEpoch) || typeof body.intentId !== "string" || !uuid.test(body.intentId) ||
        (Object.hasOwn(body, "text") === Object.hasOwn(body, "questionAnswer") ||
          (Object.hasOwn(body, "text") && typeof body.text !== "string"))) return response({ reason: "invalid" }, 400);
    if (body.attachmentIds !== undefined && (!Array.isArray(body.attachmentIds) ||
      body.attachmentIds.length > 6 || !body.attachmentIds.every(id => typeof id === "string" && uuid.test(id)) ||
      body.questionAnswer !== undefined)) return response({ reason: "invalid" },400);
    if (body.account !== account) return response({ reason: "account_changed" }, 409);
    const owner = { ...principal, accessEpoch: body.accessEpoch };
    if (body.replyToQuestionId !== undefined && (typeof body.replyToQuestionId !== "string" || !uuid.test(body.replyToQuestionId) || body.questionAnswer !== undefined)) throw new BodyError(400, "invalid");
    const receipt = body.questionAnswer === undefined
      ? await dependencies.accept(owner, { intentId: body.intentId, text: body.text as string, ...(body.attachmentIds ? { attachmentIds: body.attachmentIds as string[] } : {}), ...(body.replyToQuestionId !== undefined ? { replyToQuestionId: body.replyToQuestionId as string } : {}) })
      : await dependencies.answer(owner, { intentId: body.intentId, questionAnswer: body.questionAnswer });
    return response({ receipt }, receipt.replayed ? 200 : 202);
  } catch (error) {
    if (error instanceof BodyError) return response({ reason: error.reason }, error.status);
    if (error instanceof ConversationRequestError) {
      const status = error.code === "invalid" ? 400 : error.code === "membership" ? 403 :
        error.code === "deleted" ? 410 : error.code === "missing" ? 404 : 409;
      return response({ reason: error.code }, status);
    }
    // No transcript, token, SQL detail or provider error is exposed/logged here.
    // An unknown commit outcome must remain retryable with the original intent.
    return response({ reason: "retry" }, 503);
  }
}
