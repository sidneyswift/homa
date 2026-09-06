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
): string | null {
  let current = candidate;
  const visited = new Set<string>();
  while (current.revisesId) {
    if (visited.has(current.id)) return null;
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

function selectMaterialRevisions<T extends MaterialRevisionCandidate>(
  candidates: readonly T[],
  keptOnly: boolean,
): T[] {
  const byId = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const chains = new Map<string, T[]>();

  for (const candidate of candidates) {
    const rootId = rootIdFor(candidate, byId);
    if (rootId === null) continue;
    const chain = chains.get(rootId) ?? [];
    chain.push(candidate);
    chains.set(rootId, chain);
  }

  const selected: T[] = [];
  for (const chain of chains.values()) {
    const available = chain.filter((candidate) =>
      candidate.status === "final" || (!keptOnly
        && candidate.status === "draft" && candidate.reviewPass !== false),
    );
    if (available.length > 0) selected.push(newest(available));
  }

  return selected.sort(
    (left, right) =>
      left.order - right.order || left.id.localeCompare(right.id),
  );
}

/** The newest available draft or final is current. A failed draft cannot
 * replace a kept final, including a historical final whose review failed.
 * Missing ancestors can occur in bounded histories; cycles have no current node. */
export function selectParentVisibleMaterialRevisions<T extends MaterialRevisionCandidate>(candidates: readonly T[]): T[] {
  return selectMaterialRevisions(candidates, false);
}

/** Binder's kept shelf still shows the newest final, using the whole chain
 * to retain lineage through intervening drafts and superseded revisions. */
export function selectKeptMaterialRevisions<T extends MaterialRevisionCandidate>(candidates: readonly T[]): T[] {
  return selectMaterialRevisions(candidates, true);
}

/** Current reviewable drafts include a new revision of a kept material.
 * The prior final remains on the kept shelf until the parent keeps the revision.
 * Failed and superseded drafts do not become in-progress cards. */
export function selectInProgressMaterialRevisions<
  T extends MaterialRevisionCandidate,
>(candidates: readonly T[]): T[] {
  return selectParentVisibleMaterialRevisions(candidates).filter(
    (candidate) => candidate.status === "draft",
  );
}
