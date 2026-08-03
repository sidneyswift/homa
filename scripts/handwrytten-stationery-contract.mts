import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { colorTokens } from "../packages/design/src/contract/colors.ts";
import { DESIGN_CONTRACT_VERSION } from "../packages/design/src/contract/version.ts";
import type { BrandSurfaceManifest } from "../packages/design/src/surfaces.ts";

export const HANDWRYTTEN_STATIONERY_SCHEMA_VERSION = 1 as const;
export const HANDWRYTTEN_STATIONERY_HARNESS_VERSION = "handwrytten-stationery-v1" as const;
export const HANDWRYTTEN_STATIONERY_DESIGN_ERA = "quiet-authority-v1" as const;
export const HANDWRYTTEN_STATIONERY_OWNER_ISSUE = "gh#740" as const;
export const HANDWRYTTEN_STATIONERY_PROVIDER = "handwrytten" as const;
export const HANDWRYTTEN_STATIONERY_CONTRACT_VERSION = `@homa/design:${DESIGN_CONTRACT_VERSION}` as const;

export const handwryttenStationeryStatuses = [
  "candidate",
  "ready-for-provider",
  "provider-verified",
  "production-accepted",
  "blocked",
] as const;
export type HandwryttenStationeryStatus = (typeof handwryttenStationeryStatuses)[number];

export const handwryttenEvidenceStatuses = ["pending", "pass", "blocked"] as const;
export type HandwryttenEvidenceStatus = (typeof handwryttenEvidenceStatuses)[number];

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const MANIFEST_PATH = resolve(ROOT, "docs/homa-design/evidence/surfaces.json");
const CONTRACT_PATH = resolve(ROOT, "docs/homa-design/evidence/handwrytten-stationery.json");
const REQUIRED_SOURCE_PATHS = [
  "apps/web/.env.example",
  "apps/web/components/brand/Logo.tsx",
  "apps/web/lib/cards/handwrytten.ts",
  "apps/web/lib/cards/message.ts",
  "apps/web/lib/cards/thank-you.ts",
  "apps/web/scripts/handwrytten-brand-card.mts",
  "apps/web/scripts/handwrytten-smoke.mts",
  "docs/homa-design/evidence/stationery-inputs/quiet-authority-v1.json",
  "docs/homa-planning/plans/2026-07-11-thank-you-cards.md",
  "packages/design/src/contract/brand.ts",
  "packages/design/src/contract/colors.ts",
  "packages/design/src/contract/typography.ts",
  "supabase/migrations/20260711170000_thank_you_cards.sql",
] as const;

export interface HandwryttenStationeryEvidence {
  status: HandwryttenEvidenceStatus;
  evidencePath: string | null;
  observedAt: string | null;
  note: string;
}

export interface HandwryttenStationeryFile {
  schemaVersion: typeof HANDWRYTTEN_STATIONERY_SCHEMA_VERSION;
  designEra: typeof HANDWRYTTEN_STATIONERY_DESIGN_ERA;
  contractVersion: typeof HANDWRYTTEN_STATIONERY_CONTRACT_VERSION;
  harnessVersion: typeof HANDWRYTTEN_STATIONERY_HARNESS_VERSION;
  ownerIssue: typeof HANDWRYTTEN_STATIONERY_OWNER_ISSUE;
  provider: typeof HANDWRYTTEN_STATIONERY_PROVIDER;
  status: HandwryttenStationeryStatus;
  sourcePaths: string[];
  sourceSpec: {
    path: string;
    sha256: string;
  };
  account: {
    accountOwner: string;
    providerAccount: string;
    priorConfiguration: {
      cardId: string;
      handwritingFont: string;
      enablementVariable: string;
      testModeVariable: string;
    };
    replacementConfiguration: {
      cardId: string | null;
      handwritingFont: string;
      templateName: string;
      providerReadback: HandwryttenStationeryEvidence;
    };
  };
  providerConstraints: {
    dimensionId: string;
    dimensionName: string;
    outputDpi: number;
    panelWidthPx: number;
    panelHeightPx: number;
    maxMessageCharacters: number;
    maxWishesCharacters: number;
    requiredEnvironment: string[];
    requiredGenerationOrder: string[];
    requiredVendorChecks: string[];
    allowedHandwritingFonts: string[];
    webFontEmbedding: "forbidden";
  };
  historicalDelivery: {
    deliveryState: "delivered-historical";
    retiredTemplateId: string;
    recallStatus: "cannot-recall";
    stopGenerationTimestamp: string | null;
    note: string;
  };
  stopGeneration: {
    status: "pending" | "complete";
    owner: string;
    retiredTemplateId: string;
    timestamp: string | null;
    prerequisiteEvidence: string[];
    reason: string;
  };
  rollback: {
    owner: string;
    boundary: "provider-version-restore";
    restoreAction: string;
    restoreTarget: string;
    measuredRestoreTimeSeconds: number | null;
    cacheBehavior: string;
    publicAssetMigration: string;
    restoreProof: HandwryttenStationeryEvidence;
  };
  physicalProof: HandwryttenStationeryEvidence;
  contracts: string[];
}

export interface HandwryttenStationeryValidationIssue {
  code: string;
  message: string;
}

export function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function isNonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isIsoDate(value: unknown): value is string {
  return isNonEmpty(value) && !Number.isNaN(Date.parse(value));
}

function add(issues: HandwryttenStationeryValidationIssue[], code: string, message: string): void {
  issues.push({ code, message });
}

function pathExists(path: string): boolean {
  return existsSync(resolve(ROOT, path));
}

function validatePaths(
  issues: HandwryttenStationeryValidationIssue[],
  paths: unknown,
  field: string,
): void {
  if (!Array.isArray(paths) || paths.length === 0) {
    add(issues, `${field}-missing`, `${field} must name at least one repository path.`);
    return;
  }
  for (const path of paths) {
    if (!isNonEmpty(path) || path.includes("..") || path.startsWith("/")) {
      add(issues, `${field}-unsafe`, `Unsafe ${field} path: ${String(path)}.`);
    } else if (!pathExists(path)) {
      add(issues, `${field}-missing`, `Repository path does not exist: ${path}.`);
    }
  }
}

function validateEvidence(
  issues: HandwryttenStationeryValidationIssue[],
  evidence: unknown,
  field: string,
): void {
  if (!evidence || typeof evidence !== "object") {
    add(issues, `${field}-missing`, `${field} must declare provider or physical evidence.`);
    return;
  }
  const row = evidence as Partial<HandwryttenStationeryEvidence>;
  if (!handwryttenEvidenceStatuses.includes(row.status as HandwryttenEvidenceStatus)) add(issues, `${field}-status`, `${field} has an unsupported status.`);
  if (row.status === "pass") {
    if (!isNonEmpty(row.evidencePath) || !isIsoDate(row.observedAt)) add(issues, `${field}-proof`, `${field} cannot pass without a path and observed timestamp.`);
  } else if (row.evidencePath !== null || row.observedAt !== null) {
    add(issues, `${field}-pending-proof`, `${field} must keep path and timestamp empty until proof is accepted.`);
  }
  if (!isNonEmpty(row.note)) add(issues, `${field}-note`, `${field} must explain the current evidence boundary.`);
}

export function validateHandwryttenStationery(input: {
  manifest: BrandSurfaceManifest;
  stationery: unknown;
  sourceSpec: unknown;
}): HandwryttenStationeryValidationIssue[] {
  const issues: HandwryttenStationeryValidationIssue[] = [];
  const { manifest, stationery, sourceSpec } = input;
  if (!stationery || typeof stationery !== "object") return [{ code: "not-object", message: "Handwrytten stationery contract must be an object." }];
  const file = stationery as Partial<HandwryttenStationeryFile>;
  if (file.schemaVersion !== HANDWRYTTEN_STATIONERY_SCHEMA_VERSION) add(issues, "schema-version", "Handwrytten stationery schema is stale.");
  if (file.designEra !== HANDWRYTTEN_STATIONERY_DESIGN_ERA) add(issues, "design-era", "Stationery must be pinned to Quiet authority.");
  if (file.contractVersion !== HANDWRYTTEN_STATIONERY_CONTRACT_VERSION) add(issues, "contract-version", "Stationery design-contract version is stale.");
  if (file.harnessVersion !== HANDWRYTTEN_STATIONERY_HARNESS_VERSION) add(issues, "harness-version", "Stationery harness version is stale.");
  if (file.ownerIssue !== HANDWRYTTEN_STATIONERY_OWNER_ISSUE) add(issues, "owner-issue", "Stationery contract must remain owned by #740.");
  if (file.provider !== HANDWRYTTEN_STATIONERY_PROVIDER) add(issues, "provider", "Stationery contract must remain Handwrytten-specific.");
  if (!handwryttenStationeryStatuses.includes(file.status as HandwryttenStationeryStatus)) add(issues, "status", "Stationery status is unsupported.");

  validatePaths(issues, file.sourcePaths, "source-paths");
  const sourcePaths = new Set(file.sourcePaths ?? []);
  for (const required of REQUIRED_SOURCE_PATHS) if (!sourcePaths.has(required)) add(issues, "source-paths-incomplete", `Required source path is not inventoried: ${required}.`);
  if (!file.sourceSpec || file.sourceSpec.path !== "docs/homa-design/evidence/stationery-inputs/quiet-authority-v1.json") add(issues, "source-spec-path", "Stationery source spec must use the committed Quiet authority input.");
  if (file.sourceSpec?.sha256 !== sha256(JSON.stringify(sourceSpec, null, 2) + "\n")) add(issues, "source-spec-fingerprint", "Stationery source spec fingerprint is stale.");
  if (!sourceSpec || typeof sourceSpec !== "object") {
    add(issues, "source-spec-shape", "Stationery source spec must be a structured object.");
  } else {
    const spec = sourceSpec as {
      dimensions?: { dimensionId?: unknown; outputDpi?: unknown; panelWidthPx?: unknown; panelHeightPx?: unknown };
      front?: { inkToken?: unknown; accentToken?: unknown; logo?: unknown };
      back?: { inkToken?: unknown; accentToken?: unknown; logo?: unknown };
      interior?: { messageMaxCharacters?: unknown; wishesMaxCharacters?: unknown; webFontEmbedding?: unknown };
    };
    const expectedSpecValues: Array<[string, unknown, unknown]> = [
      ["dimension-id", spec.dimensions?.dimensionId, "3"],
      ["output-dpi", spec.dimensions?.outputDpi, 600],
      ["panel-width", spec.dimensions?.panelWidthPx, 3300],
      ["panel-height", spec.dimensions?.panelHeightPx, 2550],
      ["message-limit", spec.interior?.messageMaxCharacters, 500],
      ["wishes-limit", spec.interior?.wishesMaxCharacters, 50],
      ["font-embedding", spec.interior?.webFontEmbedding, "forbidden"],
    ];
    for (const [code, actual, expected] of expectedSpecValues) if (actual !== expected) add(issues, `source-spec-${code}`, `Source spec ${code} must be ${String(expected)}.`);
    for (const [side, values] of [["front", spec.front], ["back", spec.back]] as const) {
      for (const token of [values?.inkToken, values?.accentToken]) if (!isNonEmpty(token) || !(token in colorTokens)) add(issues, `source-spec-${side}-color`, `Source spec ${side} must use declared Quiet authority color tokens.`);
    }
    if (spec.front?.logo !== "none" || spec.back?.logo !== "master-homa-lockup") add(issues, "source-spec-logo", "Source spec must keep the front unmarked and the master Homa lockup on the back.");
  }

  const handwryttenSurface = manifest.surfaces.find((surface) => surface.paths.includes("provider:handwrytten"));
  if (!handwryttenSurface) add(issues, "manifest-surface-missing", "The surface manifest must retain provider:handwrytten.");
  else {
    if (handwryttenSurface.ownerIssue !== HANDWRYTTEN_STATIONERY_OWNER_ISSUE) add(issues, "manifest-owner", "provider:handwrytten must remain owned by #740.");
    if (handwryttenSurface.approvedTarget !== HANDWRYTTEN_STATIONERY_DESIGN_ERA) add(issues, "manifest-target", "provider:handwrytten must target Quiet authority.");
  }

  const account = file.account;
  if (!isNonEmpty(account?.accountOwner) || !isNonEmpty(account?.providerAccount)) add(issues, "account-owner", "The provider account must have a named owner and account context.");
  if (account?.priorConfiguration?.cardId !== "349914") add(issues, "prior-card", "The prior card ID must remain an explicit historical reference.");
  if (!isNonEmpty(account?.priorConfiguration?.handwritingFont) || account?.priorConfiguration?.enablementVariable !== "THANK_YOU_CARDS_ENABLED" || account?.priorConfiguration?.testModeVariable !== "HANDWRYTTEN_TEST_MODE") add(issues, "prior-configuration", "Prior Handwrytten configuration must name the font and safety switches.");
  if (account?.replacementConfiguration?.cardId !== null && !isNonEmpty(account?.replacementConfiguration?.cardId)) add(issues, "replacement-card", "A replacement card ID must be null until the provider creates one.");
  if (account?.replacementConfiguration?.handwritingFont !== "hwDavid") add(issues, "replacement-font", "The provider handwriting treatment must remain the constrained hwDavid profile.");
  validateEvidence(issues, account?.replacementConfiguration?.providerReadback, "provider-readback");

  const constraints = file.providerConstraints;
  const expectedConstraints: Array<[string, unknown, unknown]> = [
    ["dimension-id", constraints?.dimensionId, "3"],
    ["dimension-name", constraints?.dimensionName, "A2 Folded Landscape"],
    ["output-dpi", constraints?.outputDpi, 600],
    ["panel-width", constraints?.panelWidthPx, 3300],
    ["panel-height", constraints?.panelHeightPx, 2550],
    ["message-limit", constraints?.maxMessageCharacters, 500],
    ["wishes-limit", constraints?.maxWishesCharacters, 50],
    ["font-embedding", constraints?.webFontEmbedding, "forbidden"],
  ];
  for (const [code, actual, expected] of expectedConstraints) if (actual !== expected) add(issues, `provider-${code}`, `Provider constraint ${code} must be ${String(expected)}.`);
  for (const env of ["HANDWRYTTEN_API_KEY", "HANDWRYTTEN_CARD_ID", "HANDWRYTTEN_FONT", "HANDWRYTTEN_TEST_MODE", "HANDWRYTTEN_RETURN_ADDRESS_ID"]) if (!constraints?.requiredEnvironment?.includes(env)) add(issues, "provider-environment", `Provider constraint must name ${env}.`);
  if (JSON.stringify(constraints?.allowedHandwritingFonts ?? []) !== JSON.stringify(["hwDavid"])) add(issues, "provider-fonts", "Provider constraint must allow only hwDavid as the named handwriting treatment.");
  if (!Array.isArray(constraints?.requiredGenerationOrder) || constraints.requiredGenerationOrder.length < 4) add(issues, "generation-order", "Provider generation order must include hosting, registration, quality check, and assembly.");
  if (!Array.isArray(constraints?.requiredVendorChecks) || constraints.requiredVendorChecks.length < 2) add(issues, "vendor-checks", "Provider generation must require quality and detail read-back checks.");

  const historical = file.historicalDelivery;
  if (historical?.deliveryState !== "delivered-historical" || historical.retiredTemplateId !== "349914" || historical.recallStatus !== "cannot-recall") add(issues, "historical-delivery", "Already mailed cards must remain explicitly delivered historical copies.");
  if (historical?.stopGenerationTimestamp !== null) add(issues, "historical-stop-time", "The old template stop-generation timestamp stays empty until the replacement is accepted.");

  const stop = file.stopGeneration;
  if (!isNonEmpty(stop?.owner) || stop?.retiredTemplateId !== "349914" || !Array.isArray(stop?.prerequisiteEvidence) || stop.prerequisiteEvidence.length < 2 || !isNonEmpty(stop?.reason)) add(issues, "stop-generation", "Stop-generation metadata must name the owner, retired ID, prerequisites, and reason.");
  if (stop?.status === "complete") {
    if (!isIsoDate(stop.timestamp)) add(issues, "stop-generation-proof", "Completed stop-generation requires a timestamp.");
    if (account?.replacementConfiguration?.providerReadback.status !== "pass" || file.physicalProof?.status !== "pass") add(issues, "stop-generation-before-proof", "Old-template generation cannot stop before provider and physical proof pass.");
  } else if (stop?.timestamp !== null) add(issues, "stop-generation-pending", "Pending stop-generation must not carry a timestamp.");

  const rollback = file.rollback;
  if (!isNonEmpty(rollback?.owner) || rollback?.boundary !== "provider-version-restore" || !isNonEmpty(rollback.restoreAction) || rollback.restoreTarget !== "349914" || !isNonEmpty(rollback.cacheBehavior) || !isNonEmpty(rollback.publicAssetMigration)) add(issues, "rollback", "Rollback metadata must name owner, old target, restore action, cache behavior, and public-asset migration.");
  if (rollback?.measuredRestoreTimeSeconds !== null && (!Number.isFinite(rollback.measuredRestoreTimeSeconds) || rollback.measuredRestoreTimeSeconds < 0)) add(issues, "restore-time", "Measured restore time must be null or a non-negative number.");
  validateEvidence(issues, rollback?.restoreProof, "rollback-proof");
  validateEvidence(issues, file.physicalProof, "physical-proof");
  if (!Array.isArray(file.contracts) || file.contracts.length < 4 || file.contracts.some((contract) => !isNonEmpty(contract))) add(issues, "contracts", "Stationery contract must name preserved outbox, recipient, privacy, and provider safety contracts.");
  if (file.status === "production-accepted" && (stop?.status !== "complete" || account?.replacementConfiguration?.providerReadback.status !== "pass" || file.physicalProof?.status !== "pass")) add(issues, "production-acceptance", "Production acceptance requires completed stop-generation, provider read-back, and physical proof.");
  return issues;
}

export function loadHandwryttenStationeryInputs(): {
  manifest: BrandSurfaceManifest;
  stationery: HandwryttenStationeryFile;
  sourceSpec: Record<string, unknown>;
} {
  return {
    manifest: JSON.parse(readFileSync(MANIFEST_PATH, "utf8")) as BrandSurfaceManifest,
    stationery: JSON.parse(readFileSync(CONTRACT_PATH, "utf8")) as HandwryttenStationeryFile,
    sourceSpec: JSON.parse(readFileSync(resolve(ROOT, "docs/homa-design/evidence/stationery-inputs/quiet-authority-v1.json"), "utf8")) as Record<string, unknown>,
  };
}

export { REQUIRED_SOURCE_PATHS };
