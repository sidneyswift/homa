import { readFileSync } from "node:fs";
import { test } from "node:test";

const preview = readFileSync(new URL("./artifact-preview.tsx", import.meta.url), "utf8");
const familyMaterials = readFileSync(
  new URL("./families/[familyId]/materials/page.tsx", import.meta.url),
  "utf8",
);
const studioRun = readFileSync(
  new URL("./studio/runs/[runId]/page.tsx", import.meta.url),
  "utf8",
);

test("admin artifact previews use the shared Quiet artifact atom", () => {
  if (!preview.includes('data-brand-layer="admin-artifact-preview"')) {
    throw new Error("admin artifact preview is missing its Quiet layer marker");
  }
  if (!preview.includes("quiet-artifact-card__preview")) {
    throw new Error("admin artifact preview bypasses the shared artifact preview atom");
  }
  if (!preview.includes('target="_blank"')) {
    throw new Error("admin artifact PDF preview no longer opens the durable artifact");
  }
  if (!preview.includes("aria-label={`Open ${alt.replace(/^Preview of /u, \"\").replace(/ preview$/u, \"\")} PDF`}")) {
    throw new Error("admin artifact preview lost its descriptive PDF link label");
  }
});

test("customer artifact mirrors route through the shared preview component", () => {
  for (const [name, source] of [["family materials", familyMaterials], ["studio run", studioRun]] as const) {
    if (!source.includes("<AdminArtifactPreview")) {
      throw new Error(`${name} still renders a one-off artifact preview`);
    }
    if (source.includes("<img")) {
      throw new Error(`${name} contains a direct image preview outside AdminArtifactPreview`);
    }
  }
});
