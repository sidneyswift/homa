import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DESIGN_GENERATED_DIRECTORY,
  createDesignArtifacts,
  findGeneratedProjectionInventoryViolations,
} from "../packages/design/src/generators/design-contract.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CHECK = process.argv.includes("--check");
const outputRootIndex = process.argv.indexOf("--output-root");
if (outputRootIndex >= 0 && !process.argv[outputRootIndex + 1]) throw new Error("--output-root requires a path");
const OUTPUT_ROOT = outputRootIndex >= 0 ? resolve(process.argv[outputRootIndex + 1]!) : ROOT;
const designTemplate = readFileSync(resolve(ROOT, "DESIGN.md"), "utf8");
const generated = createDesignArtifacts(
  designTemplate,
  (value) => createHash("sha256").update(value).digest("hex"),
);

function writeArtifacts(outputRoot: string): void {
  for (const artifact of generated.artifacts) {
    const output = resolve(outputRoot, artifact.relativePath);
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, artifact.content);
  }
}

function generatedProjectionInventory(root: string): string[] {
  const directory = resolve(root, DESIGN_GENERATED_DIRECTORY);
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true })
    .map((entry) => `${DESIGN_GENERATED_DIRECTORY}/${entry.name}`)
    .sort((left, right) => left.localeCompare(right));
}

if (CHECK) {
  const temporaryRoot = mkdtempSync(resolve(tmpdir(), "homa-design-contract-"));
  try {
    writeArtifacts(temporaryRoot);
    const temporaryInventory = generatedProjectionInventory(temporaryRoot);
    const committedInventory = generatedProjectionInventory(ROOT);
    const temporaryViolations = findGeneratedProjectionInventoryViolations(temporaryInventory, generated.artifacts);
    const committedViolations = findGeneratedProjectionInventoryViolations(committedInventory, generated.artifacts);
    if (temporaryViolations.length > 0 || committedViolations.length > 0) {
      throw new Error(`Generated design artifact inventory drift:\n${[...temporaryViolations, ...committedViolations].join("\n")}`);
    }
    for (const artifact of generated.artifacts) {
      const temporaryOutput = resolve(temporaryRoot, artifact.relativePath);
      const committedOutput = resolve(ROOT, artifact.relativePath);
      if (!existsSync(committedOutput) || readFileSync(committedOutput, "utf8") !== readFileSync(temporaryOutput, "utf8")) {
        throw new Error(`Generated design artifact is stale: ${committedOutput}`);
      }
    }
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
} else {
  writeArtifacts(OUTPUT_ROOT);
}

console.log(`${CHECK ? "Checked" : "Wrote"} ${generated.artifacts.length} design artifacts from a clean output root (${generated.sourceChecksum})`);
