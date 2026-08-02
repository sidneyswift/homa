/**
 * Checks runtime markdown prompt packaging for deployed functions.
 *
 * Next can only ship process.cwd()/agent/*.md reads when each prompt file is
 * named in outputFileTracingIncludes. Eve-authored code should avoid those
 * reads entirely and use generated TypeScript mirrors, because Eve's hosted
 * Nitro output does not carry the app source tree.
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const nextConfigPath = "apps/web/next.config.ts";
const sourceDirs = ["apps/web/app", "apps/web/lib"];
const eveAuthoredDirs = ["apps/web/agent"];
const sourceFilePattern = /\.(ts|tsx|mts|cts)$/u;
const testFilePattern = /\.(test|spec)\.(ts|tsx|mts|cts)$/u;
const processCwdAgentMarkdownPattern =
  /path\.join\(\s*process\.cwd\(\)\s*,\s*["']agent["']\s*,\s*["']([^"']+\.md)["']\s*\)/gu;

interface PromptRead {
  relPath: string;
  promptFile: string;
}

function read(relPath: string): string {
  return readFileSync(path.join(repoRoot, relPath), "utf8");
}

function walkFiles(relDir: string): string[] {
  const absDir = path.join(repoRoot, relDir);
  const files: string[] = [];
  for (const entry of readdirSync(absDir, { withFileTypes: true })) {
    const relPath = path.join(relDir, entry.name).replaceAll(path.sep, "/");
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      files.push(...walkFiles(relPath));
      continue;
    }
    if (entry.isFile() && sourceFilePattern.test(entry.name) && !testFilePattern.test(entry.name)) {
      files.push(relPath);
    }
  }
  return files;
}

function findPromptReads(relDirs: string[]): PromptRead[] {
  const reads: PromptRead[] = [];
  for (const relDir of relDirs) {
    for (const relPath of walkFiles(relDir)) {
      const source = read(relPath);
      for (const match of source.matchAll(processCwdAgentMarkdownPattern)) {
        const promptFile = match[1];
        if (promptFile !== undefined) reads.push({ relPath, promptFile });
      }
    }
  }
  return reads;
}

function hasTraceInclude(nextConfig: string, promptFile: string): boolean {
  const tracedPath = `./agent/${promptFile}`;
  return nextConfig.includes(JSON.stringify(tracedPath)) || nextConfig.includes(`'${tracedPath}'`);
}

const failures: string[] = [];
const nextConfig = read(nextConfigPath);

for (const readSite of findPromptReads(sourceDirs)) {
  if (!hasTraceInclude(nextConfig, readSite.promptFile)) {
    failures.push(
      `${readSite.relPath} reads agent/${readSite.promptFile} from process.cwd(), ` +
        `but ${nextConfigPath} does not include ./agent/${readSite.promptFile} in outputFileTracingIncludes.`,
    );
  }
}

for (const readSite of findPromptReads(eveAuthoredDirs)) {
  failures.push(
    `${readSite.relPath} reads agent/${readSite.promptFile} from process.cwd(). ` +
      "Eve-hosted code must use a generated module or another statically bundled source.",
  );
}

if (failures.length > 0) {
  console.error("runtime-prompt-tracing-check: failed");
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log("runtime-prompt-tracing-check: all runtime markdown prompt reads are covered.");
