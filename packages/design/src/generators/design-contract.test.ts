import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { DESIGN_CONTRACT_VERSION } from "../contract/version.ts";
import {
  createDesignArtifacts,
  expectedGeneratedProjectionPaths,
  findGeneratedProjectionInventoryViolations,
} from "./design-contract.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const DESIGN_TEMPLATE = readFileSync(resolve(ROOT, "DESIGN.md"), "utf8");
const sha256 = (value: string): string => createHash("sha256").update(value).digest("hex");

function writeArtifactSet(root: string, artifacts: ReturnType<typeof createDesignArtifacts>["artifacts"]): Map<string, string> {
  const hashes = new Map<string, string>();
  for (const artifact of artifacts) {
    const output = resolve(root, artifact.relativePath);
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, artifact.content);
    hashes.set(artifact.relativePath, sha256(readFileSync(output, "utf8")));
  }
  return hashes;
}

test("design artifacts are byte-stable across independent generation", () => {
  const first = createDesignArtifacts(DESIGN_TEMPLATE, sha256);
  const second = createDesignArtifacts(DESIGN_TEMPLATE, sha256);
  assert.deepEqual(second, first);

  const roots = [
    mkdtempSync(resolve(tmpdir(), "homa-design-first-")),
    mkdtempSync(resolve(tmpdir(), "homa-design-second-")),
  ];
  try {
    assert.deepEqual(writeArtifactSet(roots[0]!, first.artifacts), writeArtifactSet(roots[1]!, second.artifacts));
  } finally {
    for (const root of roots) rmSync(root, { recursive: true, force: true });
  }
});

test("every generated artifact carries the contract version and source checksum", () => {
  const generated = createDesignArtifacts(DESIGN_TEMPLATE, sha256);
  assert.equal(generated.artifacts.length, 6);
  for (const artifact of generated.artifacts) {
    assert.match(artifact.content, new RegExp(DESIGN_CONTRACT_VERSION, "u"), artifact.relativePath);
    assert.match(artifact.content, new RegExp(generated.sourceChecksum, "u"), artifact.relativePath);
  }

  const fonts = generated.artifacts.find(({ relativePath }) => relativePath.endsWith("fonts.json"));
  assert.ok(fonts);
  assert.deepEqual(
    Object.keys(JSON.parse(fonts.content) as Record<string, unknown>).sort(),
    ["fonts", "sourceChecksum", "version"],
  );
});

test("committed projections equal a clean generation", () => {
  const generated = createDesignArtifacts(DESIGN_TEMPLATE, sha256);
  for (const artifact of generated.artifacts) {
    assert.equal(readFileSync(resolve(ROOT, artifact.relativePath), "utf8"), artifact.content, artifact.relativePath);
  }
});

test("generated projection inventory rejects missing and unexpected files", () => {
  const generated = createDesignArtifacts(DESIGN_TEMPLATE, sha256);
  const expected = expectedGeneratedProjectionPaths(generated.artifacts);
  assert.deepEqual(findGeneratedProjectionInventoryViolations(expected, generated.artifacts), []);
  assert.deepEqual(
    findGeneratedProjectionInventoryViolations(
      [...expected.slice(1), "packages/design/generated/unexpected.json"],
      generated.artifacts,
    ),
    [
      `missing:${expected[0]}`,
      "unexpected:packages/design/generated/unexpected.json",
    ],
  );
});

test("DESIGN front matter is fully regenerated instead of trusted as input", () => {
  const generated = createDesignArtifacts(DESIGN_TEMPLATE, sha256);
  const tamperedTemplate = DESIGN_TEMPLATE.replace(/canvas: "#[0-9A-F]{6}"/u, 'canvas: "#000000"');
  const regenerated = createDesignArtifacts(tamperedTemplate, sha256);
  const design = (set: typeof generated) => set.artifacts.find(({ relativePath }) => relativePath === "DESIGN.md")?.content;
  assert.equal(regenerated.sourceChecksum, generated.sourceChecksum);
  assert.equal(design(regenerated), design(generated));
  assert.match(design(regenerated) ?? "", /canvas: "#F7F4EE"/u);
});
