import {
  lstatSync,
  realpathSync,
} from "node:fs";
import {
  extname,
  isAbsolute,
  relative,
  resolve,
  sep,
} from "node:path";
import {
  ScoreValidationError,
  assertNonEmpty,
} from "./score-contract.ts";

const ALLOWED_EVIDENCE_EXTENSIONS = new Set([
  ".md",
  ".json",
  ".txt",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".mp4",
]);
const RESTRICTED_PATH_PARTS = new Set([
  ".git",
  "homa-macmini",
  "homa-research",
  "homa-template",
]);

function assertPathShape(path: string): void {
  if (
    path.length === 0 ||
    isAbsolute(path) ||
    path.includes("\0") ||
    path.split("/").includes("..")
  ) {
    throw new ScoreValidationError(
      "evidence path must be repository-relative and safe",
    );
  }
  const parts = path.split("/");
  if (
    parts.some((part) => RESTRICTED_PATH_PARTS.has(part)) ||
    parts.some(
      (part) =>
        part === ".env" ||
        part.endsWith(".local") ||
        part.endsWith(".key") ||
        part.endsWith(".crt"),
    )
  ) {
    throw new ScoreValidationError("evidence path is restricted");
  }
}

export function assertSafeEvidencePath(
  repositoryRoot: string,
  repositoryRelativePath: string,
): string {
  const extension = extname(repositoryRelativePath).toLowerCase();
  if (!ALLOWED_EVIDENCE_EXTENSIONS.has(extension)) {
    throw new ScoreValidationError(
      `unsupported evidence extension: ${extension}`,
    );
  }
  return assertSafeRepositoryFilePath(
    repositoryRoot,
    repositoryRelativePath,
  );
}

export function assertSafeRepositoryFilePath(
  repositoryRoot: string,
  repositoryRelativePath: string,
): string {
  assertPathShape(repositoryRelativePath);
  const root = realpathSync(repositoryRoot);
  const absolutePath = resolve(root, repositoryRelativePath);
  let currentPath = root;
  for (const pathPart of repositoryRelativePath.split("/")) {
    currentPath = resolve(currentPath, pathPart);
    if (lstatSync(currentPath).isSymbolicLink()) {
      throw new ScoreValidationError(
        "evidence path cannot contain a symlink",
      );
    }
  }
  const resolvedPath = realpathSync(absolutePath);
  const relativePath = relative(root, resolvedPath);
  if (
    relativePath === ".." ||
    relativePath.startsWith(`..${sep}`) ||
    isAbsolute(relativePath)
  ) {
    throw new ScoreValidationError(
      "evidence path resolves outside repository",
    );
  }
  assertPathShape(relativePath);
  return resolvedPath;
}

function slugifyScope(scope: string): string {
  const slug = scope
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  assertNonEmpty(slug, "scope slug");
  return slug;
}

export function formatAuditRunDirectoryName(
  date: Date,
  scope: string,
  runId: string,
): string {
  if (Number.isNaN(date.getTime())) {
    throw new ScoreValidationError("audit date must be valid");
  }
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      runId,
    )
  ) {
    throw new ScoreValidationError("run ID must be a UUID");
  }
  const timestamp = `${date.toISOString().slice(0, 10)}T${date
    .toISOString()
    .slice(11, 19)
    .replaceAll(":", "")}Z`;
  return `${timestamp}-${slugifyScope(scope)}-${runId.toLowerCase()}`;
}
