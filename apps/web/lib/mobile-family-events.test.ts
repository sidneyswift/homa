import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type {
  EventProps,
  MobileFamilyEventName,
} from "@homa/core";

import {
  createMobileFamilyEventHandler,
  type MobileFamilyEventDependencies,
} from "./mobile-family-events";

const FAMILY_ID = "319755d9-2df7-4b75-8470-fd9f45227b05";
const MATERIAL_ID = "fcd8c9d4-5116-4db3-94fe-11512990fb69";

function request(body: unknown): Request {
  return new Request("https://thankshoma.com/api/mobile/event", {
    method: "POST",
    headers: {
      Authorization: "Bearer verified-token",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

async function responseBody(response: Response): Promise<unknown> {
  return response.json();
}

function dependencies(overrides: Partial<MobileFamilyEventDependencies> = {}) {
  const persisted: Array<{
    name: MobileFamilyEventName;
    props: EventProps<MobileFamilyEventName>;
    familyId: string;
  }> = [];
  const value: MobileFamilyEventDependencies = {
    rateLimited: () => false,
    authenticate: async () => ({ id: FAMILY_ID }),
    persist: async (name, props, familyId) => {
      persisted.push({ name, props, familyId });
    },
    logError: () => undefined,
    ...overrides,
  };
  return { value, persisted };
}

describe("native family event relay", () => {
  it("server-stamps the authenticated family into props and row scope", async () => {
    const deps = dependencies();
    const handler = createMobileFamilyEventHandler(deps.value);
    const response = await handler(
      request({
        name: "materials.print_result",
        props: {
          material_id: MATERIAL_ID,
          outcome: "completed",
          requested_copies: 1,
          pages_selected: 2,
          answer_key_excluded: false,
        },
      }),
    );

    assert.equal(response.status, 200);
    assert.deepEqual(await responseBody(response), { ok: true });
    assert.deepEqual(deps.persisted, [
      {
        name: "materials.print_result",
        familyId: FAMILY_ID,
        props: {
          family_id: FAMILY_ID,
          material_id: MATERIAL_ID,
          outcome: "completed",
          requested_copies: 1,
          pages_selected: 2,
          answer_key_excluded: false,
        },
      },
    ]);
  });

  it("keeps chat props family-free while scoping the database row", async () => {
    const deps = dependencies();
    const handler = createMobileFamilyEventHandler(deps.value);
    const response = await handler(
      request({
        name: "chat.turn_completed",
        props: {
          status: "ok",
          modality: "text",
          latency_ms: 420,
          model_tier: "premium",
          tool_calls: 2,
        },
      }),
    );

    assert.equal(response.status, 200);
    assert.deepEqual(deps.persisted, [
      {
        name: "chat.turn_completed",
        familyId: FAMILY_ID,
        props: {
          status: "ok",
          modality: "text",
          latency_ms: 420,
          model_tier: "premium",
          tool_calls: 2,
        },
      },
    ]);
  });

  it("fails closed for missing auth and rate limiting", async () => {
    const noAuth = dependencies({ authenticate: async () => null });
    const limited = dependencies({ rateLimited: () => true });
    const body = {
      name: "planner.device_calendar_previewed",
      props: { selected_count: 2, duplicate_count: 0 },
    };

    const noAuthResponse = await createMobileFamilyEventHandler(noAuth.value)(
      request(body),
    );
    const limitedResponse = await createMobileFamilyEventHandler(limited.value)(
      request(body),
    );

    assert.equal(noAuthResponse.status, 401);
    assert.deepEqual(await responseBody(noAuthResponse), {
      ok: false,
      reason: "no-session",
    });
    assert.equal(limitedResponse.status, 429);
    assert.equal(noAuth.persisted.length, 0);
    assert.equal(limited.persisted.length, 0);
  });

  it("rejects invalid JSON, non-allowlisted names, and malformed props", async () => {
    const deps = dependencies();
    const handler = createMobileFamilyEventHandler(deps.value);
    const badJson = new Request("https://thankshoma.com/api/mobile/event", {
      method: "POST",
      body: "{",
    });

    const responses = await Promise.all([
      handler(badJson),
      handler(request({ name: "family.invite_sent", props: {} })),
      handler(
        request({
          name: "planner.device_calendar_previewed",
          props: { selected_count: 0, duplicate_count: 0 },
        }),
      ),
    ]);

    assert.deepEqual(
      responses.map((response) => response.status),
      [400, 400, 400],
    );
    assert.deepEqual(await responseBody(responses[0]), {
      ok: false,
      reason: "bad-json",
    });
    assert.equal(deps.persisted.length, 0);
  });

  it("rejects client identity and family content fields", async () => {
    const forbiddenFields = [
      ["family_id", FAMILY_ID],
      ["user_id", "user-1"],
      ["message", "private family text"],
      ["recipient", "parent@example.com"],
    ] as const;

    for (const [field, value] of forbiddenFields) {
      const deps = dependencies();
      const response = await createMobileFamilyEventHandler(deps.value)(
        request({
          name: "materials.share_result",
          props: {
            material_id: MATERIAL_ID,
            outcome: "handed_off",
            [field]: value,
          },
        }),
      );
      assert.equal(response.status, 400, field);
      assert.equal(deps.persisted.length, 0, field);
    }
  });

  it("returns an honest failure when durable persistence fails", async () => {
    const deps = dependencies({
      persist: async () => {
        throw new Error("database unavailable");
      },
    });
    const response = await createMobileFamilyEventHandler(deps.value)(
      request({
        name: "planner.device_calendar_previewed",
        props: { selected_count: 2, duplicate_count: 1 },
      }),
    );

    assert.equal(response.status, 503);
    assert.deepEqual(await responseBody(response), {
      ok: false,
      reason: "unavailable",
    });
  });
});
