import { access, mkdir, mkdtemp, rename, rmdir, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { loadEnvFile } from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  acknowledgeFamilyAssetTrainingRemoval,
  buildFamilyAssetTrainingDatasetArtifacts,
  commitFamilyAssetTrainingDataset,
  prepareFamilyAssetTrainingSource,
} from "../lib/library/family-asset-training";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export type FamilyAssetTrainingCliOptions =
  | {
      mode: "export";
      datasetVersion: string;
      outputDirectory: string;
      assetIds: string[];
      excludedAssetIds: string[];
    }
  | {
      mode: "acknowledge-removal";
      datasetVersion: string;
      sourceAssetId: string;
      evidence: string;
    };

function values(argv: readonly string[], flag: string): string[] {
  return argv.flatMap((value, index) =>
    value === flag && typeof argv[index + 1] === "string"
      ? [argv[index + 1] as string]
      : [],
  );
}

function one(argv: readonly string[], flag: string): string | null {
  const found = values(argv, flag);
  if (found.length > 1) throw new Error(`${flag} may be supplied only once.`);
  return found[0] ?? null;
}

function boundedVersion(value: string | null): string {
  const normalized = value?.normalize("NFKC").trim() ?? "";
  if (normalized.length < 1 || normalized.length > 120) {
    throw new Error("--dataset-version must be between 1 and 120 characters.");
  }
  return normalized;
}

function uniqueUuids(found: string[], flag: string): string[] {
  const unique = [...new Set(found.map((value) => value.toLowerCase()))];
  if (unique.some((value) => !UUID.test(value))) {
    throw new Error(`${flag} values must be UUIDs.`);
  }
  return unique.sort();
}

export function parseFamilyAssetTrainingCliOptions(
  argv: readonly string[],
): FamilyAssetTrainingCliOptions {
  const datasetVersion = boundedVersion(one(argv, "--dataset-version"));
  if (argv.includes("--ack-removal")) {
    const sourceAssetId = one(argv, "--asset-id")?.toLowerCase() ?? "";
    const evidence = one(argv, "--evidence")?.normalize("NFKC").trim() ?? "";
    if (!UUID.test(sourceAssetId)) {
      throw new Error("Removal acknowledgment needs one --asset-id UUID.");
    }
    if (evidence.length < 1 || evidence.length > 500) {
      throw new Error("--evidence must be between 1 and 500 characters.");
    }
    return {
      mode: "acknowledge-removal",
      datasetVersion,
      sourceAssetId,
      evidence,
    };
  }

  const outputDirectory = one(argv, "--output")?.trim() ?? "";
  if (!outputDirectory) throw new Error("Export needs --output <new-directory>.");
  const assetIds = uniqueUuids(values(argv, "--asset-id"), "--asset-id");
  const excludedAssetIds = uniqueUuids(
    values(argv, "--exclude-asset-id"),
    "--exclude-asset-id",
  );
  if (assetIds.length + excludedAssetIds.length === 0) {
    throw new Error("Export needs at least one exact asset id.");
  }
  if (assetIds.some((assetId) => excludedAssetIds.includes(assetId))) {
    throw new Error("One asset cannot be both included and operator-excluded.");
  }
  return {
    mode: "export",
    datasetVersion,
    outputDirectory,
    assetIds,
    excludedAssetIds,
  };
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

export interface StagedDatasetDirectory {
  outputDirectory: string;
  temporaryDirectory: string;
}

async function removeStagedDatasetDirectory(
  temporaryDirectory: string,
): Promise<void> {
  await unlink(path.join(temporaryDirectory, "records.jsonl")).catch(
    () => undefined,
  );
  await unlink(path.join(temporaryDirectory, "manifest.json")).catch(
    () => undefined,
  );
  await rmdir(temporaryDirectory).catch(() => undefined);
}

export async function stageDatasetDirectory(input: {
  outputDirectory: string;
  jsonl: string;
  manifestJson: string;
}): Promise<StagedDatasetDirectory> {
  const outputDirectory = path.resolve(input.outputDirectory);
  if (outputDirectory === path.parse(outputDirectory).root) {
    throw new Error("The filesystem root cannot be a dataset output directory.");
  }
  if (await pathExists(outputDirectory)) {
    throw new Error("The dataset output directory already exists.");
  }
  const parent = path.dirname(outputDirectory);
  await mkdir(parent, { recursive: true });
  const temporaryDirectory = await mkdtemp(
    path.join(parent || tmpdir(), ".homa-family-training-"),
  );
  try {
    await writeFile(path.join(temporaryDirectory, "records.jsonl"), input.jsonl, {
      encoding: "utf8",
      flag: "wx",
    });
    await writeFile(
      path.join(temporaryDirectory, "manifest.json"),
      input.manifestJson,
      { encoding: "utf8", flag: "wx" },
    );
    return { outputDirectory, temporaryDirectory };
  } catch (error) {
    await removeStagedDatasetDirectory(temporaryDirectory);
    throw error;
  }
}

export async function publishStagedDatasetDirectory(
  staged: StagedDatasetDirectory,
): Promise<void> {
  await rename(staged.temporaryDirectory, staged.outputDirectory);
}

function loadLocalEnvironment(): void {
  const webRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
  try {
    loadEnvFile(path.join(webRoot, ".env.local"));
  } catch {
    // Fine when credentials arrive through the process environment.
  }
}

export async function runFamilyAssetTrainingCli(
  options: FamilyAssetTrainingCliOptions,
): Promise<void> {
  loadLocalEnvironment();
  if (options.mode === "acknowledge-removal") {
    const result = await acknowledgeFamilyAssetTrainingRemoval({
      datasetVersion: options.datasetVersion,
      sourceAssetId: options.sourceAssetId,
      evidence: options.evidence,
    });
    console.log(
      `removal records ${result.removed} | dataset retired ${result.datasetRetired}`,
    );
    return;
  }

  const sources = [];
  for (const assetId of options.assetIds) {
    sources.push(await prepareFamilyAssetTrainingSource({ assetId }));
  }
  for (const assetId of options.excludedAssetIds) {
    sources.push(
      await prepareFamilyAssetTrainingSource({
        assetId,
        operatorExcluded: true,
      }),
    );
  }
  const artifacts = buildFamilyAssetTrainingDatasetArtifacts({
    datasetVersion: options.datasetVersion,
    sources,
  });
  const outputDirectory = path.resolve(options.outputDirectory);
  const staged = await stageDatasetDirectory({
    outputDirectory,
    jsonl: artifacts.jsonl,
    manifestJson: artifacts.manifestJson,
  });
  try {
    const result = await commitFamilyAssetTrainingDataset({
      datasetVersion: options.datasetVersion,
      sources,
      artifacts,
    });
    await publishStagedDatasetDirectory(staged);
    console.log(
      `dataset ${options.datasetVersion} ${result.status} | records ${result.recordCount} | source decisions ${sources.length}`,
    );
    for (const [reason, count] of Object.entries(
      artifacts.manifest.excludedByReason,
    )) {
      console.log(`excluded ${reason} ${count}`);
    }
  } catch (error) {
    await removeStagedDatasetDirectory(staged.temporaryDirectory);
    throw error;
  }
}

const invokedPath = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : "";
if (invokedPath === import.meta.url) {
  runFamilyAssetTrainingCli(
    parseFamilyAssetTrainingCliOptions(process.argv.slice(2)),
  ).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Training export failed.");
    process.exitCode = 1;
  });
}
