#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const HOMA_VERCEL_PROJECT_ID = "prj_pKBD87W4tmlT7lnYRgrs8WYociTz";
export const HOMA_VERCEL_TEAM_ID = "team_BEuVWnWjCmzv8aVLJp1HU6TC";
export const HOMA_PRODUCTION_ALIAS = "thankshoma.com";

function exactGitSha(value, label) {
  if (typeof value !== "string" || !/^[0-9a-f]{40}$/u.test(value)) {
    throw new Error(`${label} must be an exact lowercase Git SHA.`);
  }
  return value;
}

function exactDeploymentId(value) {
  if (typeof value !== "string" || !/^dpl_[A-Za-z0-9]+$/u.test(value)) {
    throw new Error("Production deployment id is malformed.");
  }
  return value;
}

export function validateIssue606VercelDeployment({
  deployment,
  deploymentId,
  finalSha,
}) {
  const expectedDeploymentId = exactDeploymentId(deploymentId);
  const expectedSha = exactGitSha(finalSha, "Final main SHA");
  if (!deployment || typeof deployment !== "object") {
    throw new Error("Vercel deployment response is not an object.");
  }
  if (deployment.id !== expectedDeploymentId) {
    throw new Error("Vercel returned a different deployment id.");
  }
  const projectId = deployment.project?.id ?? deployment.projectId;
  if (projectId !== HOMA_VERCEL_PROJECT_ID) {
    throw new Error("The deployment is not from Homa's Vercel project.");
  }
  if (deployment.readyState !== "READY") {
    throw new Error("The exact Vercel deployment is not READY.");
  }
  if (deployment.readySubstate !== "PROMOTED") {
    throw new Error("The exact Vercel deployment is not fully promoted.");
  }
  if (deployment.target !== "production" || deployment.aliasAssigned !== true) {
    throw new Error(
      "The exact Vercel deployment is not assigned to production."
    );
  }
  if (
    !Array.isArray(deployment.alias) ||
    !deployment.alias.includes(HOMA_PRODUCTION_ALIAS)
  ) {
    throw new Error("The Homa production alias is not on this deployment.");
  }
  const gitSource = deployment.gitSource;
  if (
    !gitSource ||
    gitSource.type !== "github" ||
    gitSource.sha !== expectedSha ||
    gitSource.ref !== "main" ||
    gitSource.org !== "sidneyswift" ||
    gitSource.repo !== "homa"
  ) {
    throw new Error("The Vercel Git source is not the exact Homa main commit.");
  }
  if (
    typeof deployment.meta?.githubCommitSha === "string" &&
    deployment.meta.githubCommitSha !== expectedSha
  ) {
    throw new Error("Vercel deployment metadata names a different commit.");
  }

  const contract = [
    `deployment_id=${deployment.id}`,
    `project_id=${projectId}`,
    `ready_state=${deployment.readyState}`,
    `ready_substate=${deployment.readySubstate}`,
    `target=${deployment.target}`,
    `production_alias=${HOMA_PRODUCTION_ALIAS}`,
    `git_sha=${gitSource.sha}`,
  ].join("\n");
  return {
    deploymentId: deployment.id,
    contractSha256: createHash("sha256").update(`${contract}\n`).digest("hex"),
  };
}

function argumentsByName(values) {
  const allowed = new Set(["deployment-json", "deployment-id", "final-sha"]);
  const result = new Map();
  for (const value of values) {
    const match = /^--([a-z-]+)=(.*)$/u.exec(value);
    if (!match?.[1] || !allowed.has(match[1]) || result.has(match[1])) {
      throw new Error(`Unknown, duplicate, or malformed argument: ${value}`);
    }
    result.set(match[1], match[2] ?? "");
  }
  return result;
}

function requiredArgument(values, name) {
  const value = values.get(name)?.trim();
  if (!value) throw new Error(`Pass --${name}=<value>.`);
  return value;
}

function main() {
  const args = argumentsByName(process.argv.slice(2));
  const deploymentJsonPath = requiredArgument(args, "deployment-json");
  const deployment = JSON.parse(readFileSync(deploymentJsonPath, "utf8"));
  const result = validateIssue606VercelDeployment({
    deployment,
    deploymentId: requiredArgument(args, "deployment-id"),
    finalSha: requiredArgument(args, "final-sha"),
  });
  console.log(`ISSUE_606_VERCEL_DEPLOYMENT_ID=${result.deploymentId}`);
  console.log(
    `ISSUE_606_VERCEL_DEPLOYMENT_CONTRACT_SHA256=${result.contractSha256}`
  );
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main();
}
