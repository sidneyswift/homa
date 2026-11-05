import { defineChannel, GET, POST, type SessionHandle } from "eve/channels";

import { runConversationSourceWindow } from "../conversation-source-cycle";
import { conversationRequestEnvelope } from "../../lib/conversation-request-admission";
import { deliverNativeConversationInput, validateStoredNativeDelivery, type NativeDeliveryState } from "../../lib/conversation-native-delivery";
import { TOOL_DEADLINE, withToolDeadline } from "../../lib/agent-tool-deadline";
import { observeConversationRequestOutcome } from "../../lib/conversation-requests";
import { conversationDispatchToken, runConversationRequestCycle, type ConversationDispatchInput } from "../conversation-request-cycle";

function options(input: ConversationDispatchInput) {
  const envelope = conversationRequestEnvelope(input.auth);
  if (!envelope) throw new Error("Conversation dispatch identity missing");
  return { auth: input.auth,state:{nativeAnswers:{}} as NativeDeliveryState,
    // Attempt-specific routing prevents Eve from coalescing different accepted
    // messages. Only the database claim provides duplicate-execution protection.
    continuationToken: input.nativeContinuation?.continuationToken ?? conversationDispatchToken(envelope.requestId, envelope.leaseToken),
    title: "Conversation request",
  };
}

export default defineChannel<NativeDeliveryState,{session:SessionHandle}>({
  state: { nativeAnswers:{} } as NativeDeliveryState,
  async deliver(payload,ctx) {
    return deliverNativeConversationInput(payload,{state:ctx.state,sessionId:ctx.session.id,auth:ctx.session.auth.current},
      (...args)=>withToolDeadline(TOOL_DEADLINE.quick,()=>validateStoredNativeDelivery(...args),true));
  },
  context(_state, session) { return { session }; },
  async receive(input, { send }) {
    if (process.env.HOMA_CONVERSATION_REQUESTS !== "1") throw new Error("Conversation requests unavailable");
    const value = input as ConversationDispatchInput;
    return send(value.nativeContinuation ? { inputResponses:value.nativeContinuation.inputResponses,idempotencyKey:value.nativeContinuation.idempotencyKey } : value.message, options(value));
  },
  events: {
    async "session.failed"(event, ctx) {
      const envelope = conversationRequestEnvelope(ctx.session.auth.current);
      if (!envelope) return;
      await observeConversationRequestOutcome(envelope, { requestId: envelope.requestId,
        leaseToken: envelope.leaseToken, sessionId: event.sessionId, outcome: "recovery_required" });
    },
  },
  routes: [
    POST("/eve/v1/conversation-request/record", async (request, { getSession }) => {
      const secret = process.env.CRON_SECRET;
      if (!secret) return Response.json({ ok: false }, { status: 503 });
      if (request.headers.get("authorization") !== `Bearer ${secret}`) return Response.json({ ok: false }, { status: 401 });
      return Response.json(await runConversationSourceWindow(async (id, startIndex) => {
        const session = await getSession(id);
        return session.getEventStream({ startIndex });
      }));
    }),
    GET("/eve/v1/conversation-request/health", async () => Response.json({ ok: true })),
    POST("/eve/v1/conversation-request/run-now", async (request, { send }) => {
      const secret = process.env.CRON_SECRET;
      if (!secret) return Response.json({ ok: false }, { status: 503 });
      if (request.headers.get("authorization") !== `Bearer ${secret}`) return Response.json({ ok: false }, { status: 401 });
      return Response.json(await runConversationRequestCycle(input => send(input.nativeContinuation ? { inputResponses:input.nativeContinuation.inputResponses,idempotencyKey:input.nativeContinuation.idempotencyKey } : input.message, options(input))));
    }),
  ],
});
