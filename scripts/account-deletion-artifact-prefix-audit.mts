#!/usr/bin/env tsx

import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { list } from "@vercel/blob";

import { mapDb } from "../apps/web/lib/map/db";

const FAMILY_ARTIFACT_PATH =
  /^families\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\//iu;

export function artifactFamilyIdFromPathname(pathname: string): string | null {
  return FAMILY_ARTIFACT_PATH.exec(pathname)?.[1]?.toLowerCase() ?? null;
}

export function blobStoreIdFromReadWriteToken(token: string): string | null {
  const parts = token.trim().split("_");
  if (
    parts.length < 5
    || parts[0] !== "vercel"
    || parts[1] !== "blob"
    || parts[2] !== "rw"
    || !parts[3]
    || !parts[4]
  ) {
    return null;
  }
  return parts[3];
}

export interface ArtifactBlobListing {
  pathname: string;
  url: string;
}

export interface ArtifactStoreInventory {
  storeId: string;
  blobs: readonly ArtifactBlobListing[];
}

export interface ArtifactPrefixAlias {
  artifactFamilyId: string;
  ownerFamilyId: string;
}

export interface ArtifactPrefixCandidate extends ArtifactPrefixAlias {
  evidenceKind: string;
  evidenceCount: number;
}

export interface ArtifactPrefixAuditInput {
  publicStore: ArtifactStoreInventory;
  privateStore: ArtifactStoreInventory;
  liveFamilyIds: readonly string[];
  aliases: readonly ArtifactPrefixAlias[];
  candidates: readonly ArtifactPrefixCandidate[];
  tombstoneFamilyIds: readonly string[];
}

export interface ArtifactPrefixAuditReport {
  publicPrefixCount: number;
  privatePrefixCount: number;
  totalPrefixCount: number;
  livePrefixCount: number;
  inheritedPrefixCount: number;
  tombstonedPrefixCount: number;
  unresolvedPrefixIds: string[];
  unresolvedCandidateIds: string[];
  invalidPublicPathCount: number;
  invalidPrivatePathCount: number;
  invalidPublicUrlCount: number;
  invalidPrivateUrlCount: number;
  storeIntegrityErrors: string[];
  ledgerIntegrityErrors: string[];
  candidateIntegrityErrors: string[];
}

function prefixesForStore(
  inventory: ArtifactStoreInventory,
  access: "public" | "private",
): {
  prefixIds: Set<string>;
  invalidPathCount: number;
  invalidUrlCount: number;
} {
  const prefixIds = new Set<string>();
  let invalidPathCount = 0;
  let invalidUrlCount = 0;
  const expectedHost = `${inventory.storeId}.${access}.blob.vercel-storage.com`;
  for (const blob of inventory.blobs) {
    const familyId = artifactFamilyIdFromPathname(blob.pathname);
    if (familyId) prefixIds.add(familyId);
    else invalidPathCount += 1;
    try {
      const url = new URL(blob.url);
      const urlPathname = decodeURIComponent(url.pathname.slice(1));
      if (
        url.protocol !== "https:"
        || url.hostname !== expectedHost
        || url.port !== ""
        || url.username !== ""
        || url.password !== ""
        || urlPathname !== blob.pathname
      ) {
        invalidUrlCount += 1;
      }
    } catch {
      invalidUrlCount += 1;
    }
  }
  return { prefixIds, invalidPathCount, invalidUrlCount };
}

export function auditArtifactFamilyPrefixes(
  input: ArtifactPrefixAuditInput,
): ArtifactPrefixAuditReport {
  const publicPrefixes = prefixesForStore(input.publicStore, "public");
  const privatePrefixes = prefixesForStore(input.privateStore, "private");
  const allPrefixes = new Set([
    ...publicPrefixes.prefixIds,
    ...privatePrefixes.prefixIds,
  ]);
  const liveFamilyIds = new Set(input.liveFamilyIds.map((id) => id.toLowerCase()));
  const tombstones = new Set(
    input.tombstoneFamilyIds.map((id) => id.toLowerCase()),
  );
  const aliases = new Map<string, string>();
  const storeIntegrityErrors: string[] = [];
  const ledgerIntegrityErrors: string[] = [];
  const candidateIntegrityErrors: string[] = [];
  if (input.publicStore.storeId === input.privateStore.storeId) {
    storeIntegrityErrors.push(
      "Public and private Blob credentials resolve to the same store.",
    );
  }
  for (const familyId of liveFamilyIds) {
    if (tombstones.has(familyId)) {
      ledgerIntegrityErrors.push(
        `Family prefix ${familyId} is both live and tombstoned.`,
      );
    }
  }
  for (const alias of input.aliases) {
    const artifactFamilyId = alias.artifactFamilyId.toLowerCase();
    const ownerFamilyId = alias.ownerFamilyId.toLowerCase();
    const priorOwner = aliases.get(artifactFamilyId);
    if (priorOwner && priorOwner !== ownerFamilyId) {
      ledgerIntegrityErrors.push(
        `Artifact prefix ${artifactFamilyId} has more than one owner.`,
      );
    }
    aliases.set(artifactFamilyId, ownerFamilyId);
    if (!liveFamilyIds.has(ownerFamilyId)) {
      ledgerIntegrityErrors.push(
        `Artifact prefix ${artifactFamilyId} has no live owner.`,
      );
    }
    if (liveFamilyIds.has(artifactFamilyId)) {
      ledgerIntegrityErrors.push(
        `Artifact prefix ${artifactFamilyId} is both live and inherited.`,
      );
    }
    if (tombstones.has(artifactFamilyId)) {
      ledgerIntegrityErrors.push(
        `Artifact prefix ${artifactFamilyId} is both inherited and tombstoned.`,
      );
    }
  }

  const candidateOwners = new Map<string, Set<string>>();
  const unresolvedCandidateIds = new Set<string>();
  for (const candidate of input.candidates) {
    const artifactFamilyId = candidate.artifactFamilyId.toLowerCase();
    const ownerFamilyId = candidate.ownerFamilyId.toLowerCase();
    const owners = candidateOwners.get(artifactFamilyId) ?? new Set<string>();
    owners.add(ownerFamilyId);
    candidateOwners.set(artifactFamilyId, owners);
    if (!liveFamilyIds.has(ownerFamilyId)) {
      candidateIntegrityErrors.push(
        `Candidate prefix ${artifactFamilyId} has no live proposed owner.`,
      );
    }
    if (liveFamilyIds.has(artifactFamilyId)) {
      candidateIntegrityErrors.push(
        `Candidate prefix ${artifactFamilyId} belongs to a live family.`,
      );
    }
    if (tombstones.has(artifactFamilyId)) {
      candidateIntegrityErrors.push(
        `Candidate prefix ${artifactFamilyId} is already tombstoned.`,
      );
    }
    const recordedOwner = aliases.get(artifactFamilyId);
    if (recordedOwner && recordedOwner !== ownerFamilyId) {
      candidateIntegrityErrors.push(
        `Candidate prefix ${artifactFamilyId} conflicts with its recorded owner.`,
      );
    }
    if (recordedOwner !== ownerFamilyId) {
      unresolvedCandidateIds.add(artifactFamilyId);
    }
  }
  for (const [artifactFamilyId, owners] of candidateOwners) {
    if (owners.size > 1) {
      candidateIntegrityErrors.push(
        `Candidate prefix ${artifactFamilyId} has more than one proposed owner.`,
      );
    }
  }

  let livePrefixCount = 0;
  let inheritedPrefixCount = 0;
  let tombstonedPrefixCount = 0;
  const unresolvedPrefixIds: string[] = [];
  for (const prefixId of [...allPrefixes].sort()) {
    if (tombstones.has(prefixId)) {
      tombstonedPrefixCount += 1;
    } else if (aliases.has(prefixId)) {
      inheritedPrefixCount += 1;
    } else if (liveFamilyIds.has(prefixId)) {
      livePrefixCount += 1;
    } else {
      unresolvedPrefixIds.push(prefixId);
    }
  }

  return {
    publicPrefixCount: publicPrefixes.prefixIds.size,
    privatePrefixCount: privatePrefixes.prefixIds.size,
    totalPrefixCount: allPrefixes.size,
    livePrefixCount,
    inheritedPrefixCount,
    tombstonedPrefixCount,
    unresolvedPrefixIds,
    unresolvedCandidateIds: [...unresolvedCandidateIds].sort(),
    invalidPublicPathCount: publicPrefixes.invalidPathCount,
    invalidPrivatePathCount: privatePrefixes.invalidPathCount,
    invalidPublicUrlCount: publicPrefixes.invalidUrlCount,
    invalidPrivateUrlCount: privatePrefixes.invalidUrlCount,
    storeIntegrityErrors: [...new Set(storeIntegrityErrors)].sort(),
    ledgerIntegrityErrors: [...new Set(ledgerIntegrityErrors)].sort(),
    candidateIntegrityErrors: [...new Set(candidateIntegrityErrors)].sort(),
  };
}

async function listFamilyBlobs(token: string): Promise<ArtifactBlobListing[]> {
  const blobs: ArtifactBlobListing[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix: "families/", cursor, token });
    blobs.push(...page.blobs.map((blob) => ({
      pathname: blob.pathname,
      url: blob.url,
    })));
    cursor = page.cursor;
  } while (cursor);
  return blobs;
}

async function main(): Promise<void> {
  const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
  try {
    loadEnvFile(path.join(repoRoot, "apps/web/.env.local"));
  } catch {
    // CI and Vercel-invoked audits receive their environment directly.
  }
  const publicToken = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  const privateToken = process.env.HOMA_LESSON_READ_WRITE_TOKEN?.trim();
  if (!publicToken || !privateToken) {
    throw new Error(
      "Both BLOB_READ_WRITE_TOKEN and HOMA_LESSON_READ_WRITE_TOKEN are required.",
    );
  }
  const publicStoreId = blobStoreIdFromReadWriteToken(publicToken);
  const privateStoreId = blobStoreIdFromReadWriteToken(privateToken);
  if (!publicStoreId || !privateStoreId) {
    throw new Error("Both Blob credentials must be valid read-write tokens.");
  }

  const sql = mapDb();
  try {
    const [publicBlobs, privateBlobs, liveFamilies, aliases, candidates, tombstones] =
      await Promise.all([
        listFamilyBlobs(publicToken),
        listFamilyBlobs(privateToken),
        sql<Array<{ id: string }>>`
          select id
          from public.families
          where status <> 'deleted'
        `,
        sql<Array<{ artifact_family_id: string; owner_family_id: string }>>`
          select artifact_family_id, owner_family_id
          from public.family_artifact_prefixes
        `,
        sql<Array<{
          artifact_family_id: string;
          owner_family_id: string;
          evidence_kind: string;
          evidence_count: number;
        }>>`
          select artifact_family_id, owner_family_id,
            evidence_kind, evidence_count
          from public.family_artifact_prefix_candidates
        `,
        sql<Array<{ family_id: string }>>`
          select family_id
          from public.account_deletion_artifact_tombstones
        `,
      ]);
    const report = auditArtifactFamilyPrefixes({
      publicStore: { storeId: publicStoreId, blobs: publicBlobs },
      privateStore: { storeId: privateStoreId, blobs: privateBlobs },
      liveFamilyIds: liveFamilies.map((row) => row.id),
      aliases: aliases.map((row) => ({
        artifactFamilyId: row.artifact_family_id,
        ownerFamilyId: row.owner_family_id,
      })),
      candidates: candidates.map((row) => ({
        artifactFamilyId: row.artifact_family_id,
        ownerFamilyId: row.owner_family_id,
        evidenceKind: row.evidence_kind,
        evidenceCount: row.evidence_count,
      })),
      tombstoneFamilyIds: tombstones.map((row) => row.family_id),
    });
    console.log(JSON.stringify(report, null, 2));
    if (
      report.unresolvedPrefixIds.length > 0
      || report.unresolvedCandidateIds.length > 0
      || report.invalidPublicPathCount > 0
      || report.invalidPrivatePathCount > 0
      || report.invalidPublicUrlCount > 0
      || report.invalidPrivateUrlCount > 0
      || report.storeIntegrityErrors.length > 0
      || report.ledgerIntegrityErrors.length > 0
      || report.candidateIntegrityErrors.length > 0
    ) {
      throw new Error(
        "Artifact prefix audit found storage roots without a safe durable owner.",
      );
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  void main().catch((error: unknown) => {
    console.error(
      error instanceof Error ? error.message : "Artifact prefix audit failed.",
    );
    process.exitCode = 1;
  });
}
