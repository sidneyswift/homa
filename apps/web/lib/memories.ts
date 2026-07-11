import type { MemoryCardRow } from "../components/dashboard/memories-card";
import { createSupabaseServerClient } from "./supabase/server";

export interface MemoriesResult {
  memories: MemoryCardRow[];
  loadError: boolean;
}

/**
 * The signed-in parent's saved memories, newest first, read under their
 * OWN RLS context (the members-read policy is the wall; the familyId
 * filter is belt on top). Feeds the /app "What Homa remembers" card,
 * the visible face of every memory the agent and the learning loops save.
 */
export async function getMyMemories(familyId: string): Promise<MemoriesResult> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("family_memories")
    .select("id, content, kind, source, child_id, created_at")
    .eq("family_id", familyId)
    .is("superseded_at", null)
    .in("kind", ["fact", "what_works"])
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) {
    console.error(`family_memories read failed: ${error.message}`);
    return { memories: [], loadError: true };
  }
  return { memories: (data ?? []) as MemoryCardRow[], loadError: false };
}
