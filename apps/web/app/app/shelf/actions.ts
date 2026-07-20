"use server";

import { revalidatePath } from "next/cache";

import { createSupabaseServerClient } from "../../../lib/supabase/server";
import { getMyFamily } from "../../../lib/family";

/**
 * Server actions for the Shelf feature: add, archive, and fetch shelf
 * books. RLS enforces family scoping; the family_id always comes from
 * the caller's session, never from the client.
 */

export interface ShelfBook {
  id: string;
  familyId: string;
  title: string;
  author: string | null;
  coverUrl: string;
  tocUrl: string | null;
  notes: string | null;
  status: "active" | "archived";
  createdAt: string;
  updatedAt: string;
}

function mapRow(row: Record<string, unknown>): ShelfBook {
  return {
    id: row.id as string,
    familyId: row.family_id as string,
    title: row.title as string,
    author: (row.author as string | null) ?? null,
    coverUrl: row.cover_url as string,
    tocUrl: (row.toc_url as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    status: row.status as "active" | "archived",
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

const MAX_SHELF_BOOKS = 200;

export async function getShelfBooks(): Promise<ShelfBook[]> {
  const family = await getMyFamily();
  if (!family) return [];

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("shelf_books")
    .select("*")
    .eq("family_id", family.id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(MAX_SHELF_BOOKS);

  if (error) {
    console.error("getShelfBooks failed:", error.message);
    return [];
  }
  return (data ?? []).map(mapRow);
}

export async function addShelfBook(input: {
  title: string;
  author?: string;
  coverUrl: string;
  tocUrl?: string;
  notes?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const family = await getMyFamily();
  if (!family) return { ok: false, error: "Not signed in" };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("shelf_books").insert({
    family_id: family.id,
    title: input.title.trim(),
    author: input.author?.trim() || null,
    cover_url: input.coverUrl,
    toc_url: input.tocUrl || null,
    notes: input.notes?.trim() || null,
    status: "active",
  });

  if (error) {
    console.error("addShelfBook failed:", error.message);
    return { ok: false, error: error.message };
  }

  revalidatePath("/app/shelf");
  return { ok: true };
}

export async function removeShelfBook(
  bookId: string,
): Promise<{ ok: boolean; error?: string }> {
  const family = await getMyFamily();
  if (!family) return { ok: false, error: "Not signed in" };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("shelf_books")
    .update({ status: "archived", updated_at: new Date().toISOString() })
    .eq("id", bookId)
    .eq("family_id", family.id);

  if (error) {
    console.error("removeShelfBook failed:", error.message);
    return { ok: false, error: error.message };
  }

  revalidatePath("/app/shelf");
  return { ok: true };
}
