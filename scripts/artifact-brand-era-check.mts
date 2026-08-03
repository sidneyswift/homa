import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DURABLE_TYPE = "durable-artifact";
const APPROVED_ERA = "quiet-authority-v1";

type ManifestSurface = {
  paths?: unknown;
  type?: unknown;
  ownerIssue?: unknown;
  approvedTarget?: unknown;
  disposition?: unknown;
  deliveryState?: unknown;
  rolloutState?: unknown;
};

type Manifest = { surfaces?: ManifestSurface[] };

const SOURCE_CONTRACTS = [
  {
    path: "apps/web/lib/materials/brand-era.ts",
    snippets: ["DESIGN_CONTRACT_VERSION", "MATERIAL_TARGET_PROFILE = \"artifact-print\""],
  },
  {
    path: "apps/web/lib/materials/page-shell.ts",
    snippets: ["MATERIAL_BRAND_ERA", "MATERIAL_TARGET_PROFILE", "data-brand-profile"],
  },
  {
    path: "apps/web/lib/materials/render-provenance.ts",
    snippets: ["materialArtifactBrand()", "brand: materialArtifactBrand()"],
  },
  {
    path: "apps/web/agent/tools/create_printable.ts",
    snippets: ["render: buildRenderProvenance("],
  },
] as const;

const RENDERED_ARTIFACT_SURFACES = [
  "apps/web/lib/materials/page-shell.ts",
  "apps/web/app/onboarding/r/[token]/one-pager/page.tsx",
  "apps/web/app/onboarding/r/[token]/evidence/page.tsx",
  "apps/web/app/onboarding/r/[token]/report-view.tsx",
] as const;

export type ArtifactBrandEraReport = {
  durableRows: number;
  renderedSources: number;
  findings: string[];
};

export function inspectArtifactBrandEra(root = ROOT): ArtifactBrandEraReport {
  const findings: string[] = [];
  if (!existsSync(resolve(root, "docs/homa-design/evidence/surfaces.json"))) {
    findings.push("missing Quiet surface manifest");
    return { durableRows: 0, renderedSources: 0, findings };
  }

  let manifest: Manifest;
  try {
    manifest = JSON.parse(
      readFileSync(resolve(root, "docs/homa-design/evidence/surfaces.json"), "utf8"),
    ) as Manifest;
  } catch (error) {
    findings.push(`could not parse Quiet surface manifest: ${String(error)}`);
    return { durableRows: 0, renderedSources: 0, findings };
  }

  const durableRows = (manifest.surfaces ?? []).filter(
    (surface) => surface.type === DURABLE_TYPE,
  );
  if (durableRows.length === 0) findings.push("manifest has no durable-artifact rows");

  for (const surface of durableRows) {
    const path = Array.isArray(surface.paths) && typeof surface.paths[0] === "string"
      ? surface.paths[0]
      : "<missing path>";
    if (surface.ownerIssue !== "gh#731" && path !== "durable:vercel-blob-world-media" && path !== "historical:delivered-email-sms-print-mail") {
      findings.push(`${path} is not owned by the durable-artifact migration issue`);
    }
    if (surface.approvedTarget !== APPROVED_ERA) {
      findings.push(`${path} does not declare ${APPROVED_ERA}`);
    }
    if (typeof surface.disposition !== "string" || surface.disposition.length === 0) {
      findings.push(`${path} has no durable migration disposition`);
    }
    if (typeof surface.deliveryState !== "string" || surface.deliveryState.length === 0) {
      findings.push(`${path} has no durable delivery-state classification`);
    }
    if (typeof surface.rolloutState !== "string" || surface.rolloutState.length === 0) {
      findings.push(`${path} has no durable rollout state`);
    }
  }

  for (const contract of SOURCE_CONTRACTS) {
    const sourcePath = resolve(root, contract.path);
    if (!existsSync(sourcePath)) {
      findings.push(`missing artifact brand source: ${contract.path}`);
      continue;
    }
    const source = readFileSync(sourcePath, "utf8");
    for (const snippet of contract.snippets) {
      if (!source.includes(snippet)) {
        findings.push(`${contract.path} is missing ${snippet}`);
      }
    }
  }

  let renderedSources = 0;
  for (const path of RENDERED_ARTIFACT_SURFACES) {
    const sourcePath = resolve(root, path);
    if (!existsSync(sourcePath)) {
      findings.push(`missing rendered artifact surface: ${path}`);
      continue;
    }
    const source = readFileSync(sourcePath, "utf8");
    if (path === "apps/web/lib/materials/page-shell.ts") {
      if (!source.includes("data-brand-era=\"${MATERIAL_BRAND_ERA}\"")) {
        findings.push(`${path} is missing the generated design-era marker`);
      }
    } else if (!source.includes("quiet-print-surface")) {
      findings.push(`${path} is missing the Quiet print-surface marker`);
    }
    renderedSources += 1;
  }

  return { durableRows: durableRows.length, renderedSources, findings };
}

const report = inspectArtifactBrandEra();
if (report.findings.length > 0) {
  for (const finding of report.findings) console.error(`artifact-brand-era: ${finding}`);
  process.exitCode = 1;
} else {
  console.log(
    `artifact-brand-era passed: ${report.durableRows} durable rows classified, ${report.renderedSources} print sources carry Quiet markers; production URL inventory remains a separate rollout gate`,
  );
}
