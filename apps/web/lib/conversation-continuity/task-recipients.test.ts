import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { FamilyDeliveryRecipient } from "./delivery-ledger";
import { selectTaskDeliveryRecipients } from "./task-recipients";

const MOM: FamilyDeliveryRecipient = {
  recipientKey: "member:mom-user-id",
  memberUserId: "mom-user-id",
  displayName: "Alessa",
  phoneNumbers: ["+15550000001"],
  email: "mom@example.com",
};

const INVITED_DAD: FamilyDeliveryRecipient = {
  recipientKey: "member:dad-user-id",
  memberUserId: "dad-user-id",
  displayName: "Sidney",
  phoneNumbers: ["+15550000002"],
  email: "dad@example.com",
};

const UNATTRIBUTED_PHONE: FamilyDeliveryRecipient = {
  recipientKey: "phone:legacy-row-id",
  memberUserId: null,
  displayName: null,
  phoneNumbers: ["+15550000003"],
  email: null,
};

const FAMILY_EMAIL: FamilyDeliveryRecipient = {
  recipientKey: "family-email:hash",
  memberUserId: null,
  displayName: null,
  phoneNumbers: [],
  email: "family@example.com",
};

describe("task delivery recipient selection", () => {
  it("delivers only to the named recipient, never the invited co-parent", () => {
    // The founder ruling (2026-07-12): an invited adult is not
    // auto-subscribed to task texts.
    const selected = selectTaskDeliveryRecipients(
      [MOM, INVITED_DAD, FAMILY_EMAIL],
      "mom-user-id",
    );

    assert.deepEqual(
      selected.map((recipient) => recipient.recipientKey),
      ["member:mom-user-id"],
    );
  });

  it("falls back to the account owner when a legacy row has no recipient", () => {
    // Built-in schedules seeded before the recipient column existed carry
    // null; the first member is the account owner.
    const selected = selectTaskDeliveryRecipients([MOM, INVITED_DAD], null);

    assert.deepEqual(
      selected.map((recipient) => recipient.recipientKey),
      ["member:mom-user-id"],
    );
  });

  it("delivers to the invited adult's own task when they created it", () => {
    const selected = selectTaskDeliveryRecipients(
      [MOM, INVITED_DAD],
      "dad-user-id",
    );

    assert.deepEqual(
      selected.map((recipient) => recipient.recipientKey),
      ["member:dad-user-id"],
    );
  });

  it("keeps a single adult's unattributed phone reachable", () => {
    // Rows linked before per-member phone attribution: with exactly one
    // adult in the family, the loose phone can only be theirs.
    const soloMember: FamilyDeliveryRecipient = {
      ...MOM,
      phoneNumbers: [],
    };

    const selected = selectTaskDeliveryRecipients(
      [soloMember, UNATTRIBUTED_PHONE, FAMILY_EMAIL],
      null,
    );

    assert.deepEqual(
      selected.map((recipient) => recipient.recipientKey),
      ["member:mom-user-id", "phone:legacy-row-id"],
    );
  });

  it("excludes unattributed phones once a second adult exists", () => {
    const selected = selectTaskDeliveryRecipients(
      [MOM, INVITED_DAD, UNATTRIBUTED_PHONE],
      "mom-user-id",
    );

    assert.deepEqual(
      selected.map((recipient) => recipient.recipientKey),
      ["member:mom-user-id"],
    );
  });

  it("leaves member-less families on the legacy full fan-out", () => {
    const selected = selectTaskDeliveryRecipients(
      [UNATTRIBUTED_PHONE, FAMILY_EMAIL],
      null,
    );

    assert.deepEqual(
      selected.map((recipient) => recipient.recipientKey),
      ["phone:legacy-row-id", "family-email:hash"],
    );
  });

  it("falls back to the account owner when the named recipient left", () => {
    const selected = selectTaskDeliveryRecipients(
      [MOM, INVITED_DAD],
      "gone-user-id",
    );

    assert.deepEqual(
      selected.map((recipient) => recipient.recipientKey),
      ["member:mom-user-id"],
    );
  });

  it("fails closed when an exact recovery recipient left", () => {
    assert.deepEqual(
      selectTaskDeliveryRecipients(
        [MOM, INVITED_DAD, FAMILY_EMAIL],
        "gone-user-id",
        true,
      ),
      [],
    );
    assert.deepEqual(
      selectTaskDeliveryRecipients(
        [MOM, INVITED_DAD, FAMILY_EMAIL],
        null,
        true,
      ),
      [],
    );
  });

  it("keeps exact recovery delivery on the accepting adult", () => {
    assert.deepEqual(
      selectTaskDeliveryRecipients(
        [MOM, INVITED_DAD, UNATTRIBUTED_PHONE, FAMILY_EMAIL],
        "dad-user-id",
        true,
      ).map((recipient) => recipient.recipientKey),
      ["member:dad-user-id"],
    );
  });
});
