/** Read-only experiment primitive. No tool execution or durable writes. */
export async function raceFirstText({ copies, open, signal, now = () => performance.now() }) {
  if (![1, 2].includes(copies)) throw new Error("Expected one or two inference copies");
  const started = now();
  const controllers = Array.from({ length: copies }, () => new AbortController());
  let winner;
  let firstTextMs;
  let text = "";
  const attempts = controllers.map((_, index) => ({ index, status: "pending", firstTextMs: null }));
  await Promise.all(controllers.map(async (controller, index) => {
    const localSignal = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;
    const attempt = attempts[index];
    try {
      localSignal.throwIfAborted();
      for await (const part of await open({ index, signal: localSignal })) {
        if (part.type === "error") throw part.error;
        if (localSignal.aborted) { attempt.status = "cancelled"; break; }
        if (part.type !== "text-delta" || !part.text?.length) continue;
        attempt.firstTextMs ??= now() - started;
        if (winner === undefined) {
          winner = index;
          firstTextMs = attempt.firstTextMs;
          controllers.forEach((other, otherIndex) => {
            if (otherIndex !== winner) other.abort(new Error("Another inference supplied first answer text"));
          });
        }
        if (index === winner) text += part.text;
      }
      if (attempt.status === "pending") {
        attempt.status = localSignal.aborted ? "cancelled" : attempt.firstTextMs === null ? "no_text" : "completed";
      }
    } catch (error) {
      attempt.status = localSignal.aborted ? "cancelled" : "error";
      attempt.errorName = error?.name ?? "Error";
      // Never serialize raw provider errors, which can contain request payloads.
    } finally {
      attempt.finishedMs = now() - started;
    }
  }));
  return {
    status: winner === undefined ? "no_answer" : attempts[winner].status === "completed" ? "completed" : "partial_answer",
    winner: winner ?? null, firstTextMs: firstTextMs ?? null, text,
    totalMs: now() - started, attempts,
  };
}
