import { createHash } from "node:crypto";
import type { Sql } from "postgres";

import { mapDb } from "../map/db";

const MAX_SESSION_ID_LENGTH = 255;
const MAX_CONTINUATION_TOKEN_LENGTH = 8_000;
const PROVISION_LEASE_SECONDS = 15 * 60;
const RESERVATION_LEASE_SECONDS = 5 * 60;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const SHA256_PATTERN = /^[0-9a-f]{64}$/u;

export interface EveSessionPrincipal {
  familyId: string;
  memberUserId: string;
}

export interface EveSessionOwner extends EveSessionPrincipal {
  sessionId: string;
}

export interface EveSessionBindingClaim {
  episodeId: string;
  threadKeyHash: string;
}

export interface EveSessionOwnerStore {
  provision(
    principal: EveSessionPrincipal,
    continuationToken: string,
    binding?: EveSessionBindingClaim,
  ): Promise<string | null>;
  activate(
    provisionId: string,
    owner: EveSessionOwner,
    provisionalToken: string,
    continuationToken: string,
    binding?: EveSessionBindingClaim,
  ): Promise<boolean>;
  cancel(
    provisionId: string,
    principal: EveSessionPrincipal,
    provisionalToken: string,
  ): Promise<boolean>;
  owns(owner: EveSessionOwner): Promise<boolean>;
  reserveContinuation(
    owner: EveSessionOwner,
    currentToken: string,
    reservationToken: string,
  ): Promise<boolean>;
  completeContinuation(
    owner: EveSessionOwner,
    reservationToken: string,
    nextToken: string,
  ): Promise<boolean>;
  restoreContinuation(
    owner: EveSessionOwner,
    reservationToken: string,
  ): Promise<boolean>;
  revokeContinuation(
    owner: EveSessionOwner,
    reservationToken: string,
  ): Promise<boolean>;
}

function validPrincipal(principal: EveSessionPrincipal): boolean {
  return (
    UUID_PATTERN.test(principal.familyId) &&
    UUID_PATTERN.test(principal.memberUserId)
  );
}

function validOwner(owner: EveSessionOwner): boolean {
  return (
    owner.sessionId.length > 0 &&
    owner.sessionId.length <= MAX_SESSION_ID_LENGTH &&
    owner.sessionId.trim() === owner.sessionId &&
    validPrincipal(owner)
  );
}

function validToken(token: string): boolean {
  return token.length > 0 && token.length <= MAX_CONTINUATION_TOKEN_LENGTH;
}

function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function validBinding(
  principal: EveSessionPrincipal,
  binding: EveSessionBindingClaim | undefined,
): boolean {
  return (
    binding === undefined ||
    (UUID_PATTERN.test(binding.episodeId) &&
      SHA256_PATTERN.test(binding.threadKeyHash) &&
      binding.threadKeyHash === tokenHash(`web:${principal.memberUserId}`))
  );
}

class EveSessionActivationRollback extends Error {
  constructor() {
    super("Eve session binding changed before activation.");
    this.name = "EveSessionActivationRollback";
  }
}

/**
 * Creates the server-only owner store. The optional client exists for the
 * disposable Postgres privacy harness; production resolves mapDb lazily so
 * importing the Eve channel never opens a database connection by itself.
 */
export function createEveSessionOwnerStore(
  database?: Sql,
): EveSessionOwnerStore {
  const db = (): Sql => database ?? mapDb();

  return {
    async provision(principal, continuationToken, binding) {
      if (
        !validPrincipal(principal) ||
        !validToken(continuationToken) ||
        !validBinding(principal, binding)
      ) {
        return null;
      }
      const rows = await db()<{ id: string }[]>`
        with stale as (
          delete from public.eve_web_session_owners session_owner
          where session_owner.session_id is null
            and session_owner.family_id = ${principal.familyId}
            and session_owner.member_user_id = ${principal.memberUserId}
            and session_owner.created_at <
              now() - ${PROVISION_LEASE_SECONDS} * interval '1 second'
        )
        insert into public.eve_web_session_owners
          (session_id, family_id, member_user_id, continuation_token_hash)
        select
          null,
          member.family_id,
          member.user_id,
          ${tokenHash(continuationToken)}
        from public.family_members member
        join public.families family on family.id = member.family_id
        where member.family_id = ${principal.familyId}
          and member.user_id = ${principal.memberUserId}
          and family.status <> 'deleted'
          and (
            ${binding === undefined}
            or exists (
              select 1
              from public.conversation_thread_bindings thread_binding
              where thread_binding.family_id = ${principal.familyId}
                and thread_binding.member_user_id = ${principal.memberUserId}
                and thread_binding.channel = 'web'
                and thread_binding.thread_key_hash =
                  ${binding?.threadKeyHash ?? null}
                and thread_binding.episode_id = ${binding?.episodeId ?? null}
            )
          )
        on conflict do nothing
        returning id
      `;
      return rows[0]?.id ?? null;
    },

    async activate(
      provisionId,
      owner,
      provisionalToken,
      continuationToken,
      binding,
    ) {
      if (
        !UUID_PATTERN.test(provisionId) ||
        !validOwner(owner) ||
        !validToken(provisionalToken) ||
        !validToken(continuationToken) ||
        !validBinding(owner, binding)
      ) {
        return false;
      }
      try {
        return await db().begin(async (transaction) => {
          const activated = await transaction<{ id: string }[]>`
            update public.eve_web_session_owners session_owner
            set
              session_id = ${owner.sessionId},
              continuation_token_hash = ${tokenHash(continuationToken)},
              updated_at = now()
            from public.family_members member
            join public.families family on family.id = member.family_id
            where session_owner.id = ${provisionId}
              and session_owner.session_id is null
              and session_owner.family_id = ${owner.familyId}
              and session_owner.member_user_id = ${owner.memberUserId}
              and session_owner.continuation_token_hash =
                ${tokenHash(provisionalToken)}
              and session_owner.continuation_reservation_hash is null
              and member.family_id = session_owner.family_id
              and member.user_id = session_owner.member_user_id
              and family.status <> 'deleted'
            returning session_owner.id
          `;
          if (activated.length !== 1) return false;
          if (binding === undefined) return true;

          const bound = await transaction<{ id: string }[]>`
            update public.conversation_thread_bindings thread_binding
            set
              runtime_session_id = ${owner.sessionId},
              last_seen_at = clock_timestamp()
            where thread_binding.family_id = ${owner.familyId}
              and thread_binding.member_user_id = ${owner.memberUserId}
              and thread_binding.channel = 'web'
              and thread_binding.thread_key_hash = ${binding.threadKeyHash}
              and thread_binding.episode_id = ${binding.episodeId}
            returning thread_binding.id
          `;
          if (bound.length !== 1) throw new EveSessionActivationRollback();
          return true;
        });
      } catch (error) {
        if (error instanceof EveSessionActivationRollback) return false;
        throw error;
      }
    },

    async cancel(provisionId, principal, provisionalToken) {
      if (
        !UUID_PATTERN.test(provisionId) ||
        !validPrincipal(principal) ||
        !validToken(provisionalToken)
      ) {
        return false;
      }
      const rows = await db()<{ id: string }[]>`
        delete from public.eve_web_session_owners session_owner
        where session_owner.id = ${provisionId}
          and session_owner.session_id is null
          and session_owner.family_id = ${principal.familyId}
          and session_owner.member_user_id = ${principal.memberUserId}
          and session_owner.continuation_token_hash =
            ${tokenHash(provisionalToken)}
        returning session_owner.id
      `;
      return rows.length === 1;
    },

    async owns(owner) {
      if (!validOwner(owner)) return false;
      const rows = await db()<{ ok: boolean }[]>`
        select exists (
          select 1
          from public.eve_web_session_owners session_owner
          join public.family_members member
            on member.family_id = session_owner.family_id
           and member.user_id = session_owner.member_user_id
          join public.families family on family.id = member.family_id
          where session_owner.session_id = ${owner.sessionId}
            and session_owner.family_id = ${owner.familyId}
            and session_owner.member_user_id = ${owner.memberUserId}
            and family.status <> 'deleted'
        ) as ok
      `;
      return rows[0]?.ok === true;
    },

    async reserveContinuation(owner, currentToken, reservationToken) {
      if (
        !validOwner(owner) ||
        !validToken(currentToken) ||
        !validToken(reservationToken)
      ) {
        return false;
      }
      const rows = await db()<{ session_id: string }[]>`
        update public.eve_web_session_owners session_owner
        set
          continuation_reservation_hash = ${tokenHash(reservationToken)},
          continuation_reserved_at = now(),
          updated_at = now()
        from public.family_members member
        join public.families family on family.id = member.family_id
        where session_owner.session_id = ${owner.sessionId}
          and session_owner.family_id = ${owner.familyId}
          and session_owner.member_user_id = ${owner.memberUserId}
          and session_owner.continuation_token_hash = ${tokenHash(currentToken)}
          and member.family_id = session_owner.family_id
          and member.user_id = session_owner.member_user_id
          and family.status <> 'deleted'
          and (
            session_owner.continuation_reservation_hash is null
            or session_owner.continuation_reserved_at <
              now() - ${RESERVATION_LEASE_SECONDS} * interval '1 second'
          )
        returning session_owner.session_id
      `;
      return rows.length === 1;
    },

    async completeContinuation(owner, reservationToken, nextToken) {
      if (
        !validOwner(owner) ||
        !validToken(reservationToken) ||
        !validToken(nextToken)
      ) {
        return false;
      }
      const rows = await db()<{ session_id: string }[]>`
        update public.eve_web_session_owners session_owner
        set
          continuation_token_hash = ${tokenHash(nextToken)},
          continuation_reservation_hash = null,
          continuation_reserved_at = null,
          updated_at = now()
        from public.family_members member
        join public.families family on family.id = member.family_id
        where session_owner.session_id = ${owner.sessionId}
          and session_owner.family_id = ${owner.familyId}
          and session_owner.member_user_id = ${owner.memberUserId}
          and session_owner.continuation_reservation_hash =
            ${tokenHash(reservationToken)}
          and member.family_id = session_owner.family_id
          and member.user_id = session_owner.member_user_id
          and family.status <> 'deleted'
        returning session_owner.session_id
      `;
      return rows.length === 1;
    },

    async restoreContinuation(owner, reservationToken) {
      if (!validOwner(owner) || !validToken(reservationToken)) return false;
      const rows = await db()<{ session_id: string }[]>`
        update public.eve_web_session_owners session_owner
        set
          continuation_reservation_hash = null,
          continuation_reserved_at = null,
          updated_at = now()
        from public.family_members member
        join public.families family on family.id = member.family_id
        where session_owner.session_id = ${owner.sessionId}
          and session_owner.family_id = ${owner.familyId}
          and session_owner.member_user_id = ${owner.memberUserId}
          and session_owner.continuation_reservation_hash =
            ${tokenHash(reservationToken)}
          and member.family_id = session_owner.family_id
          and member.user_id = session_owner.member_user_id
          and family.status <> 'deleted'
        returning session_owner.session_id
      `;
      return rows.length === 1;
    },

    async revokeContinuation(owner, reservationToken) {
      if (!validOwner(owner) || !validToken(reservationToken)) return false;
      const rows = await db()<{ session_id: string }[]>`
        delete from public.eve_web_session_owners session_owner
        where session_owner.session_id = ${owner.sessionId}
          and session_owner.family_id = ${owner.familyId}
          and session_owner.member_user_id = ${owner.memberUserId}
          and session_owner.continuation_reservation_hash =
            ${tokenHash(reservationToken)}
        returning session_owner.session_id
      `;
      return rows.length === 1;
    },
  };
}

export const eveSessionOwnerStore = createEveSessionOwnerStore();
