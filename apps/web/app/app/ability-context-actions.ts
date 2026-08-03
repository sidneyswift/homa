"use server";

import { cookies } from "next/headers";
import { z } from "zod";

import { findAbilitiesExplorerAbility } from "../../lib/child-progress/abilities-explorer";
import {
  ABILITY_CONTEXT_COOKIE,
  encodeAbilityContext,
} from "../../lib/child-progress/ability-context";
import { getMyChildren, getMyFamily } from "../../lib/family";

const CHILD_ID_SCHEMA = z.uuid();

/**
 * Stores a short-lived focus hint for the next Homa turn. Both ids are
 * checked against server-owned data here, and family-context checks them
 * again when Eve hydrates the turn, so a forged cookie cannot grant access
 * to another family's progress.
 */
export async function setAbilityContextAction(
  childId: string,
  abilityId: string,
): Promise<boolean> {
  const parsedChildId = CHILD_ID_SCHEMA.safeParse(childId);
  if (!parsedChildId.success || typeof abilityId !== "string") return false;
  if (abilityId.length === 0 || abilityId.length > 240) return false;

  try {
    const family = await getMyFamily();
    if (!family) return false;
    const children = await getMyChildren(family.id);
    if (!children.some((child) => child.id === parsedChildId.data)) return false;
    if (!findAbilitiesExplorerAbility(abilityId)) return false;

    const cookieStore = await cookies();
    cookieStore.set(
      ABILITY_CONTEXT_COOKIE,
      encodeAbilityContext({
        childId: parsedChildId.data,
        abilityId,
      }),
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 5,
      },
    );
    return true;
  } catch (error) {
    console.error(
      "setAbilityContextAction failed:",
      error instanceof Error ? error.message : "unknown",
    );
    return false;
  }
}
