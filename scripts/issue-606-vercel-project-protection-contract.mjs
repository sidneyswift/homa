#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const HOMA_VERCEL_PROJECT_ID = "prj_pKBD87W4tmlT7lnYRgrs8WYociTz";
export const REQUIRED_DEPLOYMENT_PROTECTION = "all_except_custom_domains";

export function validateIssue606VercelProjectProtection(project) {
  if (!project || typeof project !== "object") {
    throw new Error("Vercel project response is not an object.");
  }
  if (project.id !== HOMA_VERCEL_PROJECT_ID) {
    throw new Error("Vercel returned a different project.");
  }
  const deploymentProtection = project.ssoProtection?.deploymentType;
  if (deploymentProtection !== REQUIRED_DEPLOYMENT_PROTECTION) {
    throw new Error(
      "Homa generated deployment URLs are not protected by project SSO.",
    );
  }

  const contract = [
    `project_id=${project.id}`,
    `sso_deployment_type=${deploymentProtection}`,
  ].join("\n");
  return {
    contractSha256: createHash("sha256").update(`${contract}\n`).digest("hex"),
  };
}

function argumentsByName(values) {
  const result = new Map();
  for (const value of values) {
    const match = /^--project-json=(.*)$/u.exec(value);
    if (!match || result.has("project-json")) {
      throw new Error(`Unknown, duplicate, or malformed argument: ${value}`);
    }
    result.set("project-json", match[1] ?? "");
  }
  return result;
}

function main() {
  const args = argumentsByName(process.argv.slice(2));
  const projectJsonPath = args.get("project-json")?.trim();
  if (!projectJsonPath) throw new Error("Pass --project-json=<value>.");
  const project = JSON.parse(readFileSync(projectJsonPath, "utf8"));
  const result = validateIssue606VercelProjectProtection(project);
  console.log(
    `ISSUE_606_VERCEL_PROJECT_PROTECTION_CONTRACT_SHA256=${result.contractSha256}`,
  );
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main();
}
