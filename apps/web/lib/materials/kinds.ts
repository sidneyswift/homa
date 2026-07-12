/**
 * The material kind enum, split out of artifact-store.ts on purpose: that
 * module's top-level imports (@vercel/blob, the Postgres-backed map/db)
 * are server-only, so anything that just needs this list of kinds (a
 * client component's filter chips, for one) must not import
 * artifact-store.ts and drag Postgres into the browser bundle with it.
 */
export const MATERIAL_KINDS = [
  "worksheet",
  "coloring",
  "flashcards",
  "reader",
  "poster",
  "infographic",
  "game",
  "other",
] as const;
export type MaterialKind = (typeof MATERIAL_KINDS)[number];
