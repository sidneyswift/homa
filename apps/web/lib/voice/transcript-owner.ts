const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const FAMILY_ID_KEY = "homa_family_id";
const MEMBER_USER_ID_KEY = "homa_member_user_id";

export interface ImmutableCallOwner {
  familyId: string;
  memberUserId: string;
}

/**
 * Telnyx stores this map on the conversation at initialization. It is not a
 * model variable or a client-provided identity: /api/voice/context derives
 * both IDs from the linked caller number before returning it to Telnyx.
 */
export function callOwnerConversationMetadata(
  owner: ImmutableCallOwner,
): Record<string, string> {
  return {
    [FAMILY_ID_KEY]: owner.familyId,
    [MEMBER_USER_ID_KEY]: owner.memberUserId,
  };
}

/**
 * A transcript importer reads only a complete, UUID-shaped owner pair. The
 * database still verifies membership before using it, and anything older or
 * malformed remains invisible rather than being guessed from a phone number.
 */
export function readImmutableCallOwner(
  metadata: Record<string, string> | undefined,
): ImmutableCallOwner | null {
  const familyId = metadata?.[FAMILY_ID_KEY];
  const memberUserId = metadata?.[MEMBER_USER_ID_KEY];
  if (!familyId || !memberUserId || !UUID_RE.test(familyId) || !UUID_RE.test(memberUserId)) {
    return null;
  }
  return { familyId, memberUserId };
}
