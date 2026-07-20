import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import {
  computeGapCoverage,
  parseCosmoCurriculum,
  parseCosmoReference,
  parseCatalogStatuses,
  parseRegistrySlugs,
  summarizeIntake,
  type CosmoCurriculumSummary,
  type CosmoGapCoverage,
  type CosmoIntakeSummary,
  type CosmoReferenceSummary,
} from "../materials/cosmo-funnel";

/**
 * The inspo funnel's disk layer (/admin/studio, founder ask 2026-07-19:
 * see the whole pipeline from Cosmo ingestion to skill update to family
 * output). Cosmo's corpus lives at the repo root in .cosmo/ (reference
 * and curriculum analysis JSONs, the taste model, the inspo catalog);
 * the graduation surface is the skill package plus the activity-format
 * registry. Everything here is read fresh off the filesystem per
 * request, the same posture as readSkillPackage: the files ARE the
 * product state. Ships to the deployed function via the
 * outputFileTracingIncludes entries in next.config.ts; when tracing is
 * missing this returns null and the page shows a labeled setup note
 * instead of crashing.
 */

export interface CosmoFunnelView {
  intake: CosmoIntakeSummary;
  coverage: CosmoGapCoverage;
  /** Format entries in activity-formats.md (the registry the
   * curriculum writer reads). */
  registryCount: number;
  /** Raw taste model markdown (.cosmo/homa-taste.md), for the
   * collapsible reader. Null when the file is missing. */
  tasteModel: string | null;
  /** Raw inspo catalog markdown (.cosmo/inspo-catalog.md). */
  inspoCatalog: string | null;
  catalogStatuses: { status: string; count: number }[];
}

/** cwd is apps/web in the Next runtime and the repo root under
 * scripts; .cosmo sits at the repo root, so accept both. */
function cosmoDir(): string {
  const fromRepoRoot = path.join(process.cwd(), ".cosmo");
  if (existsSync(fromRepoRoot)) return fromRepoRoot;
  return path.join(process.cwd(), "..", "..", ".cosmo");
}

/** Same dual-root rule for the agent directory (activity-formats.md). */
function agentDir(): string {
  const fromAppRoot = path.join(process.cwd(), "agent");
  if (existsSync(fromAppRoot)) return fromAppRoot;
  return path.join(process.cwd(), "apps", "web", "agent");
}

async function readTextOrNull(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, "utf8");
  } catch {
    return null;
  }
}

async function readJsonDocs(dir: string, prefix: string): Promise<unknown[]> {
  let names: string[];
  try {
    names = await readdir(dir);
  } catch {
    return [];
  }
  const docs: unknown[] = [];
  for (const name of names.sort()) {
    if (!name.startsWith(prefix) || !name.endsWith(".json")) continue;
    const raw = await readTextOrNull(path.join(dir, name));
    if (raw === null) continue;
    try {
      docs.push(JSON.parse(raw));
    } catch {
      // A malformed analysis file is Cosmo's bug, not a page outage.
    }
  }
  return docs;
}

export async function readCosmoFunnel(
  sectionHeadings: string[],
  latestLimit = 8,
): Promise<CosmoFunnelView | null> {
  const root = cosmoDir();
  if (!existsSync(root)) return null;

  const referenceDocs = await readJsonDocs(path.join(root, "references"), "ref-");
  const curriculumDocs = await readJsonDocs(path.join(root, "curriculums"), "cur-");
  const references = referenceDocs
    .map(parseCosmoReference)
    .filter((entry): entry is CosmoReferenceSummary => entry !== null);
  const curriculums = curriculumDocs
    .map(parseCosmoCurriculum)
    .filter((entry): entry is CosmoCurriculumSummary => entry !== null);

  const tasteModel = await readTextOrNull(path.join(root, "homa-taste.md"));
  const inspoCatalog = await readTextOrNull(path.join(root, "inspo-catalog.md"));
  const registryRaw = await readTextOrNull(
    path.join(agentDir(), "activity-formats.md"),
  );
  const registrySlugs = registryRaw ? parseRegistrySlugs(registryRaw) : [];

  return {
    intake: summarizeIntake(references, curriculums, latestLimit),
    coverage: computeGapCoverage(references, sectionHeadings, registrySlugs),
    registryCount: registrySlugs.length,
    tasteModel,
    inspoCatalog,
    catalogStatuses: [...(inspoCatalog ? parseCatalogStatuses(inspoCatalog) : new Map())]
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count),
  };
}
