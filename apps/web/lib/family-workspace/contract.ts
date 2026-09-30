import { createHash } from "node:crypto";

export const WORKSPACE_MAX_BYTES = 64 * 1024;
export const WORKSPACE_MAX_FILES = 100;
export const WORKSPACE_NAMESPACES = ["production", "preview", "development"] as const;
export type WorkspaceNamespace = (typeof WORKSPACE_NAMESPACES)[number];

/** Logical paths never reach the provider filesystem. Objects use verified hashes. */
export function workspacePath(value: string): string {
  if (value.length > 180 || !/^drafts\/[a-zA-Z0-9][a-zA-Z0-9._ /-]*\.(txt|md|csv|json)$/u.test(value)
    || value.split("/").some((segment) => !segment.trim() || segment === "." || segment === ".." || segment !== segment.trim())) {
    throw new Error("Use a relative drafts/ path ending in .txt, .md, .csv, or .json, without traversal.");
  }
  return value;
}

export function workspaceHash(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function workspaceDriveName(familyId: string, namespace: WorkspaceNamespace): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(familyId)) throw new Error("Invalid authenticated family identity");
  if (!WORKSPACE_NAMESPACES.includes(namespace)) throw new Error("Invalid workspace namespace");
  return `homa-ws-${namespace}-${workspaceHash(Buffer.from(familyId)).slice(0, 32)}`;
}

export function workspaceObjectDirectory(fileId: string): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u.test(fileId)) throw new Error("Invalid workspace file identity");
  return `/family-workspace/${fileId}`;
}

export function workspaceObjectPath(hash: string, fileId: string): string {
  if (!/^[0-9a-f]{64}$/u.test(hash)) throw new Error("Invalid workspace content hash");
  return `${workspaceObjectDirectory(fileId)}/${hash}`;
}

export interface WorkspaceFile {
  id: string;
  path: string;
  revision: string;
  sha256: string;
  byte_size: number;
  blob_url: string;
  updated_at: string;
  deleted_at: string | null;
}
