import { createHash } from "node:crypto";
import { defineChannel, POST } from "eve/channels";

// Synthetic answer receipt, exercising the authored adapter's durable state.
export default defineChannel({
  state: { seen: {} as Record<string, string> },
  deliver(payload, ctx) {
    if (!payload.idempotencyKey) return payload;
    const key = payload.idempotencyKey;
    const digest = createHash("sha256").update(JSON.stringify(payload.inputResponses)).digest("hex");
    const prior = ctx.state.seen[key];
    if (prior !== undefined) {
      if (prior !== digest) throw new Error("Conflicting answer");
      console.log("PROBE_DUPLICATE_DROPPED", key);
      return;
    }
    ctx.state.seen[key] = digest;
    console.log("PROBE_ANSWER_ACCEPTED", key);
    return { inputResponses: payload.inputResponses };
  },
  routes: [POST("/message", async (req, { send }) => {
    const body = await req.json();
    const session = await send(body.payload ?? { message: "Start questions" }, {
      auth: null, continuationToken: body.token,
    });
    return Response.json({ sessionId: session.id });
  })],
});
