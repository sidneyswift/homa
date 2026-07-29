import assert from "node:assert/strict";
import test, { afterEach } from "node:test";

import {
  VOICE_ASSISTANT_NAME,
  generalLineIds,
  resetGeneralLineCache,
} from "./general-line";

const realFetch = globalThis.fetch;

function stubFetch(handler: (path: string) => unknown | null): number[] {
  const calls: number[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    calls.push(1);
    const payload = handler(String(input));
    if (payload === null) return new Response("nope", { status: 500 });
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof globalThis.fetch;
  return calls;
}

afterEach(() => {
  globalThis.fetch = realFetch;
  resetGeneralLineCache();
});

test("finds the general assistant by name and reads its TeXML app", async () => {
  stubFetch(() => ({
    data: [
      { id: "other", name: "Homa curriculum call" },
      {
        id: "general",
        name: VOICE_ASSISTANT_NAME,
        telephony_settings: { default_texml_app_id: "app-1" },
      },
    ],
  }));
  assert.deepEqual(await generalLineIds("k"), {
    assistantId: "general",
    texmlAppId: "app-1",
  });
});

// Calling the wrong assistant means a parent's phone rings and the wrong
// Homa answers, with the wrong prompt and the wrong tools.
test("never returns another assistant when the general one is absent", async () => {
  stubFetch(() => ({ data: [{ id: "other", name: "Homa curriculum call" }] }));
  assert.equal(await generalLineIds("k"), null);
});

test("re-reads the assistant when the list omits telephony_settings", async () => {
  const calls = stubFetch((path) =>
    path.endsWith("/ai/assistants")
      ? { data: [{ id: "general", name: VOICE_ASSISTANT_NAME }] }
      : { data: { id: "general", name: VOICE_ASSISTANT_NAME, telephony_settings: { default_texml_app_id: "app-2" } } },
  );
  assert.deepEqual(await generalLineIds("k"), {
    assistantId: "general",
    texmlAppId: "app-2",
  });
  assert.equal(calls.length, 2, "should have fallen back to the detail read");
});

test("an assistant with no TeXML app yet resolves to null, not a half answer", async () => {
  stubFetch(() => ({ data: [{ id: "general", name: VOICE_ASSISTANT_NAME }] }));
  assert.equal(await generalLineIds("k"), null);
});

test("a Telnyx failure returns null and is not cached", async () => {
  stubFetch(() => null);
  assert.equal(await generalLineIds("k"), null);

  stubFetch(() => ({
    data: [
      {
        id: "general",
        name: VOICE_ASSISTANT_NAME,
        telephony_settings: { default_texml_app_id: "app-3" },
      },
    ],
  }));
  assert.deepEqual(await generalLineIds("k"), {
    assistantId: "general",
    texmlAppId: "app-3",
  });
});

test("a resolved answer is cached, so a call does not pay the lookup twice", async () => {
  const calls = stubFetch(() => ({
    data: [
      {
        id: "general",
        name: VOICE_ASSISTANT_NAME,
        telephony_settings: { default_texml_app_id: "app-4" },
      },
    ],
  }));
  await generalLineIds("k");
  await generalLineIds("k");
  assert.equal(calls.length, 1);
});
