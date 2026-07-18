import { mapDb } from "../map/db";

export type FamilyAccountOwnerClassification =
  | "owner"
  | "non_owner"
  | "no_actor"
  | "lookup_failed";

export type SubjectLessonOwnerAuthorization =
  | {
      status: "owner";
      familyId: string;
      memberUserId: string;
    }
  | { status: "non_owner" }
  | { status: "no_actor" }
  | { status: "lookup_failed" };

interface FamilyActorAccess {
  family: { id: string };
  memberUserId: string | null;
}

interface FamilyAccountOwnerDependencies {
  requireFamilyWithActor(): Promise<FamilyActorAccess | null>;
  isFamilyAccountOwner(
    familyId: string,
    memberUserId: string,
  ): Promise<boolean>;
}

type FamilyAccountOwnerLookup = (
  familyId: string,
) => Promise<string | null>;

export function classifyFamilyAccountOwner(input: {
  memberUserId: string | null;
  ownerUserId: string | null;
  lookupFailed: boolean;
}): FamilyAccountOwnerClassification {
  if (input.lookupFailed) return "lookup_failed";
  if (!input.memberUserId) return "no_actor";
  return input.memberUserId === input.ownerUserId
    ? "owner"
    : "non_owner";
}

async function lookupFirstFamilyMemberUserId(
  familyId: string,
): Promise<string | null> {
  const sql = mapDb();
  const rows = await sql<{ user_id: string }[]>`
    select member.user_id
    from public.family_members member
    where member.family_id = ${familyId}
    order by member.created_at, member.user_id
    limit 1
  `;
  return rows[0]?.user_id ?? null;
}

export async function isFamilyAccountOwner(
  familyId: string,
  memberUserId: string,
  lookupOwnerUserId: FamilyAccountOwnerLookup =
    lookupFirstFamilyMemberUserId,
): Promise<boolean> {
  const ownerUserId = await lookupOwnerUserId(familyId);
  return classifyFamilyAccountOwner({
    memberUserId,
    ownerUserId,
    lookupFailed: false,
  }) === "owner";
}

export async function authorizeFamilyAccountOwner(
  dependencies: FamilyAccountOwnerDependencies,
): Promise<SubjectLessonOwnerAuthorization> {
  let access: FamilyActorAccess | null;
  try {
    access = await dependencies.requireFamilyWithActor();
  } catch {
    return { status: "lookup_failed" };
  }
  if (!access?.memberUserId) return { status: "no_actor" };

  let owner: boolean;
  try {
    owner = await dependencies.isFamilyAccountOwner(
      access.family.id,
      access.memberUserId,
    );
  } catch {
    return { status: "lookup_failed" };
  }
  if (!owner) return { status: "non_owner" };
  return {
    status: "owner",
    familyId: access.family.id,
    memberUserId: access.memberUserId,
  };
}
