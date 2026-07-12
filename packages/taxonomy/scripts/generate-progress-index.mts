/**
 * Generates the assessment-only metadata consumed by ChildProgress.
 *
 * This is the only progress path allowed to assemble the full taxonomy.
 * Runtime consumers read the checked-in generated index instead.
 *
 * Usage: pnpm taxonomy:progress
 */

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { assembleTaxonomy } from "../src/assemble.js";
import { getTaxonomyDomain } from "../src/domains.js";

const here = dirname(fileURLToPath(import.meta.url));
const outputPath = join(
  here,
  "..",
  "src",
  "progress.generated.ts",
);
const topics = assembleTaxonomy()
  .topics.filter(
    (topic) =>
      getTaxonomyDomain(topic.domain)?.kind === "assessment",
  )
  .map((topic) => ({
    id: topic.id,
    subject: topic.subject,
    domain: topic.domain,
    name: topic.name,
    teachingWindowMonths: topic.teachingWindowMonths,
  }))
  .sort((left, right) =>
    left.id < right.id ? -1 : left.id > right.id ? 1 : 0,
  );
const topicLines = topics.map(
  (topic) => `  ${JSON.stringify(topic)},`,
);
const source = [
  "/**",
  " * GENERATED FILE. Do not edit by hand.",
  " * Run `pnpm taxonomy:progress` after taxonomy source changes.",
  " * Contains assessment-topic metadata used by ChildProgress only.",
  " */",
  "",
  "export const GENERATED_PROGRESS_TAXONOMY_TOPICS = [",
  ...topicLines,
  "] as const;",
  "",
].join("\n");

writeFileSync(outputPath, source);
console.log(
  `progress taxonomy: ${topics.length} assessment topics written`,
);
