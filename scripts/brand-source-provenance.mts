export interface BrandCommittedSource {
  sha: string;
  committedAt: string;
}

export type GitTextCommand = (...args: string[]) => string;

export function resolveBrandSourceRef(git: GitTextCommand, ref = "HEAD"): string {
  const [commit, ...parents] = git("rev-list", "--parents", "-n", "1", ref)
    .split(/\s+/)
    .filter(Boolean);
  if (!commit || parents.length !== 2) return ref;

  const contentParent = parents[1]!;
  const checkoutTree = git("rev-parse", `${commit}^{tree}`);
  const contentParentTree = git("rev-parse", `${contentParent}^{tree}`);
  return checkoutTree === contentParentTree ? contentParent : ref;
}

export function collectLatestCommittedSources(
  git: GitTextCommand,
  ref = resolveBrandSourceRef(git),
): Map<string, BrandCommittedSource> {
  const latest = new Map<string, BrandCommittedSource>();
  let commitSource: BrandCommittedSource | null = null;

  for (const line of git(
    "log",
    "--first-parent",
    "--format=@@source:%H%x09%cI",
    "--name-only",
    "--no-renames",
    ref,
  ).split("\n")) {
    if (line.startsWith("@@source:")) {
      const [sha, committedAt] = line.slice("@@source:".length).split("\t");
      commitSource = sha && committedAt ? { sha, committedAt } : null;
    } else if (line && commitSource && !latest.has(line)) {
      latest.set(line, commitSource);
    }
  }

  return latest;
}
