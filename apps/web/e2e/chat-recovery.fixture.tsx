import { StrictMode, useRef, useState } from "react";
import { createRoot } from "react-dom/client";

import { useRecoverableChatAgent } from "../app/app/use-recoverable-chat-agent";

declare const USES_SESSION_HANDLES: boolean;
const requests: { method: string; path: string; message?: string }[] = [];
let complete: (() => void) | undefined;
let sessionCount = 0;
let deliveryCount = 0;
let latestDelivery = "";
const encoder = new TextEncoder();

// This fixture never reaches a provider or app endpoint. Only the actual
// React hook, Eve client/store/reducer, and browser stream reader are exercised.
globalThis.fetch = async (url, init = {}) => {
  const parsed = new URL(String(url));
  if (parsed.origin !== "https://homa-recovery.test") throw new Error("Unexpected fixture origin");
  if (new Headers(init.headers).get("authorization") !== "Bearer synthetic-fixture") throw new Error("Missing fixture auth");
  const method = init.method ?? "GET";
  const message = init.body ? JSON.parse(String(init.body)).message : undefined;
  requests.push({ method, path: parsed.pathname, message });
  if (method === "POST") {
    if (parsed.pathname.includes("cancel")) throw new Error("Local stop must not cancel server work");
    const sessionId = parsed.pathname.split("/")[4] ?? `fixture-session-${++sessionCount}`;
    latestDelivery = `fixture-delivery-${++deliveryCount}`;
    return Response.json({ sessionId, deliveryId: latestDelivery, continuationToken: "synthetic-token" }, { status: 202 });
  }
  if (!parsed.pathname.endsWith("/stream")) throw new Error("Unexpected fixture read");
  const sequence = Number(parsed.searchParams.get("startIndex") ?? 0);
  const turnId = `fixture-turn-${deliveryCount}`;
  const text = `Answer ${deliveryCount}`;
  const meta = { deliveryIds: [latestDelivery] };
  let open = true;
  let abort = () => {};
  const body = new ReadableStream({
    start(controller) {
      const emit = (type: string, data: object) => controller.enqueue(encoder.encode(`${JSON.stringify({
        type, data, meta: { ...meta, at: "2026-09-13T00:00:00.000Z", id: `${turnId}-${type}` },
      })}\n`));
      emit("turn.started", { turnId, sequence });
      emit("message.appended", { turnId, sequence: sequence + 1, stepIndex: 0, messageDelta: text,
        ...(USES_SESSION_HANDLES ? {} : { messageSoFar: text }),
      });
      complete = () => {
        if (!open) return;
        open = false;
        emit("message.completed", { turnId, sequence: sequence + 2, stepIndex: 0, message: text, finishReason: "stop" });
        emit("session.waiting", { wait: "next-user-message" });
        controller.close();
        init.signal?.removeEventListener("abort", abort);
      };
      abort = () => {
        if (!open) return;
        open = false;
        controller.error(new DOMException("Fixture stream interrupted", "AbortError"));
      };
      init.signal?.addEventListener("abort", abort, { once: true });
    },
    cancel() { open = false; init.signal?.removeEventListener("abort", abort); },
  });
  return new Response(body, { headers: {
    "content-type": "application/x-ndjson",
    "x-eve-stream-version": USES_SESSION_HANDLES ? "25" : "16",
  } });
};

function Fixture() {
  const [finishes, setFinishes] = useState(0);
  const queue = useRef(false);
  const agent = useRecoverableChatAgent({
    connection: { host: "https://homa-recovery.test", auth: { bearer: "synthetic-fixture" } },
    reconnectAttempts: 8,
    usesSessionHandles: USES_SESSION_HANDLES,
    onFinish() {
      setFinishes(finishes + 1);
      if (queue.current) {
        queue.current = false;
        void agent.send({ message: "Queued question" });
      }
    },
  });
  const text = agent.data.messages.filter(message => message.role === "assistant")
    .flatMap(message => message.parts).filter(part => part.type === "text")
    .map(part => part.text).join(" ");
  return <>
    <div id="status">{agent.status}</div><div id="text">{text}</div>
    <div id="session">{agent.session.sessionId ?? "none"}</div>
    <div id="finishes">{finishes}</div>
    <button onClick={() => { void agent.send({ message: "First question" }); }}>Send</button>
    <button onClick={() => { queue.current = true; void agent.send({ message: "Before queued question" }); }}>Send with queue</button>
    <button onClick={() => complete?.()}>Complete</button>
    <button onClick={() => agent.stop()}>Stop listening</button>
    <button onClick={() => agent.adopt({ sessionId: "fixture-recovered", streamIndex: 12, continuationToken: "synthetic-token" })}>Adopt recovered</button>
    <button onClick={() => agent.reset()}>Reset</button>
    <button onClick={() => { document.querySelector("#requests")!.textContent = JSON.stringify(requests); }}>Inspect requests</button>
    <pre id="requests" />
  </>;
}

createRoot(document.querySelector("#root")!).render(<StrictMode><Fixture /></StrictMode>);
