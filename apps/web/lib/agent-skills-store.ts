import type { SupabaseClient } from "@supabase/supabase-js";

import { scanMemoryContent } from "./agent-memory";
import {
  bankSkillMatchesChildren,
  childTargetingInfo,
  FAMILY_SKILLS_MAX_COUNT,
  mergeSkillRows,
  type BankSkillRow,
  type FamilySkillRow,
} from "./agent-skills";
import { ageInMonths } from "./child-age";
import { mapDb } from "./map/db";

/**
 * Server-side reads and writes for the family skill library. The pure
 * targeting rules stay in agent-skills.ts so scripts can import them without
 * loading database code.
 */

export interface SkillLibraryChildRow {
  birth_month: string;
  profile: { interests?: string[]; focus?: string } | null;
}

export interface SkillLibraryRows {
  familyRows: Pick<FamilySkillRow, "name" | "description" | "markdown">[];
  bankRows: BankSkillRow[];
  children: SkillLibraryChildRow[];
}

export function resolveAdvertisedSkillRows(
  rows: SkillLibraryRows,
  now = new Date(),
): { name: string; description: string; markdown: string }[] {
  const children = rows.children.map((child) =>
    childTargetingInfo(ageInMonths(child.birth_month, now), child.profile),
  );
  const bankRows = rows.bankRows.filter((row) => bankSkillMatchesChildren(row, children));
  return mergeSkillRows(rows.familyRows, bankRows);
}

export async function loadSkillLibraryCaller(
  db: SupabaseClient,
  familyId: string,
): Promise<SkillLibraryRows | null> {
  const [familyResult, bankResult, childrenResult] = await Promise.all([
    db
      .from("family_skills")
      .select("name, description, markdown")
      .eq("family_id", familyId)
      .order("created_at", { ascending: true })
      .limit(FAMILY_SKILLS_MAX_COUNT),
    db
      .from("skill_bank")
      .select("name, description, markdown, min_age_months, max_age_months, tags")
      .eq("published", true)
      .limit(100),
    db
      .from("children")
      .select("birth_month, profile")
      .eq("family_id", familyId),
  ]);
  if (familyResult.error || bankResult.error || childrenResult.error) return null;
  return {
    familyRows: familyResult.data ?? [],
    bankRows: (bankResult.data ?? []) as BankSkillRow[],
    children: (childrenResult.data ?? []) as SkillLibraryChildRow[],
  };
}

export async function loadSkillLibraryPinned(
  familyId: string,
): Promise<SkillLibraryRows> {
  const sql = mapDb();
  const [familyRows, bankRows, children] = await Promise.all([
    sql<Pick<FamilySkillRow, "name" | "description" | "markdown">[]>`
      select name, description, markdown
      from public.family_skills
      where family_id = ${familyId}
      order by created_at
      limit ${FAMILY_SKILLS_MAX_COUNT}
    `,
    sql<BankSkillRow[]>`
      select name, description, markdown, min_age_months, max_age_months, tags
      from public.skill_bank
      where published = true
      limit 100
    `,
    sql<SkillLibraryChildRow[]>`
      select to_char(birth_month, 'YYYY-MM-DD') as birth_month, profile
      from public.children
      where family_id = ${familyId}
    `,
  ]);
  return { familyRows, bankRows, children };
}

export interface SaveFamilySkillInput {
  name: string;
  description: string;
  markdown: string;
}

export type SaveFamilySkillResult =
  | { saved: true; updated: boolean }
  | { saved: false; note: string; current_skills?: string[] };

function validateSkillContent(input: SaveFamilySkillInput): string | null {
  for (const text of [input.description, input.markdown]) {
    const blocked = scanMemoryContent(text);
    if (blocked) return blocked;
  }
  return null;
}

function validateSkillCapacity(
  input: SaveFamilySkillInput,
  names: string[],
): SaveFamilySkillResult | null {
  const isUpdate = names.includes(input.name);
  if (!isUpdate && names.length >= FAMILY_SKILLS_MAX_COUNT) {
    return {
      saved: false,
      note: `The skill library is at its limit of ${FAMILY_SKILLS_MAX_COUNT}. Ask the parent which one to retire (forget_skill), then retry.`,
      current_skills: names,
    };
  }
  return null;
}

export async function saveFamilySkillCaller(
  db: SupabaseClient,
  familyId: string,
  input: SaveFamilySkillInput,
): Promise<SaveFamilySkillResult> {
  const blocked = validateSkillContent(input);
  if (blocked) return { saved: false, note: blocked };

  const { data: existing, error: readError } = await db
    .from("family_skills")
    .select("name")
    .eq("family_id", familyId);
  if (readError) {
    return { saved: false, note: `Could not read the skill library: ${readError.message}` };
  }

  const names = (existing ?? []).map((row) => row.name);
  const isUpdate = names.includes(input.name);
  const capacityError = validateSkillCapacity(input, names);
  if (capacityError) return capacityError;

  const { error: writeError } = await db.from("family_skills").upsert(
    {
      family_id: familyId,
      name: input.name,
      description: input.description,
      markdown: input.markdown,
      source: "homa",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "family_id,name" },
  );
  if (writeError) {
    return { saved: false, note: `Could not save: ${writeError.message}` };
  }

  return { saved: true, updated: isUpdate };
}

export async function saveFamilySkillPinned(
  familyId: string,
  input: SaveFamilySkillInput,
): Promise<SaveFamilySkillResult> {
  const blocked = validateSkillContent(input);
  if (blocked) return { saved: false, note: blocked };

  const sql = mapDb();
  const existing = await sql<{ name: string }[]>`
    select name from public.family_skills where family_id = ${familyId}
  `;
  const names = existing.map((row) => row.name);
  const isUpdate = names.includes(input.name);
  const capacityError = validateSkillCapacity(input, names);
  if (capacityError) return capacityError;

  await sql`
    insert into public.family_skills (family_id, name, description, markdown, source, updated_at)
    values (${familyId}, ${input.name}, ${input.description}, ${input.markdown}, 'homa', now())
    on conflict (family_id, name) do update
    set description = excluded.description,
        markdown = excluded.markdown,
        source = excluded.source,
        updated_at = now()
  `;

  return { saved: true, updated: isUpdate };
}

export type ForgetFamilySkillResult =
  | {
      deleted: true;
      name: string;
      forgot: { description: string; markdown: string };
    }
  | { deleted: false; note: string; current_skills?: string[] };

export async function forgetFamilySkillCaller(
  db: SupabaseClient,
  familyId: string,
  name: string,
): Promise<ForgetFamilySkillResult> {
  const { data: target, error: readError } = await db
    .from("family_skills")
    .select("id, name, description, markdown")
    .eq("family_id", familyId)
    .eq("name", name)
    .maybeSingle();
  if (readError) {
    return { deleted: false, note: `Could not read the skill library: ${readError.message}` };
  }
  if (!target) {
    const { data: all } = await db
      .from("family_skills")
      .select("name")
      .eq("family_id", familyId);
    return {
      deleted: false,
      note: "No skill by that name.",
      current_skills: (all ?? []).map((row) => row.name),
    };
  }

  const { error: deleteError } = await db
    .from("family_skills")
    .delete()
    .eq("id", target.id)
    .eq("family_id", familyId);
  if (deleteError) {
    return { deleted: false, note: `Could not delete: ${deleteError.message}` };
  }

  return {
    deleted: true,
    name: target.name,
    forgot: { description: target.description, markdown: target.markdown },
  };
}

export async function forgetFamilySkillPinned(
  familyId: string,
  name: string,
): Promise<ForgetFamilySkillResult> {
  const sql = mapDb();
  const rows = await sql<
    { id: string; name: string; description: string; markdown: string }[]
  >`
    select id, name, description, markdown
    from public.family_skills
    where family_id = ${familyId} and name = ${name}
  `;
  const target = rows[0];
  if (!target) {
    const all = await sql<{ name: string }[]>`
      select name from public.family_skills where family_id = ${familyId}
    `;
    return {
      deleted: false,
      note: "No skill by that name.",
      current_skills: all.map((row) => row.name),
    };
  }

  await sql`
    delete from public.family_skills
    where id = ${target.id} and family_id = ${familyId}
  `;

  return {
    deleted: true,
    name: target.name,
    forgot: { description: target.description, markdown: target.markdown },
  };
}
