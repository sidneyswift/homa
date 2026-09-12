const ATTEMPT_MS = 1_250;
const TOTAL_MS = 2_500;
const MAX_ATTEMPTS = 2;
const RETRYABLE_STATUS = new Set([502, 503, 504, 520]);

type AttemptResult =
  | { kind: "response"; response: Response; body: ArrayBuffer | null }
  | { kind: "error"; retryable: boolean; response?: Response };

export interface BoundedGetFetchOptions {
  signal?: AbortSignal;
  fetch?: typeof fetch;
  attemptMs?: number;
  totalMs?: number;
}

function unavailable(message: string): Response {
  return Response.json({ message: message }, {
    status: 503,
    headers: { "cache-control": "no-store" },
  });
}

function responseWithBody(response: Response, body: BodyInit | null): Response {
  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

/** Keep a received denial authoritative even when its body cannot be read. */
function incompleteResponse(response: Response, unavailableMessage: string, deniedMessage: string): Response {
  if (response.status >= 400 && !RETRYABLE_STATUS.has(response.status)) {
    return Response.json({ message: deniedMessage }, {
      status: response.status,
      headers: { "cache-control": "no-store" },
    });
  }
  return unavailable(unavailableMessage);
}

async function readBody(response: Response, signal: AbortSignal): Promise<ArrayBuffer | null> {
  if (response.body === null) return null;
  const reader = response.body.getReader();
  let cancellation: Promise<void> | undefined;
  const cancel = () => { cancellation ??= reader.cancel().catch(() => {}); };
  signal.addEventListener("abort", cancel, { once: true });
  if (signal.aborted) cancel();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      length += value.byteLength;
    }
    await cancellation;
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return bytes.buffer;
  } finally {
    signal.removeEventListener("abort", cancel);
    await cancellation;
    reader.releaseLock();
  }
}

/** Bound one exact idempotent GET, including its body, without overlapping attempts.
 * An abort settles local fetch/body work before retry; it does not prove remote
 * server processing has stopped. A non-settling client operation is not retried. */
export function createBoundedGetFetch(
  targetUrl: string,
  policy: {
    unavailableMessage: string;
    deniedMessage: string;
    retryResponse?: (body: ArrayBuffer | null) => boolean;
  },
  options: BoundedGetFetchOptions = {},
): typeof fetch {
  const { unavailableMessage, deniedMessage } = policy;
  const fetcher = options.fetch ?? globalThis.fetch;
  const attemptMs = options.attemptMs ?? ATTEMPT_MS;
  const totalMs = options.totalMs ?? TOTAL_MS;

  return async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
    if (url !== targetUrl || method !== "GET") return fetcher(input, init);

    // Explicit null clears a Request's signal, as native fetch does; undefined
    // inherits it. The independently supplied caller signal still applies.
    const requestSignal = init?.signal !== undefined
      ? init.signal
      : input instanceof Request ? input.signal : undefined;
    const parentSignals = [options.signal, requestSignal].filter((signal): signal is AbortSignal => Boolean(signal));
    const total = new AbortController();
    const cancel = () => total.abort();
    for (const signal of parentSignals) {
      signal.addEventListener("abort", cancel, { once: true });
      if (signal.aborted) cancel();
    }
    const deadline = performance.now() + totalMs;
    const totalTimer = setTimeout(cancel, totalMs);
    let notifyTotalAbort: () => void = () => {};
    const totalAborted = new Promise<{ kind: "cancelled" }>((resolve) => {
      notifyTotalAbort = () => resolve({ kind: "cancelled" });
      total.signal.addEventListener("abort", notifyTotalAbort, { once: true });
      if (total.signal.aborted) notifyTotalAbort();
    });

    try {
      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        const remaining = deadline - performance.now();
        if (total.signal.aborted || remaining <= 0) return unavailable(unavailableMessage);
        const controller = new AbortController();
        const abortAttempt = () => controller.abort();
        total.signal.addEventListener("abort", abortAttempt, { once: true });
        const attemptTimer = attemptMs < remaining ? setTimeout(abortAttempt, attemptMs) : undefined;
        let received: Response | undefined;

        // This promise always settles to a value, including after the overall
        // deadline. A late response can neither authorize nor trigger a retry.
        const operation: Promise<AttemptResult> = (async () => {
          try {
            received = await fetcher(input, { ...init, signal: controller.signal });
            if (controller.signal.aborted) {
              await received.body?.cancel();
              return { kind: "error", retryable: true, response: received };
            }
            // Consumers parse JSON after fetch returns. Buffer under this same
            // abort signal so headers alone do not stop the lookup deadline.
            const body = await readBody(received, controller.signal);
            if (controller.signal.aborted) return { kind: "error", retryable: true, response: received };
            return { kind: "response", response: responseWithBody(received, body), body };
          } catch (error) {
            return { kind: "error", retryable: controller.signal.aborted || error instanceof TypeError, response: received };
          }
        })();

        // An attempt timeout aborts its actual fetch; it does not race ahead
        // to another request. Wait for settlement, or stop at the total limit.
        const result = await Promise.race([operation, totalAborted]);
        clearTimeout(attemptTimer);
        total.signal.removeEventListener("abort", abortAttempt);
        if (result.kind === "cancelled" || total.signal.aborted || performance.now() >= deadline) {
          controller.abort();
          return received ? incompleteResponse(received, unavailableMessage, deniedMessage) : unavailable(unavailableMessage);
        }

        if (result.kind === "response") {
          if (!RETRYABLE_STATUS.has(result.response.status) || result.response.headers.has("retry-after") || policy.retryResponse?.(result.body) === false) return result.response;
          if (attempt === MAX_ATTEMPTS - 1) return result.response;
        } else {
          if (result.response && (!RETRYABLE_STATUS.has(result.response.status) && result.response.status >= 400)) {
            return incompleteResponse(result.response, unavailableMessage, deniedMessage);
          }
          if (result.response?.headers.has("retry-after") || !result.retryable || attempt === MAX_ATTEMPTS - 1) return unavailable(unavailableMessage);
        }
      }
      return unavailable(unavailableMessage);
    } finally {
      clearTimeout(totalTimer);
      total.signal.removeEventListener("abort", notifyTotalAbort);
      for (const signal of parentSignals) signal.removeEventListener("abort", cancel);
      total.abort();
    }
  };
}
