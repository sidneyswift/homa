export interface BrandCommittedSource {
  sha: string;
  committedAt: string;
}

export type GitTextCommand = (...args: string[]) => string;

interface BrandHistoryEntry extends BrandCommittedSource {
  tree: string;
  parents: string[];
  paths: string[];
}

function firstParentHistory(git: GitTextCommand, ref: string): BrandHistoryEntry[] {
  const entries: BrandHistoryEntry[] = [];
  let current: BrandHistoryEntry | null = null;

  for (const line of git(
    "log",
    "--first-parent",
    "--format=@@source:%H%x09%T%x09%P%x09%cI",
    "--name-only",
    "--no-renames",
    ref,
  ).split("\n")) {
    if (line.startsWith("@@source:")) {
      const [sha, tree, parentText, committedAt] = line.slice("@@source:".length).split("\t");
      current = sha && tree && committedAt
        ? { sha, tree, parents: parentText?.split(" ").filter(Boolean) ?? [], committedAt, paths: [] }
        : null;
      if (current) entries.push(current);
    } else if (line && current) {
      current.paths.push(line);
    }
  }

  return entries;
}

function contentLineage(
  git: GitTextCommand,
  ref: string,
  visited = new Set<string>(),
): BrandHistoryEntry[] {
  const entries = firstParentHistory(git, ref);
  const head = entries[0]?.sha;
  if (!head) return [];
  if (visited.has(head)) throw new Error(`Brand provenance history cycle at ${head}`);
  visited.add(head);

  const lineage: BrandHistoryEntry[] = [];
  for (const entry of entries) {
    if (entry.parents.length === 2) {
      const contentParent = entry.parents[1]!;
      const contentParentTree = git("rev-parse", `${contentParent}^{tree}`);
      if (entry.tree === contentParentTree) {
        return [...lineage, ...contentLineage(git, contentParent, visited)];
      }
    }
    lineage.push(entry);
  }
  return lineage;
}

export function collectLatestCommittedSources(
  git: GitTextCommand,
  ref = "HEAD",
): Map<string, BrandCommittedSource> {
  const latest = new Map<string, BrandCommittedSource>();

  for (const entry of contentLineage(git, ref)) {
    for (const path of entry.paths) {
      if (!latest.has(path)) latest.set(path, { sha: entry.sha, committedAt: entry.committedAt });
    }
  }

  return latest;
}
