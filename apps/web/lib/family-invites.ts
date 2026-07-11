import { mapDb } from "./map/db";
import { sendFamilyInviteEmail, siteUrl } from "./map/email";
import { emitMapEvent } from "./map/events";
import { hashToken, newToken } from "./map/tokens";

/**
 * Co-parent invites (multi-parent plan Phase 3, NT-4 v0): the join path
 * signup never had. One adult invites another by email; inbox possession
 * of the tokenized /join link is the proof (phone_link_requests posture:
 * hashed at rest, 7 days, single-use); accepting inserts a family_members
 * row instead of creating a second family. Everything here runs on the
 * server-only connection; familyId always arrives from the caller's own
 * membership, never from a form or the model (BUILD.md law #1).
 */

const MAX_SENDS_PER_DAY = 3;

export interface PendingInvite {
  id: string;
  email: string;
  created_at: string;
}

/** Open invites for the settings card's list, newest first. */
export async function listPendingInvites(familyId: string): Promise<PendingInvite[]> {
  const sql = mapDb();
  return await sql<PendingInvite[]>`
    select id, email, created_at::text as created_at
    from public.family_invites
    where family_id = ${familyId} and consumed_at is null and expires_at > now()
    order by created_at desc
  `;
}

export type SendInviteResult =
  | { ok: true }
  | { ok: false; reason: "already-member" | "send-limit" | "email-failed" };

/**
 * Mints an invite and emails the /join link. Re-inviting the same
 * address issues a fresh token (the newest wins; older ones stay valid
 * until they expire, which is fine because consuming any of them makes
 * the rest refuse on the already-member check).
 */
export async function sendFamilyInvite(input: {
  familyId: string;
  email: string;
  invitedBy: string | null;
  inviterName: string | null;
  familyName: string;
}): Promise<SendInviteResult> {
  const sql = mapDb();
  const email = input.email.trim().toLowerCase();

  const member = await sql<{ user_id: string }[]>`
    select m.user_id from public.family_members m
    join auth.users u on u.id = m.user_id
    where m.family_id = ${input.familyId} and lower(u.email) = ${email}
  `;
  if (member.length > 0) return { ok: false, reason: "already-member" };

  const recent = await sql<{ n: string }[]>`
    select count(*)::text as n from public.family_invites
    where family_id = ${input.familyId} and email = ${email}
      and created_at > now() - interval '24 hours'
  `;
  if (Number(recent[0].n) >= MAX_SENDS_PER_DAY) return { ok: false, reason: "send-limit" };

  const token = newToken();
  await sql`
    insert into public.family_invites (family_id, invited_by, email, token_hash)
    values (${input.familyId}, ${input.invitedBy}, ${email}, ${hashToken(token)})
  `;

  const url = `${siteUrl()}/join?t=${token}`;
  const inviter = input.inviterName?.trim() || "A parent in your family";
  const sent = await sendFamilyInviteEmail(email, inviter, input.familyName, url);
  if (!sent) {
    await sql`
      delete from public.family_invites
      where family_id = ${input.familyId} and token_hash = ${hashToken(token)}
    `;
    return { ok: false, reason: "email-failed" };
  }

  await emitMapEvent("family.invite_sent", { family_id: input.familyId });
  return { ok: true };
}

/** The settings card's cancel action. familyId scopes the delete to the
 * caller's own family, so an id from the form can never touch another. */
export async function cancelFamilyInvite(familyId: string, inviteId: string): Promise<void> {
  const sql = mapDb();
  await sql`
    delete from public.family_invites
    where id = ${inviteId} and family_id = ${familyId}
  `;
}

export interface InvitePreview {
  familyName: string;
  inviterName: string | null;
}

/** What the signed-out /join page may show: who is asking, nothing else.
 * Null for unknown, expired, or already-used tokens. */
export async function previewFamilyInvite(rawToken: string): Promise<InvitePreview | null> {
  const sql = mapDb();
  const rows = await sql<{ family_name: string; inviter_name: string | null }[]>`
    select f.name as family_name, m.display_name as inviter_name
    from public.family_invites i
    join public.families f on f.id = i.family_id
    left join public.family_members m
      on m.family_id = i.family_id and m.user_id = i.invited_by
    where i.token_hash = ${hashToken(rawToken)}
      and i.consumed_at is null and i.expires_at > now()
  `;
  const row = rows[0];
  return row ? { familyName: row.family_name, inviterName: row.inviter_name } : null;
}

export type ConsumeInviteResult =
  | { kind: "joined"; familyId: string }
  | { kind: "already-member"; familyId: string }
  | { kind: "has-family" }
  | { kind: "email-mismatch" }
  | { kind: "invalid" }
  | { kind: "expired" };

/**
 * The join moment. Token possession is the auth; the signed-in caller's
 * id comes from their session, never the URL. Deliberately conservative
 * (v0): a caller who already has their OWN family is refused rather than
 * auto-merged; combining two real families is the careful by-hand
 * process the 2026-07-11 founder merge documented.
 */
export async function consumeFamilyInvite(
  rawToken: string,
  authUserId: string,
  authEmail: string | null | undefined,
  displayName: string | null,
): Promise<ConsumeInviteResult> {
  const sql = mapDb();
  const rows = await sql<
    {
      id: string;
      family_id: string;
      email: string;
      role: string;
      expires_at: string;
      consumed_at: string | null;
      consumed_by: string | null;
    }[]
  >`
    select id, family_id, email, role, expires_at::text as expires_at,
           consumed_at::text as consumed_at, consumed_by::text as consumed_by
    from public.family_invites
    where token_hash = ${hashToken(rawToken)}
  `;
  const invite = rows[0];
  if (!invite) return { kind: "invalid" };
  const callerEmail = authEmail?.trim().toLowerCase();
  if (!callerEmail || callerEmail !== invite.email) return { kind: "email-mismatch" };
  if (invite.consumed_at) {
    return invite.consumed_by === authUserId
      ? { kind: "already-member", familyId: invite.family_id }
      : { kind: "invalid" };
  }
  if (Date.parse(invite.expires_at) < Date.now()) return { kind: "expired" };

  const memberships = await sql<{ family_id: string }[]>`
    select family_id from public.family_members where user_id = ${authUserId}
  `;
  if (memberships.some((row) => row.family_id === invite.family_id)) {
    await sql`
      update public.family_invites
      set consumed_at = now(), consumed_by = ${authUserId}
      where id = ${invite.id} and consumed_at is null
    `;
    return { kind: "already-member", familyId: invite.family_id };
  }
  // The invite stays open on purpose: once their own-family situation is
  // resolved (by hand, carefully), the same link still works.
  if (memberships.length > 0) return { kind: "has-family" };

  const joined = await sql.begin(async (tx) => {
    const claimed = await tx<{ family_id: string; role: string }[]>`
      update public.family_invites
      set consumed_at = now(), consumed_by = ${authUserId}
      where id = ${invite.id} and consumed_at is null and expires_at > now()
      returning family_id, role
    `;
    const claim = claimed[0];
    if (!claim) return null;
    await tx`
      insert into public.family_members (family_id, user_id, role, display_name)
      values (${claim.family_id}, ${authUserId}, ${claim.role}, ${displayName})
      on conflict (family_id, user_id) do nothing
    `;
    return { familyId: claim.family_id };
  });
  if (!joined) {
    const latest = await sql<
      { family_id: string; expires_at: string; consumed_by: string | null }[]
    >`
      select family_id, expires_at::text as expires_at, consumed_by::text as consumed_by
      from public.family_invites
      where id = ${invite.id}
    `;
    const row = latest[0];
    if (!row) return { kind: "invalid" };
    if (row.consumed_by === authUserId) return { kind: "already-member", familyId: row.family_id };
    if (Date.parse(row.expires_at) < Date.now()) return { kind: "expired" };
    return { kind: "invalid" };
  }
  await emitMapEvent("family.invite_accepted", { family_id: joined.familyId });
  return { kind: "joined", familyId: joined.familyId };
}
