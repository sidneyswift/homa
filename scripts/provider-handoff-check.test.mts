import assert from "node:assert/strict";
import test from "node:test";

import {
  collectProviderRepositoryPaths,
  loadProviderHandoffInputs,
  providerSourcePathsByHandoffId,
  reconcileProviderHandoffBindings,
  validateProviderHandoffs,
  type ProviderHandoffFile,
} from "./provider-handoff-contract.mts";
import { loadTrackedPathChecksums } from "./evidence-receipt-loader.mts";
import type { EvidenceReceiptCatalog, EvidenceReceiptCatalogEntry } from "../packages/design/src/evidence-receipts.ts";
import { resolve } from "node:path";

const inputs = loadProviderHandoffInputs();
const root = resolve(import.meta.dirname, "..");
const { checksums: sourceChecksums } = loadTrackedPathChecksums(root, collectProviderRepositoryPaths(inputs.handoffs));
const emptyReceiptCatalog: EvidenceReceiptCatalog = new Map();
const validate = (candidate: unknown, receiptCatalog: EvidenceReceiptCatalog = emptyReceiptCatalog) =>
  validateProviderHandoffs({ manifest: inputs.manifest, handoffs: candidate, sourceChecksums, receiptCatalog });

function artifactCatalogEntry(
  reference: NonNullable<ProviderHandoffFile["records"][number]["readback"]["evidencePath"]>,
  subjectId: string,
  proofKind: "provider-readback" | "rollback-rehearsal",
  scopedInputFingerprint: string,
): EvidenceReceiptCatalogEntry {
  const underlyingProof = {
    kind: "artifact" as const,
    path: "docs/homa-design/evidence/artifacts/provider-proof.json" as const,
    sha256: "e".repeat(64),
  };
  return {
    reference,
    actualSha256: reference.sha256,
    envelope: {
      schemaVersion: 2,
      id: reference.id,
      domain: "provider",
      subjectId,
      proofKind,
      scopedInputFingerprint,
      underlyingProof,
      observedAt: "2026-08-04T12:00:00.000Z",
      environment: "production",
      observer: "independent critic",
      notes: "Observed provider state directly.",
    },
    committed: true,
    underlyingProof: {
      reference: underlyingProof,
      actualSha256: underlyingProof.sha256,
      committed: true,
      attestation: null,
      authenticated: true,
    },
  };
}

test("committed provider handoffs cover every #732 record and stay pending without external read-back", () => {
  assert.deepEqual(validate(inputs.handoffs), []);
  assert.equal(inputs.handoffs.records.length, 5);
  assert.ok(
    inputs.handoffs.records
      .filter((record) => record.id !== "apple-subscription-management")
      .every((record) => record.status === "pending"),
  );
  assert.equal(
    inputs.handoffs.records.find(
      (record) => record.id === "apple-subscription-management",
    )?.status,
    "blocked",
  );
  assert.ok(inputs.handoffs.records.every((record) => record.readback.status === "pending"));
  assert.ok(inputs.handoffs.records.every((record) => record.readback.externalStateSimulated === false));
  assert.ok(inputs.handoffs.records.every((record) => record.surfaceIds.length > 0));
  assert.equal(inputs.handoffs.sourceCoverage.bindings.length, inputs.handoffs.sourceCoverage.sourceCount);
  const governingPaths = [
    "apps/web/lib/billing/portal.ts",
    "apps/web/lib/billing/wall.ts",
    "apps/web/lib/billing/apple-verify.ts",
    "apps/web/lib/supabase/server.ts",
    "apps/web/lib/supabase/client.ts",
    "apps/web/.env.example",
  ];
  for (const path of governingPaths) {
    assert.ok(inputs.handoffs.sourceCoverage.bindings.some((binding) => binding.path === path && /^[0-9a-f]{64}$/.test(binding.sha256)), `${path} lacks a source hash`);
    const surface = inputs.manifest.surfaces.find((candidate) => candidate.paths[0] === path);
    assert.ok(surface, `${path} lacks an exact manifest surface`);
    assert.equal(inputs.handoffs.records.filter((record) => record.surfaceIds.includes(surface.id)).length, 1, `${path} must have one evidence owner`);
  }
});

test("Stripe handoff binds and describes server-created Checkout", () => {
  const record = inputs.handoffs.records.find((candidate) => candidate.id === "stripe-checkout-and-portal");
  assert.ok(record);
  assert.deepEqual(record.sourcePaths, [...providerSourcePathsByHandoffId["stripe-checkout-and-portal"]]);

  const serverSources = [
    "apps/web/app/api/billing/checkout/route.ts",
    "apps/web/lib/account-deletion-billing.ts",
    "apps/web/lib/account-deletion.ts",
    "apps/web/lib/billing/checkout-intent.ts",
    "apps/web/lib/billing/entitlements.ts",
    "apps/web/lib/billing/server-checkout.ts",
    "apps/web/lib/billing/stripe-checkout-config.ts",
    "apps/web/lib/billing/stripe-server-checkout.ts",
  ];
  for (const path of serverSources) assert.ok(record.sourcePaths.includes(path), `${path} is not bound`);

  const serverCheckout = record.configurableFields.find((field) => field.key === "server-checkout-and-price-recovery");
  assert.ok(serverCheckout);
  assert.match(serverCheckout.updatePath, /every Stripe Payment Link inactive/i);
  assert.match(serverCheckout.fallback, /before requesting a Checkout Session/i);
  assert.match(serverCheckout.rollback, /Never roll back by reactivating a public Payment Link/i);

  const destinations = record.configurableFields.find((field) => field.key === "checkout-success-and-cancel-destinations");
  assert.ok(destinations);
  assert.match(destinations.updatePath, /server builds the success URL/i);
  assert.match(destinations.updatePath, /Stripe Dashboard does not own either destination/i);
  assert.match(destinations.fallback, /outside checkout\.stripe\.com/i);

  const deletionReconciliation = record.configurableFields.find(
    (field) => field.key === "account-deletion-billing-reconciliation",
  );
  assert.ok(deletionReconciliation);
  assert.match(deletionReconciliation.fallback, /preserve family access/i);
  assert.match(
    deletionReconciliation.rollback,
    /every Stripe Payment Link inactive/i,
  );

  const serialized = JSON.stringify(record);
  assert.doesNotMatch(serialized, /Payment Link completion URL|payment link after-completion URL/i);
});

test("Apple subscription handoff binds the purchase and deletion interlock", () => {
  const record = inputs.handoffs.records.find(
    (candidate) => candidate.id === "apple-subscription-management",
  );
  assert.ok(record);
  assert.deepEqual(
    record.sourcePaths,
    [...providerSourcePathsByHandoffId["apple-subscription-management"]],
  );

  for (const path of [
    "apps/mobile/src/features/billing/constants.ts",
    "apps/web/app/api/billing/apple/purchase-interlock/route.ts",
    "apps/web/lib/account-deletion.ts",
    "apps/web/lib/billing/apple-purchase-interlock.ts",
    "apps/web/lib/billing/entitlements.ts",
    "packages/core/src/billing-catalog.ts",
    "supabase/migrations/20260808184500_apple_purchase_interlock.sql",
  ]) {
    assert.ok(record.sourcePaths.includes(path), `${path} is not bound`);
  }

  const catalog = record.configurableFields.find(
    (field) => field.key === "storekit-product-catalog",
  );
  assert.ok(catalog);
  assert.ok(catalog.sourcePaths.includes("packages/core/src/billing-catalog.ts"));
  assert.match(catalog.cacheBehavior, /durable purchase journal/i);

  const interlock = record.configurableFields.find(
    (field) => field.key === "purchase-and-deletion-interlock",
  );
  assert.ok(interlock);
  assert.ok(
    interlock.sourcePaths.includes(
      "supabase/migrations/20260808184500_apple_purchase_interlock.sql",
    ),
  );
  assert.match(interlock.fallback, /preserves family access/i);

  assert.match(JSON.stringify(record.contracts), /server-minted attempt id/i);
  assert.match(record.environment.notes, /products remain unavailable/i);
  assert.match(record.rollback.restoreAction, /Keep App Store products unavailable/i);
});

test("an aggregate provider record without an exact manifest surface fails closed", () => {
  const invalid = structuredClone(inputs.handoffs) as ProviderHandoffFile;
  invalid.records[0]!.surfaceIds = [];
  assert.ok(validate(invalid).some((issue) => issue.code === "record-surfaces"));
});

test("provider surface coverage fails closed when a current provider surface is omitted", () => {
  const invalid = structuredClone(inputs.handoffs) as ProviderHandoffFile;
  invalid.surfaceCoverage.surfaceIds = invalid.surfaceCoverage.surfaceIds.slice(1);
  invalid.surfaceCoverage.surfaceCount -= 1;
  const codes = validate(invalid).map((issue) => issue.code);
  assert.ok(codes.includes("coverage-count-stale"));
  assert.ok(codes.includes("coverage-ids-stale"));
});

test("provider surfaces cannot be duplicated or assigned across provider records", () => {
  const invalid = structuredClone(inputs.handoffs) as ProviderHandoffFile;
  invalid.records[0]!.surfaceIds = [...invalid.records[1]!.surfaceIds];
  const codes = validate(invalid).map((issue) => issue.code);
  assert.ok(codes.includes("record-surface-duplicate"));
  assert.ok(codes.includes("record-surface-mapping"));
  assert.ok(codes.includes("record-surface-union"));
});

test("a provider handoff cannot claim verified without external evidence", () => {
  const invalid = structuredClone(inputs.handoffs) as ProviderHandoffFile;
  const row = invalid.records[0]!;
  row.status = "verified";
  row.readback.status = "pending";
  const codes = validate(invalid).map((issue) => issue.code);
  assert.ok(codes.includes("verified-without-readback"));
});

test("missing source paths and operational details fail closed", () => {
  const invalid = structuredClone(inputs.handoffs) as ProviderHandoffFile;
  const row = invalid.records[0]!;
  row.sourcePaths = [...row.sourcePaths, "apps/web/does-not-exist.ts"];
  row.configurableFields[0]!.rollback = "";
  const codes = validate(invalid).map((issue) => issue.code);
  assert.ok(codes.includes("source-paths-missing"));
  assert.ok(codes.includes("field-detail"));
});

test("configurable fields cannot escape their record fingerprint", () => {
  const invalid = structuredClone(inputs.handoffs) as ProviderHandoffFile;
  const apple = invalid.records.find(
    (record) => record.id === "apple-subscription-management",
  );
  assert.ok(apple);
  apple.configurableFields[0]!.sourcePaths.push(
    "apps/web/lib/billing/portal.ts",
  );
  assert.ok(
    validate(invalid).some(
      (issue) => issue.code === "field-source-outside-record",
    ),
  );
});

test("provider source scope cannot shrink and certify its own smaller fingerprint", () => {
  const invalid = structuredClone(inputs.handoffs) as ProviderHandoffFile;
  invalid.records[0]!.sourcePaths = invalid.records[0]!.sourcePaths.slice(1);
  assert.ok(validate(invalid).some((issue) => issue.code === "record-source-mapping"));
});

test("source path hash drift invalidates aggregate and record-scoped bindings", () => {
  const invalid = structuredClone(inputs.handoffs) as ProviderHandoffFile;
  invalid.sourceCoverage.bindings[0]!.sha256 = "f".repeat(64);
  invalid.records[0]!.scopedInputFingerprint = "e".repeat(64);
  const codes = validate(invalid).map((issue) => issue.code);
  assert.ok(codes.includes("source-coverage-bindings"));
  assert.ok(codes.includes("record-scoped-input-stale"));
});

test("fabricated provider receipt paths and checksums cannot verify a handoff", () => {
  const invalid = structuredClone(inputs.handoffs) as ProviderHandoffFile;
  const row = invalid.records[0]!;
  row.status = "verified";
  row.readback.status = "pass";
  row.readback.observedAt = "2026-08-04T12:00:00.000Z";
  row.readback.evidencePath = {
    id: "receipt:provider:stripe-readback",
    path: "docs/homa-design/evidence/receipts/fabricated-provider.json",
    sha256: "a".repeat(64),
  };
  row.rollback.rehearsalEvidence = {
    id: "receipt:provider:stripe-rollback",
    path: "docs/homa-design/evidence/receipts/fabricated-rollback.json",
    sha256: "c".repeat(64),
  };
  const entry = artifactCatalogEntry(row.readback.evidencePath, row.id, "provider-readback", row.scopedInputFingerprint);
  entry.reference = {
    ...row.readback.evidencePath,
    path: "docs/homa-design/evidence/receipts/actual-provider.json",
    sha256: "b".repeat(64),
  };
  const codes = validate(invalid, new Map([[entry.reference.id, entry]])).map((issue) => issue.code);
  assert.ok(codes.includes("receipt-path-mismatch"));
  assert.ok(codes.includes("receipt-checksum-mismatch"));
  assert.ok(codes.includes("receipt-unregistered"));
});

test("simulated provider capability cannot be accepted", () => {
  const invalid = structuredClone(inputs.handoffs) as ProviderHandoffFile;
  const row = invalid.records[0]!;
  (row.readback as { externalStateSimulated: boolean }).externalStateSimulated = true;
  assert.ok(validate(invalid).some((issue) => issue.code === "simulated-provider-state"));
});

test("a committed provider envelope without distinct proof cannot verify anything", () => {
  const invalid = structuredClone(inputs.handoffs) as ProviderHandoffFile;
  const row = invalid.records[0]!;
  const reference = {
    id: "receipt:provider:stripe-envelope-only" as const,
    path: "docs/homa-design/evidence/receipts/stripe-envelope-only.json" as const,
    sha256: "a".repeat(64),
  };
  row.readback.evidencePath = reference;
  const entry = artifactCatalogEntry(reference, row.id, "provider-readback", row.scopedInputFingerprint);
  entry.underlyingProof = null;
  assert.ok(validate(invalid, new Map([[reference.id, entry]])).some((issue) => issue.code === "receipt-underlying-proof-missing"));
});

test("a stale provider proof cannot be laundered through a freshly fingerprinted row", () => {
  const invalid = structuredClone(inputs.handoffs) as ProviderHandoffFile;
  const row = invalid.records[0]!;
  const reference = {
    id: "receipt:provider:stripe-stale-input" as const,
    path: "docs/homa-design/evidence/receipts/stripe-stale-input.json" as const,
    sha256: "a".repeat(64),
  };
  row.readback.evidencePath = reference;
  const entry = artifactCatalogEntry(reference, row.id, "provider-readback", "f".repeat(64));
  assert.ok(validate(invalid, new Map([[reference.id, entry]])).some((issue) => issue.code === "receipt-scoped-input-mismatch"));
});

test("provider reconciliation clears readback and rollback proof after any scoped input drift", () => {
  const withClaims = structuredClone(inputs.handoffs) as ProviderHandoffFile;
  const claimed = withClaims.records[0]!;
  const reference = {
    id: "receipt:provider:stripe-old-proof" as const,
    path: "docs/homa-design/evidence/receipts/stripe-old-proof.json" as const,
    sha256: "a".repeat(64),
  };
  claimed.status = "verified";
  claimed.readback.status = "pass";
  claimed.readback.evidencePath = reference;
  claimed.readback.observedAt = "2026-08-04T12:00:00.000Z";
  claimed.rollback.rehearsalEvidence = reference;
  const driftedChecksums = new Map(sourceChecksums);
  driftedChecksums.set(claimed.sourcePaths[0]!, "f".repeat(64));
  const blocked = withClaims.records.find(
    (record) => record.id === "apple-subscription-management",
  );
  assert.ok(blocked);
  blocked.readback.status = "blocked";
  driftedChecksums.set(blocked.sourcePaths[0]!, "d".repeat(64));

  const reconciled = reconcileProviderHandoffBindings(inputs.manifest, withClaims, driftedChecksums);
  const reset = reconciled.records[0]!;
  assert.equal(reset.status, "pending");
  assert.equal(reset.readback.status, "pending");
  assert.equal(reset.readback.evidencePath, null);
  assert.equal(reset.readback.observedAt, null);
  assert.equal(reset.rollback.rehearsalEvidence, null);
  const stillBlocked = reconciled.records.find(
    (record) => record.id === "apple-subscription-management",
  );
  assert.equal(stillBlocked?.status, "blocked");
  assert.equal(stillBlocked?.readback.status, "pending");
});
