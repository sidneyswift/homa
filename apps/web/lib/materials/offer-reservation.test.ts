import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

/**
 * An accepted offer must not poison every later material (gh#372 find).
 *
 * reserveAcceptedOfferFulfillment inserts `on conflict do nothing` and
 * returns two things: `wrote`, true only when THIS call created the
 * reservation, and `referenceId`, which on a later call is the EXISTING
 * reference, meaning the id of the material the first call already
 * inserted.
 *
 * create_printable adopted that id without checking `wrote`, so the
 * insert collided on the primary key. Once a family accepted a
 * morning-brief offer and received one material, every further material
 * in that session failed with `duplicate key value violates unique
 * constraint "worksheets_pkey"` and the parent got nothing back.
 *
 * Real occurrence: four consecutive failures for one family inside a
 * single turn on 2026-07-28 (steps 7, 8, 9, 10), found by the
 * tool-failure alert on the day it was built.
 */

const source = readFileSync(
  path.join(
    path.resolve(import.meta.dirname, "..", "..", "agent", "tools"),
    "create_printable.ts",
  ),
  "utf8",
);

describe("accepted-offer reservation", () => {
  it("adopts the reserved id only when this call reserved it", () => {
    assert.match(source, /if \(reservation\.wrote && reservation\.referenceId\)/u);
  });

  it("never adopts a reference on its own, which is the collision", () => {
    assert.ok(
      !/if \(reservation\.referenceId\) \{/u.test(source),
      "a bare referenceId check re-uses an id that is already a row",
    );
  });

  it("only attributes the fulfillment when it also took the id", () => {
    // Attribution and id adoption are the same branch: crediting an
    // offer this call did not reserve would double-count it.
    const branch = source.slice(source.indexOf("reservation.wrote"));
    assert.match(branch.slice(0, 260), /reservedSourceDeliveryId = sourceOfferDeliveryId/u);
  });
});
