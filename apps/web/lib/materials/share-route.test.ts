import assert from "node:assert/strict";
import test from "node:test";

import { createMaterialSharePost } from "../../app/api/materials/[id]/share/route";

const FAMILY_A = "11111111-1111-4111-8111-111111111111";
const MATERIAL_FROM_REQUEST = "22222222-2222-4222-8222-222222222222";

test("POST rejects unauthenticated share requests before material access", async () => {
  let prepared = false;
  let emitted = false;
  const post = createMaterialSharePost({
    resolveFamily: async () => null,
    prepareShare: async () => {
      prepared = true;
      throw new Error("prepareShare must not run without an authenticated family");
    },
    emitEvent: async () => {
      emitted = true;
    },
  });

  const response = await post(new Request("https://thankshoma.com/api/materials/x/share"), {
    params: Promise.resolve({ id: MATERIAL_FROM_REQUEST }),
  });

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { ready: false, reason: "no-session" });
  assert.equal(prepared, false);
  assert.equal(emitted, false);
});

test("POST scopes an arbitrary requested material to the authenticated family", async () => {
  const callerDb = { source: "caller-jwt" };
  let preparedInput: unknown;
  let emitted = false;
  const post = createMaterialSharePost({
    resolveFamily: async () => ({
      familyId: FAMILY_A,
      supabase: callerDb,
    }) as never,
    prepareShare: async (input) => {
      preparedInput = input;
      return { ready: false, note: "Material not found." };
    },
    emitEvent: async () => {
      emitted = true;
    },
  });

  const response = await post(new Request("https://thankshoma.com/api/materials/x/share"), {
    params: Promise.resolve({ id: MATERIAL_FROM_REQUEST }),
  });

  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), { ready: false, note: "Material not found." });
  assert.deepEqual(preparedInput, {
    db: callerDb,
    familyId: FAMILY_A,
    materialId: MATERIAL_FROM_REQUEST,
  });
  assert.equal(emitted, false);
});
