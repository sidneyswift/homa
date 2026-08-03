import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

type IconImportPackage = "lucide-react" | "lucide-react-native";
type IconImportKind = "adapter" | "migration-pending";

export type IconImportFinding = {
  path: string;
  package: IconImportPackage;
  line: number;
};

export type IconImportException = {
  path: string;
  package: IconImportPackage;
  kind: IconImportKind;
};

export type IconImportResidueReport = {
  directImports: number;
  adapterImports: number;
  migrationPendingImports: number;
  findings: IconImportFinding[];
};

type ExceptionManifest = {
  schemaVersion: number;
  ownerIssue: string;
  policy: string;
  entries: IconImportException[];
};

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const EXCEPTIONS_PATH = resolve(ROOT, "scripts/icon-import-exceptions.json");
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx"]);
const DIRECT_IMPORT = /^\s*import\b[\s\S]*?\bfrom\s+["'](lucide-react(?:-native)?)["']/gm;
const ADAPTER_PATHS = new Set([
  "apps/web/components/design/Icon.tsx",
  "apps/web/components/design/icon-registry.ts",
  "apps/mobile/src/components/design/icon.tsx",
]);

function lineAt(text: string, offset: number): number {
  let line = 1;
  for (let index = 0; index < offset; index += 1) if (text[index] === "\n") line += 1;
  return line;
}

function isSourcePath(path: string): boolean {
  if (!(path.startsWith("apps/web/") || path.startsWith("apps/mobile/"))) return false;
  if (path.includes("/node_modules/")) return false;
  if (/\.(?:test|spec)\.(?:ts|tsx)$/.test(path)) return false;
  const dot = path.lastIndexOf(".");
  return dot >= 0 && SOURCE_EXTENSIONS.has(path.slice(dot).toLowerCase());
}

function trackedFiles(): string[] {
  return execFileSync("git", ["ls-files", "-z"], { cwd: ROOT, encoding: "utf8" }).split("\0").filter(Boolean);
}

export function collectDirectIconImportsFromText(path: string, text: string): IconImportFinding[] {
  const findings: IconImportFinding[] = [];
  DIRECT_IMPORT.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = DIRECT_IMPORT.exec(text)) !== null) {
    const importedPackage = match[1] as IconImportPackage;
    findings.push({ path, package: importedPackage, line: lineAt(text, match.index) });
    if (DIRECT_IMPORT.lastIndex === match.index) DIRECT_IMPORT.lastIndex += 1;
  }
  return findings;
}

export function collectDirectIconImports(paths: readonly string[] = trackedFiles()): IconImportFinding[] {
  return paths.flatMap((path) => {
    if (!isSourcePath(path)) return [];
    return collectDirectIconImportsFromText(path, readFileSync(resolve(ROOT, path), "utf8"));
  });
}

export function validateIconImportExceptions(
  findings: readonly IconImportFinding[],
  exceptions: readonly IconImportException[],
): IconImportResidueReport {
  const findingKeys = new Set(findings.map((finding) => `${finding.path}\0${finding.package}`));
  const exceptionKeys = new Set<string>();
  const errors: string[] = [];

  for (const exception of exceptions) {
    const key = `${exception.path}\0${exception.package}`;
    if (exceptionKeys.has(key)) errors.push(`duplicate exception: ${exception.path} (${exception.package})`);
    exceptionKeys.add(key);
    if (!ADAPTER_PATHS.has(exception.path) && exception.kind === "adapter") errors.push(`only adapter paths may use adapter kind: ${exception.path}`);
    if (ADAPTER_PATHS.has(exception.path) && exception.kind !== "adapter") errors.push(`adapter path must use adapter kind: ${exception.path}`);
    if (!findingKeys.has(key)) errors.push(`stale exception has no direct import: ${exception.path} (${exception.package})`);
  }

  for (const finding of findings) {
    const key = `${finding.path}\0${finding.package}`;
    if (!exceptionKeys.has(key)) errors.push(`unlisted direct icon import: ${finding.path}:${finding.line} (${finding.package})`);
  }

  const adapterImports = exceptions.filter((exception) => exception.kind === "adapter").length;
  const migrationPendingImports = exceptions.filter((exception) => exception.kind === "migration-pending").length;
  if (adapterImports !== ADAPTER_PATHS.size) errors.push(`expected ${ADAPTER_PATHS.size} adapter paths, found ${adapterImports}`);
  if (errors.length > 0) throw new Error(errors.join("\n"));
  return {
    directImports: findingKeys.size,
    adapterImports,
    migrationPendingImports,
    findings: [...findings],
  };
}

export function readIconImportExceptions(): IconImportException[] {
  if (!existsSync(EXCEPTIONS_PATH)) throw new Error(`Missing icon import exception manifest: ${EXCEPTIONS_PATH}`);
  const manifest = JSON.parse(readFileSync(EXCEPTIONS_PATH, "utf8")) as ExceptionManifest;
  if (manifest.schemaVersion !== 1 || manifest.ownerIssue !== "gh#718" || manifest.policy !== "new-direct-imports-fail") {
    throw new Error("Icon import exception manifest has an invalid schema, owner, or policy");
  }
  return manifest.entries;
}

export function runIconImportResidueCheck(): IconImportResidueReport {
  const report = validateIconImportExceptions(collectDirectIconImports(), readIconImportExceptions());
  console.log(`Icon direct-import residue check passed: ${report.directImports} direct imports, ${report.adapterImports} adapter paths, ${report.migrationPendingImports} migration exceptions.`);
  return report;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) runIconImportResidueCheck();
