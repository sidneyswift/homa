export interface MaterialRevisionCandidate {
  id: string;
  revisesId: string | null;
  status: "draft" | "final" | "superseded";
  reviewPass: boolean | null;
  order: number;
}

function rootIdFor(
  candidate: MaterialRevisionCandidate,
  byId: ReadonlyMap<string, MaterialRevisionCandidate>,
): string {
  let current = candidate;
  const visited = new Set<string>();
  while (current.revisesId && !visited.has(current.id)) {
    visited.add(current.id);
    const parent = byId.get(current.revisesId);
    if (!parent) return current.revisesId;
    current = parent;
  }
  return current.id;
}

function newest<T extends MaterialRevisionCandidate>(rows: readonly T[]): T {
  const selected = [...rows].sort(
    (left, right) =>
      right.order - left.order || right.id.localeCompare(left.id),
  )[0];
  if (!selected) {
    throw new TypeError("Cannot select a material from an empty revision chain.");
  }
  return selected;
}

/**
 * Returns the one parent-facing material for each connected revision chain.
 * A final always wins. Otherwise, the newest available row that did not fail
 * review wins. Founder-facing reads remain unchanged and keep every attempt.
 */
export function selectParentVisibleMaterialRevisions<
  T extends MaterialRevisionCandidate,
>(candidates: readonly T[]): T[] {
  const byId = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const chains = new Map<string, T[]>();

  for (const candidate of candidates) {
    const rootId = rootIdFor(candidate, byId);
    const chain = chains.get(rootId) ?? [];
    chain.push(candidate);
    chains.set(rootId, chain);
  }

  const selected: T[] = [];
  for (const chain of chains.values()) {
    const finals = chain.filter((candidate) => candidate.status === "final");
    if (finals.length > 0) {
      selected.push(newest(finals));
      continue;
    }

    const available = chain.filter(
      (candidate) =>
        candidate.status !== "superseded" && candidate.reviewPass !== false,
    );
    if (available.length > 0) selected.push(newest(available));
  }

  return selected.sort(
    (left, right) =>
      left.order - right.order || left.id.localeCompare(right.id),
  );
}

/**
 * The chains a parent started and never kept: chain heads whose chain
 * has no final. These are invisible everywhere today, because the binder
 * shows finals only and chat scrollback rotates daily, so a worksheet
 * she liked but never said the magic word about is simply gone.
 *
 * Fleet measurement 2026-07-28 (gh#348): only 41% of revision chains ever
 * reach final, and the rate is the same across families. This is the
 * fleet's largest materials failure, not a power-user problem.
 *
 * Superseded rows and review-failed rows are already excluded upstream by
 * selectParentVisibleMaterialRevisions, which matters for a reason beyond
 * tidiness: finalize deletes the Blob bytes of superseded drafts, so a
 * card for one would render a broken image (gh#350 owns that retention
 * decision).
 */
export function selectInProgressMaterialRevisions<
  T extends MaterialRevisionCandidate,
>(candidates: readonly T[]): T[] {
  return selectParentVisibleMaterialRevisions(candidates).filter(
    (candidate) => candidate.status === "draft",
  );
}
