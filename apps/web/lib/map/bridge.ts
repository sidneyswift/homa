import type { SupabaseClient } from "@supabase/supabase-js";

import { MAP_DOMAINS } from "@homa/core";

import { MEMORY_ENTRY_MAX_CHARS, scanMemoryContent } from "../agent-memory";
import { copyLeadPhoneToFamily } from "../family-phone";
import { createSupabaseServerClient } from "../supabase/server";
import { mapDb } from "./db";
import { emitMapEvent } from "./events";

/**
 * The lead-to-product bridge (founder ruling 2026-07-06: "once they
 * generate a report they create a family workspace"). The moment a lead's
 * report is scored, her already-real auth account gains its real product
 * workspace: a families row via the create_my_family RPC, her
 * family_members membership, and children rows mirrored from her lead
 * kids. From then on the agent's every-turn family context can see them.
 *
 * Tenancy posture, per BUILD.md law #1: NO service role. Every
 * product-table write runs as the signed-in caller under RLS (the same
 * patterns as app/home/actions.ts). The lead tables stay deny-all and are
 * only touched through the server-only mapDb client. familyId comes from
 * the RPC return or the caller's own family_members row, never from any
 * request input.
 *
 * Idempotent by construction: membership lookup, lead_children.child_id
 * links, and the RPC's own one-family guard make it safe to call on every
 * score, which is also how rescore-time profile updates mirror forward.
 */

interface BridgeLead {
  auth_user_id: string | null;
  first_name: string | null;
  us_state: string | null;
  phone_e164: string | null;
}

interface BridgeKid {
  id: string;
  name: string;
  birth_date: string;
  interests: string[];
  help_with: string | null;
  child_id: string | null;
  context: Record<string, unknown>;
}

/**
 * A kid's interests and help-with live in TWO places on the lead side:
 * the columns (populated when the old kids form collected them at add
 * time) and the context jsonb bag (where today's extras step and the
 * report page write them, as `interests` and `helpWith` arrays). The
 * product profile wants one answer, so merge both, columns first.
 */
function resolveKidProfileFields(kid: BridgeKid): { interests: string[]; focus: string | null } {
  const bag = kid.context ?? {};
  const bagInterests = Array.isArray(bag.interests)
    ? bag.interests.filter((item): item is string => typeof item === "string")
    : [];
  const interests = [...new Set([...kid.interests, ...bagInterests])];

  const bagHelp = Array.isArray(bag.helpWith)
    ? bag.helpWith.filter((item): item is string => typeof item === "string")
    : [];
  const focus = kid.help_with ?? (bagHelp.length > 0 ? bagHelp.join(", ") : null);

  return { interests, focus };
}

function whatsWorkingNotes(kid: BridgeKid): Array<[string, string]> {
  const bag = kid.context?.whatsWorking;
  if (!bag || typeof bag !== "object") return [];
  return Object.entries(bag as Record<string, unknown>).filter(
    (entry): entry is [string, string] =>
      typeof entry[1] === "string" && entry[1].trim().length > 0,
  );
}

export async function ensureFamilyWorkspace(
  leadId: string,
): Promise<{ familyId: string } | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    // Legacy email-only leads keep the old invite-time path (MJ-09).
    await emitMapEvent("map.family_bridge_skipped", {
      lead_id: leadId,
      reason: "no-auth-session",
    });
    return null;
  }

  const sql = mapDb();
  const leadRows = await sql<BridgeLead[]>`
    select auth_user_id, first_name, us_state, phone_e164
    from public.lead_families where id = ${leadId}
  `;
  const lead = leadRows[0];
  if (!lead || lead.auth_user_id !== user.id) {
    // An emailed report link honored by requireLead can be opened in a
    // browser signed into a DIFFERENT account; mirroring there would leak
    // kids across families. Only the lead's own linked account bridges.
    await emitMapEvent("map.family_bridge_skipped", {
      lead_id: leadId,
      reason: "auth-user-mismatch",
    });
    return null;
  }

  const { familyId, familyCreated } = await ensureFamily(supabase, lead);

  // The signup-typed cell becomes the family texting line. Best-effort,
  // never overwrites a /home-set number (see copyLeadPhoneToFamily).
  if (lead.phone_e164) {
    await copyLeadPhoneToFamily(familyId, lead.phone_e164, user.id);
  }

  // The mirror phase runs inside one transaction holding a row lock on
  // the lead, because two concurrent scores (a double-tap, two devices,
  // React StrictMode re-firing effects in dev) would otherwise both read
  // child_id as null and each insert their own product children. The
  // second runner blocks on the lock, then sees the winner's links and
  // only updates profiles. Caught live in the 2026-07-06 bridge e2e.
  const { childrenCreated, childrenUpdated, kids, failures } = await sql.begin(async (tx) => {
    await tx`select id from public.lead_families where id = ${leadId} for update`;

    // All of them on purpose: a pending-band kid too young to score is
    // still a real kid the agent should know about.
    const leadKids = await tx<BridgeKid[]>`
      select id, name, to_char(birth_month, 'YYYY-MM-DD') as birth_date,
             interests, help_with, child_id, context
      from public.lead_children
      where lead_family_id = ${leadId}
      order by created_at
    `;

    const linkedIds = new Set(
      leadKids.map((kid) => kid.child_id).filter((id): id is string => id !== null),
    );
    let created = 0;
    let updated = 0;
    const kidFailures: string[] = [];
    for (const kid of leadKids) {
      // Per-kid try/catch: the product insert is a REST call OUTSIDE this
      // transaction, so letting one kid's failure throw here would roll
      // back the other kids' link stamps while their product rows stay,
      // turning the next retry into duplicate children.
      try {
        if (kid.child_id) {
          if (await mirrorProfileForward(supabase, familyId, kid)) updated += 1;
          continue;
        }
        // A product child with this kid's exact name and birth date that
        // no lead kid links to is an orphan from an interrupted earlier
        // run (inserted, then the link stamp never committed). Adopt it
        // instead of inserting a twin.
        const orphanId = await findOrphanChild(supabase, familyId, kid, linkedIds);
        const childId = orphanId ?? (await mirrorNewChild(supabase, familyId, kid));
        await tx`update public.lead_children set child_id = ${childId} where id = ${kid.id}`;
        kid.child_id = childId;
        linkedIds.add(childId);
        if (orphanId) {
          if (await mirrorProfileForward(supabase, familyId, kid)) updated += 1;
        } else {
          created += 1;
        }
      } catch (error) {
        kidFailures.push(error instanceof Error ? error.message : "unknown");
      }
    }
    return {
      childrenCreated: created,
      childrenUpdated: updated,
      kids: leadKids,
      failures: kidFailures,
    };
  });

  await seedWhatWorksMemories(supabase, familyId, kids);

  if (failures.length > 0) {
    // Logged, not thrown: the successful kids' links are already
    // committed, and the next score retries the stragglers.
    console.error(`family bridge mirrored partially for lead ${leadId}:`, failures.join("; "));
  }

  if (familyCreated || childrenCreated > 0 || childrenUpdated > 0) {
    await emitMapEvent("map.family_bridged", {
      lead_id: leadId,
      family_id: familyId,
      children_created: childrenCreated,
      children_updated: childrenUpdated,
    });
  }
  return { familyId };
}

async function lookupFamilyId(supabase: SupabaseClient): Promise<string | null> {
  const { data, error } = await supabase
    .from("family_members")
    .select("family_id")
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`family_members lookup failed: ${error.message}`);
  return data?.family_id ?? null;
}

async function ensureFamily(
  supabase: SupabaseClient,
  lead: BridgeLead,
): Promise<{ familyId: string; familyCreated: boolean }> {
  const existing = await lookupFamilyId(supabase);
  if (existing) return { familyId: existing, familyCreated: false };

  const { data, error } = await supabase.rpc("create_my_family", {
    family_us_state: lead.us_state,
    parent_name: lead.first_name,
  });
  if (error) {
    // The RPC's one-family guard fired (two scores racing): the membership
    // row that won is the answer.
    const raced = await lookupFamilyId(supabase);
    if (raced) return { familyId: raced, familyCreated: false };
    throw new Error(`create_my_family failed: ${error.message}`);
  }

  const row = Array.isArray(data) ? data[0] : data;
  const familyId = row && typeof row.family_id === "string" ? row.family_id : null;
  if (familyId) return { familyId, familyCreated: true };

  // Shape drift on the RPC return: the membership row it inserted is
  // still the source of truth.
  const fromMembership = await lookupFamilyId(supabase);
  if (fromMembership) return { familyId: fromMembership, familyCreated: true };
  throw new Error("create_my_family returned no family id");
}

/**
 * Finds a product child in this family matching the lead kid's name and
 * birth date that no lead kid currently links to. Under the caller's RLS,
 * so only their own family is ever visible.
 */
async function findOrphanChild(
  supabase: SupabaseClient,
  familyId: string,
  kid: BridgeKid,
  linkedIds: ReadonlySet<string>,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("children")
    .select("id")
    .eq("family_id", familyId)
    .eq("name", kid.name)
    .eq("birth_month", kid.birth_date)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`orphan lookup failed for lead child ${kid.id}: ${error.message}`);
  const orphan = (data ?? []).find((row) => !linkedIds.has(row.id));
  return orphan?.id ?? null;
}

/**
 * Inserts the product child (as the caller, under RLS) and returns its id.
 * The caller stamps lead_children.child_id inside the locked transaction;
 * that stamp is what makes every future bridge run idempotent for this kid.
 */
async function mirrorNewChild(
  supabase: SupabaseClient,
  familyId: string,
  kid: BridgeKid,
): Promise<string> {
  const { interests, focus } = resolveKidProfileFields(kid);
  const { data, error } = await supabase
    .from("children")
    .insert({
      family_id: familyId,
      name: kid.name,
      // The REAL birth date, not a day-01 stand-in: lead birthdays are
      // real days by founder ruling 2026-07-06, the column takes full
      // dates, and age math everywhere reads month + year only.
      birth_month: kid.birth_date,
      profile: {
        interests,
        ...(focus ? { focus } : {}),
      },
    })
    .select("id")
    .single();
  if (error || !data) {
    throw new Error(
      `children insert failed for lead child ${kid.id}: ${error?.message ?? "no row returned"}`,
    );
  }
  return data.id;
}

/**
 * Mirrors current lead interests and help_with forward onto the product
 * child (last-write-wins, founder-ruled). Empty lead values are skipped so
 * a rescore never wipes agent-written profile fields with nothing.
 */
async function mirrorProfileForward(
  supabase: SupabaseClient,
  familyId: string,
  kid: BridgeKid,
): Promise<boolean> {
  // Re-scope the stored link under the caller's RLS: a child_id that is
  // not visible inside THIS family is ignored, never written to.
  const { data: child, error } = await supabase
    .from("children")
    .select("id, profile")
    .eq("id", kid.child_id)
    .eq("family_id", familyId)
    .maybeSingle();
  if (error) throw new Error(`children read failed for ${kid.child_id}: ${error.message}`);
  if (!child) return false;

  const { interests, focus } = resolveKidProfileFields(kid);
  const current = (child.profile ?? {}) as Record<string, unknown>;
  const next: Record<string, unknown> = { ...current };
  if (interests.length > 0) next.interests = interests;
  if (focus) next.focus = focus;
  if (JSON.stringify(next) === JSON.stringify(current)) return false;

  const { error: updateError } = await supabase
    .from("children")
    .update({ profile: next, updated_at: new Date().toISOString() })
    .eq("id", kid.child_id)
    .eq("family_id", familyId);
  if (updateError) {
    throw new Error(`children update failed for ${kid.child_id}: ${updateError.message}`);
  }
  return true;
}

const DOMAIN_NAMES = new Map(MAP_DOMAINS.map((domain) => [domain.id, domain.displayName]));

/**
 * Stretch seed: a child's first what_works memory from the parent's own
 * whats-working notes, so the agent starts out knowing what she told the
 * report page. One row per child, only while the child has none, so agent
 * consolidation is never fought and rescores never duplicate. Best-effort:
 * failures are logged and skipped, never thrown.
 */
async function seedWhatWorksMemories(
  supabase: SupabaseClient,
  familyId: string,
  kids: BridgeKid[],
): Promise<void> {
  for (const kid of kids) {
    const notes = whatsWorkingNotes(kid);
    if (!kid.child_id || notes.length === 0) continue;

    const { data: existing, error } = await supabase
      .from("family_memories")
      .select("id")
      .eq("family_id", familyId)
      .eq("child_id", kid.child_id)
      .eq("kind", "what_works")
      .limit(1);
    if (error || (existing ?? []).length > 0) continue;

    const parts = notes.map(([domainId, text]) => {
      const subject = DOMAIN_NAMES.get(domainId) ?? domainId;
      return `${subject}: ${text.trim()}`;
    });
    const content = `What the parent says works, in her own words. ${parts.join(" · ")}`.slice(
      0,
      MEMORY_ENTRY_MAX_CHARS,
    );
    if (scanMemoryContent(content)) continue;

    const { error: insertError } = await supabase.from("family_memories").insert({
      family_id: familyId,
      child_id: kid.child_id,
      kind: "what_works",
      content,
      source: "onboarding",
    });
    if (insertError) {
      console.error(`what_works seed failed for child ${kid.child_id}:`, insertError.message);
    }
  }
}
