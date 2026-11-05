import {
  validAcceptanceReceipt,
  type ConversationOutboxTransport,
} from "./conversation-outbox";

const endpoint = "/api/conversation/requests";
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/iu;

/** Each attempt bootstraps ownership from the server using the same bearer it
 * will submit with. No cookie fallback, cross-origin redirects or cached auth. */
export function createConversationHttpTransport(input: {
  accessToken(): Promise<string | null>;
  fetch?: typeof fetch;
  signal: AbortSignal;
}): ConversationOutboxTransport {
  const send = input.fetch ?? fetch;
  const options = (token: string, signal: AbortSignal): RequestInit => ({
    headers: { authorization: `Bearer ${token}` },
    credentials: "omit", cache: "no-store", redirect: "error",
    signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]),
  });
  return {
    async session() {
      const accessToken = await input.accessToken();
      if (!accessToken) return null;
      const response = await send(endpoint, options(accessToken, input.signal));
      if (response.status === 401) return null;
      if (!response.ok) throw new Error("Conversation access unavailable");
      const body = await response.json();
      const account: string[] = typeof body?.account === "string" ? body.account.split(":") : [];
      if (account.length !== 2 || !account.every(value => uuid.test(value)) ||
          typeof body?.accessEpoch !== "string" || !uuid.test(body.accessEpoch) ||
          typeof body?.conversationId !== "string" || !uuid.test(body.conversationId)) {
        throw new Error("Invalid conversation access");
      }
      return { account: body.account, accessEpoch: body.accessEpoch, accessToken };
    },
    async accept(entry, token, signal) {
      const response = await send(entry.nativeInput ? "/api/conversation/native-input" : endpoint, {
        ...options(token, signal), method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ account: entry.account, accessEpoch: entry.accessEpoch,
          intentId: entry.intentId, ...(entry.nativeInput ? entry.nativeInput : entry.questionAnswer ? { questionAnswer: entry.questionAnswer } : { text: entry.text, ...(entry.replyToQuestionId ? { replyToQuestionId: entry.replyToQuestionId } : {}), ...(entry.attachmentIds?.length ? { attachmentIds: entry.attachmentIds } : {}) }) }),
      });
      if (response.status === 401) return { kind: "sign_in" };
      // Infrastructure errors, ambiguous bodies and changed access all retain
      // the exact intent. The next access bootstrap decides account/epoch safety.
      let body;
      try { body = await response.json(); } catch { return { kind: "retry" }; }
      if ((response.status === 200 || response.status === 202) && validAcceptanceReceipt(entry, body?.receipt)) {
        return { kind: "accepted", receipt: body.receipt };
      }
      if (response.status === 409 && body?.reason === "conflict") return { kind: "conflict" };
      if (response.status === 410 && body?.reason === "deleted") return { kind: "deleted" };
      if ((response.status === 400 && body?.reason === "invalid") ||
          (response.status === 413 && body?.reason === "too_large")) return { kind: "rejected" };
      return { kind: "retry" };
    },
  };
}
