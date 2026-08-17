import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  ACTIVE_MATERIAL_HEADER,
  materialIdFromHeader,
  materialRevisionDraft,
  withActiveMaterialHeader,
} from "./material-revision-handoff";

const MATERIAL_ID = "11111111-1111-4111-8111-111111111111";

describe("Binder material revision handoff", () => {
  it("creates copy only for the closed Binder route", () => {
    assert.deepEqual(
      materialRevisionDraft({
        draft: "revise-material",
        materialId: MATERIAL_ID,
      }),
      {
        message: "Keep this layout, but ",
        materialId: MATERIAL_ID,
      },
    );
    assert.equal(
      materialRevisionDraft({ draft: "journal", materialId: MATERIAL_ID }),
      undefined,
    );
    assert.equal(
      materialRevisionDraft({
        draft: "revise-material",
        materialId: "another-family's worksheet",
      }),
      undefined,
    );
  });

  it("keeps the id invisible while the parent finishes the prepared request", () => {
    const headers = { "x-homa-message-lane": "parent" };
    assert.deepEqual(
      withActiveMaterialHeader({
        headers,
        visibleMessage: "Keep this layout, but use numbers up to 20.",
        initialMessage: "Keep this layout, but ",
        materialId: MATERIAL_ID,
      }),
      {
        ...headers,
        [ACTIVE_MATERIAL_HEADER]: MATERIAL_ID,
      },
    );
    assert.deepEqual(
      withActiveMaterialHeader({
        headers,
        visibleMessage: "What should we do tomorrow?",
        initialMessage: "Keep this layout, but ",
        materialId: MATERIAL_ID,
      }),
      headers,
    );
  });

  it("accepts only a UUID from the request header", () => {
    assert.equal(materialIdFromHeader(MATERIAL_ID), MATERIAL_ID);
    assert.equal(materialIdFromHeader("not-a-material-id"), undefined);
  });

  it("exposes the closed handoff from the Binder detail", () => {
    const overlay = readFileSync(
      new URL("../app/app/binder/material-detail-overlay.tsx", import.meta.url),
      "utf8",
    );
    assert.match(overlay, /Change this with Homa/u);
    assert.match(
      overlay,
      /draft=revise-material&material=\$\{encodeURIComponent\(material\.id\)\}/u,
    );
  });
});
