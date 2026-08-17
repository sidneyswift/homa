import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createHoursExportGet } from "./route";

const FAMILY_ID = "11111111-1111-4111-8111-111111111111";

describe("GET /api/hours/export", () => {
  it("rejects a request before reading records when no family is signed in", async () => {
    let read = false;
    const get = createHoursExportGet({
      resolveActor: async () => null,
      getRows: async () => {
        read = true;
        return [];
      },
    });
    const response = await get(new Request("https://thankshoma.com/api/hours/export"));
    assert.equal(response.status, 401);
    assert.equal(read, false);
  });

  it("scopes the complete download to the signed-in family", async () => {
    let requestedFamilyId: string | null = null;
    const get = createHoursExportGet({
      resolveActor: async () => ({
        family: { id: FAMILY_ID },
        memberUserId: "22222222-2222-4222-8222-222222222222",
      }) as never,
      getRows: async (familyId) => {
        requestedFamilyId = familyId;
        return [];
      },
    });
    const response = await get(new Request("https://thankshoma.com/api/hours/export"));
    assert.equal(requestedFamilyId, FAMILY_ID);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "text/csv; charset=utf-8");
    assert.equal(
      response.headers.get("content-disposition"),
      'attachment; filename="homa-school-hours.csv"',
    );
    assert.equal(response.headers.get("cache-control"), "no-store");
  });

  it("does not let an anonymous onboarding resume cookie download records", async () => {
    let read = false;
    const get = createHoursExportGet({
      resolveActor: async () => ({ family: { id: FAMILY_ID }, memberUserId: null }) as never,
      getRows: async () => {
        read = true;
        return [];
      },
    });
    const response = await get(new Request("https://thankshoma.com/api/hours/export"));
    assert.equal(response.status, 401);
    assert.equal(read, false);
  });
});
