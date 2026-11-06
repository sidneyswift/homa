/**
 * Creates and resets the local stack's test parents
 * (apps/mobile/src/features/dev/local-personas.ts has the roster).
 * Local stack only: scripts/local-stack.mts refuses any database that is
 * not on this machine before calling anything here.
 *
 * Each persona is rebuilt from nothing on every seed, with a new auth
 * user id, so no client-side cache keyed on the old id (the onboarding
 * gate's "through" flag, for one) can leak a previous run's state.
 */

import type postgres from "postgres";

import {
  LOCAL_PERSONA_PASSWORD,
  LOCAL_PERSONAS,
  NEW_PARENT_EMAIL_PATTERN,
  type LocalPersonaId,
} from "../apps/mobile/src/features/dev/local-personas";

import { buildFamilyHistorySql } from "./family-history-sql.mts";

type Sql = ReturnType<typeof postgres>;

export interface AuthAdmin {
  apiUrl: string;
  serviceRoleKey: string;
}

export interface SeededPersona {
  id: LocalPersonaId;
  /** null for "new", which has no standing account. */
  email: string | null;
  familyId: string | null;
}

function personaEmail(id: LocalPersonaId): string | null {
  return LOCAL_PERSONAS.find((persona) => persona.id === id)?.email ?? null;
}

/**
 * Creates a confirmed user through the local auth server's admin API, so
 * the password, identity and confirmation rows are exactly what sign-in
 * expects. Raw inserts into auth.users miss the identity row.
 */
async function createAuthUser(admin: AuthAdmin, email: string): Promise<string> {
  const response = await fetch(`${admin.apiUrl}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: admin.serviceRoleKey,
      authorization: `Bearer ${admin.serviceRoleKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      email,
      password: LOCAL_PERSONA_PASSWORD,
      email_confirm: true,
    }),
  });
  const body = (await response.json().catch(() => null)) as { id?: string } | null;
  if (!response.ok || !body?.id) {
    throw new Error(
      `local auth refused ${email}: HTTP ${response.status} ${JSON.stringify(body)}`,
    );
  }
  return body.id;
}

/**
 * Removes a persona's users and families. The family delete mirrors
 * eraseFamilyRecordsInTransaction (apps/web/lib/account-deletion.ts):
 * those five tables do not cascade from families. If a later migration
 * adds another, this fails loudly on its foreign key; add it here too.
 */
async function erasePersonaRecords(sql: Sql, emails: string[]): Promise<number> {
  if (emails.length === 0) return 0;
  return sql.begin(async (tx) => {
    const users = await tx<{ id: string }[]>`
      select id from auth.users where lower(email) = any(${emails})
    `;
    const userIds = users.map((user) => user.id);
    const families = await tx<{ id: string }[]>`
      select distinct f.id
      from public.families f
      left join public.family_members m on m.family_id = f.id
      where lower(f.email) = any(${emails})
         or m.user_id = any(${userIds}::uuid[])
    `;
    // Production refuses a family hard delete outside the account
    // deletion or family fold protocols, both of which first prove where
    // the family's stored artifacts went
    // (20260808170000_family_hard_delete_protocol.sql). A local test
    // parent's artifacts sit in the local blob folder, so the guard is
    // lifted inside this transaction only; ALTER TABLE is transactional
    // and the guard is back before anyone else can see the table.
    if (families.length > 0) {
      await tx`alter table public.families disable trigger families_hard_delete_protocol_guard`;
    }
    for (const { id } of families) {
      await tx`
        delete from public.phone_leads lead
        using public.family_phones phone
        where phone.family_id = ${id} and phone.phone_e164 = lead.phone_e164
      `;
      await tx`
        delete from public.admin_alert_acknowledgments acknowledgment
        using public.email_sends email_send
        where acknowledgment.source = 'email_send'
          and acknowledgment.source_id = email_send.id
          and email_send.family_id = ${id}
      `;
      await tx`delete from public.email_sends where family_id = ${id}`;
      await tx`delete from public.model_usage where family_id = ${id}`;
      await tx`delete from public.conversation_signals where family_id = ${id}`;
      await tx`delete from public.knowledge_gaps where family_id = ${id}`;
      await tx`delete from public.response_engagement where family_id = ${id}`;
      await tx`delete from public.families where id = ${id}`;
    }
    if (families.length > 0) {
      await tx`alter table public.families enable trigger families_hard_delete_protocol_guard`;
    }
    if (userIds.length > 0) {
      await tx`delete from auth.users where id = any(${userIds}::uuid[])`;
    }
    return families.length;
  });
}

/** Every address a persona has used, for a reset. */
async function personaEmails(sql: Sql, id: LocalPersonaId): Promise<string[]> {
  const fixed = personaEmail(id);
  if (fixed) return [fixed];
  const rows = await sql<{ email: string }[]>`
    select lower(email) as email from auth.users where email like 'new-%+homatest@homa.test'
  `;
  return rows.map((row) => row.email).filter((email) => NEW_PARENT_EMAIL_PATTERN.test(email));
}

export async function resetPersona(sql: Sql, id: LocalPersonaId): Promise<number> {
  return erasePersonaRecords(sql, await personaEmails(sql, id));
}

/** A birthday that makes the child `age` today; full date, as addChild stores it. */
function birthdayForAge(age: number, monthOffset: number): string {
  const now = new Date();
  const date = new Date(Date.UTC(now.getUTCFullYear() - age, now.getUTCMonth(), 15));
  date.setUTCMonth(date.getUTCMonth() - monthOffset);
  return date.toISOString().slice(0, 10);
}

/**
 * Halfway through the native walk: what the walk itself leaves behind
 * after the kids screen. The mobile bootstrap made a mobile-born family
 * (apps/web/app/api/mobile/onboarding/route.ts), addChild wrote Juno
 * (apps/mobile/src/lib/family.ts), and the kids screen saved her draft
 * and moved the pointer to "you".
 */
async function seedOnboarding(sql: Sql, admin: AuthAdmin): Promise<SeededPersona> {
  const email = personaEmail("onboarding")!;
  const userId = await createAuthUser(admin, email);
  const familyId = await sql.begin(async (tx) => {
    const [family] = await tx<{ id: string }[]>`
      insert into public.families (email, source, status, sandbox)
      values (${email}, 'mobile', 'claimed', true)
      returning id
    `;
    await tx`
      insert into public.family_members (family_id, user_id, role)
      values (${family.id}, ${userId}, 'parent')
    `;
    // Chip labels exactly as the kids screen offers them for a 7-year-old
    // (apps/mobile/src/app/(onboarding)/kids.tsx): interests are lower
    // case, working-on chips are capitalized, and a value that matches
    // no chip renders unselected.
    const kid = {
      name: "Juno",
      age: 7,
      love: ["dinosaurs", "drawing"],
      workingOn: ["Reading"],
    };
    const [child] = await tx<{ id: string }[]>`
      insert into public.children (family_id, name, birth_month, profile)
      values (
        ${family.id}, ${kid.name}, ${birthdayForAge(kid.age, 6)}::date,
        ${tx.json({ interests: kid.love, focus: kid.workingOn[0], birthdayApproximate: true })}
      )
      returning id
    `;
    await tx`
      insert into public.mobile_onboarding_state (family_id, step, answers)
      values (
        ${family.id}, 'you',
        ${tx.json({ kids: [{ ...kid, childId: child.id }] })}
      )
    `;
    return family.id;
  });
  return { id: "onboarding", email, familyId };
}

/**
 * Finished onboarding on the web side, consented, comped, with a
 * quarter of real-looking history. Every gate between sign-in and chat
 * is satisfied the way production satisfies it: create_my_family as the
 * signed-in user, consent on the membership, billing_exempt as the comp
 * switch (apps/web/lib/billing/wall.ts), and children the chat needs.
 */
async function seedEstablished(sql: Sql, admin: AuthAdmin): Promise<SeededPersona> {
  const email = personaEmail("established")!;
  const userId = await createAuthUser(admin, email);
  const familyName = "Rivera";
  const familyId = await sql.begin(async (tx) => {
    await tx`select set_config('request.jwt.claim.sub', ${userId}, true)`;
    await tx`
      select set_config(
        'request.jwt.claims',
        ${JSON.stringify({ sub: userId, email, role: "authenticated" })},
        true
      )
    `;
    await tx`set local role authenticated`;
    const [created] = await tx<{ family_id: string }[]>`
      select * from public.create_my_family(${familyName}, 'PA', 'Robin')
    `;
    await tx`reset role`;
    const id = created.family_id;
    await tx`
      update public.families set
        email = ${email},
        status = 'claimed',
        profile_completed_at = now(),
        billing_exempt = true,
        created_at = now() - interval '92 days'
      where id = ${id}
    `;
    await tx`
      update public.family_members set ai_processing_consented_at = now()
      where family_id = ${id} and user_id = ${userId}
    `;
    for (const [index, kid] of [
      { name: "Ada", age: 9, interests: ["horses", "fractions"], focus: "multiplication" },
      { name: "Mateo", age: 7, interests: ["volcanoes", "Lego"], focus: "reading" },
    ].entries()) {
      await tx`
        insert into public.children (family_id, name, birth_month, profile, created_at)
        values (
          ${id}, ${kid.name}, ${birthdayForAge(kid.age, index * 4)}::date,
          ${tx.json({ interests: kid.interests, focus: kid.focus })},
          now() - interval '92 days' + ${`${index} minutes`}::interval
        )
      `;
    }
    return id;
  });

  const children = await sql<{ id: string }[]>`
    select id from public.children where family_id = ${familyId} order by created_at, id
  `;
  const history = buildFamilyHistorySql({
    profile: "month3",
    state: "PA",
    children: children.length,
    familyName,
    seed: 20261102,
    asOf: new Date(),
    familyId,
    childIds: children.map((child) => child.id),
  });
  await sql.unsafe(history.sql);
  return { id: "established", email, familyId };
}

/**
 * Rebuilds one persona from nothing. "new" only clears earlier throwaway
 * accounts: the picker signs up a fresh address each time, and the app's
 * own bootstrap creates its family, which is the path being tested.
 */
export async function seedPersona(
  sql: Sql,
  admin: AuthAdmin,
  id: LocalPersonaId,
): Promise<SeededPersona> {
  await resetPersona(sql, id);
  if (id === "onboarding") return seedOnboarding(sql, admin);
  if (id === "established") return seedEstablished(sql, admin);
  return { id, email: null, familyId: null };
}
