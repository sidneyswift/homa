import {
  createFallbackPromptSuggestionSet,
  parsePromptSuggestionSet,
  type PromptSuggestionRequest,
  type PromptSuggestionSet,
} from "../../lib/chat-suggestions/contract";

export const PROMPT_SUGGESTION_REQUEST_TIMEOUT_MS = 6_000;

export interface PromptSuggestionRequestOptions {
  fetch?: typeof globalThis.fetch;
  signal?: AbortSignal;
}

function createExternalAbortError(): DOMException {
  return new DOMException("Prompt suggestion request cancelled", "AbortError");
}

function throwIfExternallyAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw createExternalAbortError();
}

/**
 * Requests the next-message suggestions for one finished assistant reply.
 * Route failures become one safe fallback, while caller cancellation remains
 * an AbortError so stale requests never create fallback UI.
 */
export async function requestPromptSuggestionSet(
  request: PromptSuggestionRequest,
  options: PromptSuggestionRequestOptions = {},
): Promise<PromptSuggestionSet> {
  throwIfExternallyAborted(options.signal);

  const assistantText = request.messages.at(-1)?.text ?? "";
  const createRequestFallback = () =>
    createFallbackPromptSuggestionSet(
      request.assistantMessageId,
      assistantText,
    );
  const fetchRequest = options.fetch ?? globalThis.fetch;
  const requestController = new AbortController();
  let timedOut = false;
  const cancelStaleRequest = () => {
    requestController.abort(createExternalAbortError());
  };
  options.signal?.addEventListener("abort", cancelStaleRequest, { once: true });
  const timeout = setTimeout(() => {
    timedOut = true;
    requestController.abort(
      new DOMException("Prompt suggestion request timed out", "TimeoutError"),
    );
  }, PROMPT_SUGGESTION_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetchRequest("/api/chat/suggestions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request),
      signal: requestController.signal,
    });
    throwIfExternallyAborted(options.signal);
    if (!response.ok) {
      return createRequestFallback();
    }

    const parsed = parsePromptSuggestionSet(await response.json());
    throwIfExternallyAborted(options.signal);
    return (
      parsed
      ?? createRequestFallback()
    );
  } catch {
    if (options.signal?.aborted && !timedOut) {
      throw createExternalAbortError();
    }
    return createRequestFallback();
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", cancelStaleRequest);
  }
}
