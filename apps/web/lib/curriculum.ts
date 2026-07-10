import type { Curriculum } from "@homa/core";

import { createSupabaseServerClient } from "./supabase/server";

/**
 * Reads for the "Call Homa" curriculum feature's dashboard surface (/app).
 * RLS-scoped
 * (child_curricula and child_curriculum_calls both carry member-read
 * policies via is_child_family_member, migration #24), so every row is
 * already this family's own.
 */

export interface ChildCurriculumRow {
  childId: string;
  curriculum: Curriculum;
  generatedAt: string;
}

export async function getCurriculaForChildren(
  childIds: string[],
): Promise<Map<string, ChildCurriculumRow>> {
  if (childIds.length === 0) return new Map();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("child_curricula")
    .select("child_id, curriculum, generated_at")
    .in("child_id", childIds);
  if (error) throw new Error(`child_curricula read failed: ${error.message}`);
  return new Map(
    (data ?? []).map((row) => [
      row.child_id as string,
      {
        childId: row.child_id as string,
        curriculum: row.curriculum as Curriculum,
        generatedAt: row.generated_at as string,
      },
    ]),
  );
}

/** Child ids with a call in flight (no curriculum yet), for the "Homa is
 * working on it" pending state. */
export async function getPendingCurriculumChildIds(childIds: string[]): Promise<Set<string>> {
  if (childIds.length === 0) return new Set();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("child_curriculum_calls")
    .select("child_id")
    .in("child_id", childIds)
    .eq("status", "initiated");
  if (error) throw new Error(`child_curriculum_calls read failed: ${error.message}`);
  return new Set((data ?? []).map((row) => row.child_id as string));
}
