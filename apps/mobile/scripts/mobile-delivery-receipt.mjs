#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

export const MOBILE_DELIVERY_RECEIPT_VERSION = "mobile-delivery-receipt-v1";
const SHA_PATTERN = /^[0-9a-f]{40}$/u;
const RUNTIME_FINGERPRINT_PATTERN = /^[0-9a-f]{40}$/u;
const FINGERPRINT_PATTERN = /^[0-9a-f]{64}$/u;
const RECEIPT_SCHEMA_PATH = fileURLToPath(new URL("../release/delivery-receipt.schema.json", import.meta.url));
let cachedReceiptValidator;

function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function nonEmpty(value) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function requiredText(value, name) {
  const text = nonEmpty(value);
  if (!text) throw new Error(`${name} must be a non-empty string`);
  return text;
}

function nullableText(value, name) {
  if (value === null || value === undefined) return null;
  return requiredText(value, name);
}

function identifier(value, name) {
  if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) return String(value);
  return requiredText(value, name);
}

function isoTimestamp(value, name) {
  const raw = requiredText(value, name);
  const timestamp = Date.parse(raw);
  if (!Number.isFinite(timestamp)) throw new Error(`${name} must be a valid timestamp`);
  return new Date(timestamp).toISOString();
}

function httpUrl(value, name, { nullable = false } = {}) {
  if (nullable && (value === null || value === undefined)) return null;
  const raw = requiredText(value, name);
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`${name} must be a valid HTTP URL`);
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error(`${name} must be a valid HTTP URL`);
  }
  return parsed.toString();
}

function positiveInteger(value, name) {
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(`${name} must be a positive integer`);
  return value;
}

function textList(value, name) {
  if (!Array.isArray(value)) throw new Error(`${name} must be an array`);
  return value.map((item, index) => requiredText(item, `${name}[${index}]`));
}

function requiredRecord(value, name) {
  const record = asRecord(value);
  if (!record) throw new Error(`${name} must be an object`);
  return record;
}

function readJson(path, name) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(`${name} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function exactEnum(value, name, expected) {
  const normalized = requiredText(value, name).toLowerCase().replaceAll("_", "-");
  if (normalized !== expected) throw new Error(`${name} must be ${expected}`);
  return normalized;
}

function receiptBody(receipt) {
  const { receiptFingerprint: _receiptFingerprint, ...body } = receipt;
  return body;
}

function receiptValidator(schema = null) {
  if (!schema && cachedReceiptValidator) return cachedReceiptValidator;
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  const validator = ajv.compile(schema ?? readJson(RECEIPT_SCHEMA_PATH, "delivery receipt schema"));
  if (!schema) cachedReceiptValidator = validator;
  return validator;
}

export function validateMobileDeliveryReceipt(receiptValue, schema = null) {
  const receipt = requiredRecord(receiptValue, "delivery receipt");
  const validate = receiptValidator(schema);
  if (!validate(receipt)) {
    const detail = validate.errors?.map((error) => `${error.instancePath || "/"} ${error.message}`).join("; ") ?? "unknown schema error";
    throw new Error(`delivery receipt does not satisfy its Draft 2020-12 schema: ${detail}`);
  }
  const expectedFingerprint = sha256(JSON.stringify(receiptBody(receipt)));
  if (receipt.receiptFingerprint !== expectedFingerprint) {
    throw new Error("delivery receipt fingerprint does not match its normalized body");
  }
  return receipt;
}

function updateCandidates(value) {
  if (Array.isArray(value)) return value;
  const envelope = asRecord(value);
  if (!envelope) throw new Error("EAS update response must be an object or array");
  if (Array.isArray(envelope.updates)) return envelope.updates;
  if (Array.isArray(envelope.updateGroups)) return envelope.updateGroups.flatMap((group) => (
    Array.isArray(group) ? group : asRecord(group)?.updates ?? []
  ));
  if (envelope.id) return [envelope];
  throw new Error("EAS update response contains no updates");
}

export function normalizeEasUpdate(value) {
  const candidates = updateCandidates(value)
    .map(asRecord)
    .filter(Boolean)
    .map((update) => {
      const runtime = asRecord(update.runtime);
      const branch = asRecord(update.branch);
      return {
        id: nonEmpty(update.id),
        groupId: nonEmpty(update.group) ?? nonEmpty(update.groupId) ?? nonEmpty(update.updateGroupId),
        runtimeVersion: nonEmpty(update.runtimeVersion)?.toLowerCase() ?? nonEmpty(runtime?.version)?.toLowerCase() ?? null,
        platform: nonEmpty(update.platform)?.toLowerCase() ?? null,
        gitCommitHash: nonEmpty(update.gitCommitHash)?.toLowerCase() ?? null,
        createdAt: nonEmpty(update.createdAt),
        branch: nonEmpty(branch?.name) ?? nonEmpty(update.branch),
        message: nonEmpty(update.message),
        manifestPermalink: nonEmpty(update.manifestPermalink),
      };
    })
    .filter((update) => update.platform === "ios");
  if (candidates.length !== 1) {
    throw new Error(`EAS update response must contain exactly one iOS update, found ${candidates.length}`);
  }
  const update = candidates[0];
  if (!update.id || !update.groupId || !update.runtimeVersion || !update.gitCommitHash || !update.createdAt) {
    throw new Error("EAS iOS update is missing id, group, runtime version, creation time, or Git commit provenance");
  }
  if (!SHA_PATTERN.test(update.gitCommitHash)) throw new Error("EAS update Git commit must be a full lowercase SHA");
  if (!RUNTIME_FINGERPRINT_PATTERN.test(update.runtimeVersion)) {
    throw new Error("EAS update runtime version must be a full lowercase Expo fingerprint");
  }
  return {
    ...update,
    createdAt: isoTimestamp(update.createdAt, "EAS update createdAt"),
    branch: nullableText(update.branch, "EAS update branch"),
    message: nullableText(update.message, "EAS update message"),
    manifestPermalink: httpUrl(update.manifestPermalink, "EAS update manifest permalink", { nullable: true }),
  };
}

export function buildMobileDeliveryReceipt({
  classification: classificationValue,
  gates: gatesValue,
  bundleReport: bundleValue,
  easUpdate: easUpdateValue,
  workflow: workflowValue,
  channel = "production",
}) {
  const classification = requiredRecord(classificationValue, "classification");
  const gates = requiredRecord(gatesValue, "production gates");
  const bundle = requiredRecord(bundleValue, "bundle report");
  const workflow = requiredRecord(workflowValue, "workflow");
  const sourceSha = nonEmpty(classification.sourceSha)?.toLowerCase() ?? "";
  if (!SHA_PATTERN.test(sourceSha)) throw new Error("classification sourceSha is invalid");
  if (classification.compatibilityClass !== "ota-safe" || classification.requiredRail !== "eas-update") {
    throw new Error("delivery receipt can only be built for an OTA-safe EAS update classification");
  }
  const runtimeFingerprint = requiredText(classification.fingerprint, "classification fingerprint");
  if (!RUNTIME_FINGERPRINT_PATTERN.test(runtimeFingerprint)) {
    throw new Error("classification fingerprint must be a full lowercase Expo fingerprint");
  }
  const changeCategories = textList(classification.changeCategories, "classification changeCategories");
  const matchingBuild = requiredRecord(classification.matchingBuild, "matching production build");
  const matchingBuildFingerprint = requiredText(matchingBuild.fingerprint, "matching production build fingerprint");
  if (matchingBuildFingerprint !== runtimeFingerprint) {
    throw new Error("matching production build fingerprint differs from the classification");
  }
  const matchingBuildCommit = requiredText(matchingBuild.gitCommitHash, "matching production build Git commit").toLowerCase();
  if (!SHA_PATTERN.test(matchingBuildCommit)) {
    throw new Error("matching production build Git commit must be a full lowercase SHA");
  }
  const matchingBuildEligibility = {
    platform: exactEnum(matchingBuild.platform, "matching production build platform", "ios"),
    status: exactEnum(matchingBuild.status, "matching production build status", "finished"),
    distribution: exactEnum(matchingBuild.distribution, "matching production build distribution", "store"),
    buildProfile: exactEnum(matchingBuild.buildProfile, "matching production build profile", "production"),
    channel: exactEnum(matchingBuild.channel, "matching production build channel", "production"),
  };
  if (gates.status !== "pass" || gates.sourceSha !== sourceSha) {
    throw new Error("production gates did not pass for the classified source SHA");
  }
  const buildAndCheck = requiredRecord(gates.buildAndCheck, "build-and-check gate");
  const vercel = requiredRecord(gates.vercel, "Vercel gate");
  if (buildAndCheck.status !== "completed" || buildAndCheck.conclusion !== "success") {
    throw new Error("build-and-check gate is not a completed success");
  }
  if (vercel.state !== "success") throw new Error("Vercel gate is not successful");
  if (bundle.status !== "pass" || bundle.platform !== "ios" || bundle.sourceSha !== sourceSha) {
    throw new Error("verified iOS bundle does not belong to the classified source SHA");
  }
  if (!FINGERPRINT_PATTERN.test(bundle.bundleFingerprint)) {
    throw new Error("verified bundle fingerprint is invalid");
  }

  const update = normalizeEasUpdate(easUpdateValue);
  if (update.gitCommitHash !== sourceSha) throw new Error("EAS update Git commit differs from the classified source SHA");
  if (update.runtimeVersion !== runtimeFingerprint) {
    throw new Error("EAS update runtime version differs from the matched production fingerprint");
  }
  const repository = requiredText(workflow.repository, "workflow repository");
  if (!/^[^/\s]+\/[^/\s]+$/u.test(repository)) throw new Error("workflow repository must use owner/name format");
  const runId = identifier(workflow.runId, "workflow run id");
  if (!/^\d+$/u.test(runId)) throw new Error("workflow run id must be numeric");
  const runUrl = httpUrl(workflow.runUrl, "workflow run URL");
  if (channel !== "production") throw new Error("mobile delivery receipt must target the production channel");

  const normalizedBundle = {
    fingerprint: bundle.bundleFingerprint,
    fileCount: positiveInteger(bundle.fileCount, "bundle fileCount"),
    bundleCount: positiveInteger(bundle.bundleCount, "bundle bundleCount"),
    sourceMapCount: positiveInteger(bundle.sourceMapCount, "bundle sourceMapCount"),
    sourceFileCount: positiveInteger(bundle.sourceFileCount, "bundle sourceFileCount"),
    totalBytes: positiveInteger(bundle.totalBytes, "bundle totalBytes"),
  };
  if (normalizedBundle.sourceMapCount < normalizedBundle.bundleCount) {
    throw new Error("bundle sourceMapCount cannot be lower than bundleCount");
  }

  const body = {
    schemaVersion: 1,
    receiptVersion: MOBILE_DELIVERY_RECEIPT_VERSION,
    status: "published",
    source: { repository, sha: sourceSha },
    classification: {
      compatibilityClass: classification.compatibilityClass,
      requiredRail: classification.requiredRail,
      fingerprint: runtimeFingerprint,
      changeCategories,
    },
    matchingBuild: {
      id: identifier(matchingBuild.id, "matching production build id"),
      ...matchingBuildEligibility,
      gitCommitHash: matchingBuildCommit,
      fingerprint: matchingBuildFingerprint,
      appVersion: nullableText(matchingBuild.appVersion, "matching production build appVersion"),
      appBuildVersion: nullableText(matchingBuild.appBuildVersion, "matching production build appBuildVersion"),
      createdAt: isoTimestamp(matchingBuild.createdAt, "matching production build createdAt"),
    },
    productionGates: {
      buildAndCheck: {
        id: identifier(buildAndCheck.id, "build-and-check id"),
        detailsUrl: httpUrl(buildAndCheck.detailsUrl, "build-and-check details URL"),
        completedAt: isoTimestamp(buildAndCheck.completedAt, "build-and-check completedAt"),
      },
      vercel: {
        id: identifier(vercel.id, "Vercel status id"),
        targetUrl: httpUrl(vercel.targetUrl, "Vercel target URL"),
        updatedAt: isoTimestamp(vercel.updatedAt, "Vercel updatedAt"),
      },
    },
    bundle: normalizedBundle,
    update: {
      id: update.id,
      groupId: update.groupId,
      runtimeVersion: update.runtimeVersion,
      platform: update.platform,
      channel,
      gitCommitHash: update.gitCommitHash,
      createdAt: update.createdAt,
      branch: update.branch,
      message: update.message,
      manifestPermalink: update.manifestPermalink,
    },
    workflow: { runId, runUrl },
  };
  const receipt = {
    ...body,
    receiptFingerprint: sha256(JSON.stringify(body)),
  };
  return validateMobileDeliveryReceipt(receipt);
}

export function runDeliveryReceiptCli(environment = process.env) {
  const releaseDir = resolve(environment.HOMA_MOBILE_RELEASE_DIR ?? resolve(dirname(fileURLToPath(import.meta.url)), "../../../artifacts/mobile-delivery"));
  const repository = nonEmpty(environment.GITHUB_REPOSITORY);
  const runId = nonEmpty(environment.GITHUB_RUN_ID);
  const serverUrl = nonEmpty(environment.GITHUB_SERVER_URL) ?? "https://github.com";
  if (!repository || !runId) throw new Error("GITHUB_REPOSITORY and GITHUB_RUN_ID are required");
  const receipt = buildMobileDeliveryReceipt({
    classification: readJson(resolve(releaseDir, "classification.json"), "classification"),
    gates: readJson(resolve(releaseDir, "production-gates.json"), "production gates"),
    bundleReport: readJson(resolve(releaseDir, "bundle-report.json"), "bundle report"),
    easUpdate: readJson(resolve(releaseDir, "eas-update.raw.json"), "EAS update output"),
    workflow: {
      repository,
      runId,
      runUrl: `${serverUrl}/${repository}/actions/runs/${runId}`,
    },
  });
  validateMobileDeliveryReceipt(receipt);
  mkdirSync(releaseDir, { recursive: true });
  writeFileSync(resolve(releaseDir, "delivery-receipt.json"), `${JSON.stringify(receipt, null, 2)}\n`);
  return receipt;
}

function main() {
  const receipt = runDeliveryReceiptCli();
  console.log(`Mobile delivery receipt: ${receipt.receiptFingerprint}`);
  console.log(`EAS update group: ${receipt.update.groupId}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(`Mobile delivery receipt: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
