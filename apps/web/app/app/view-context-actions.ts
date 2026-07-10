"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { getMyChildren, getMyFamily } from "../../lib/family";
import { VIEW_CONTEXT_COOKIE, VIEW_CONTEXT_FAMILY } from "../../lib/view-context";

/**
 * The context switcher's one write: remember who the parent is viewing.
 * The target is validated against the caller's OWN children (RLS reads,
 * never client trust) before anything is stored; a foreign or unknown id
 * is a silent no-op, the same posture as every other id that arrives
 * from a client. httpOnly because no client code ever reads the cookie:
 * the UI learns the selection from server props, and the eve channel
 * reads it server-side off the request.
 */
export async function setViewContextAction(target: string): Promise<void> {
  if (typeof target !== "string" || target.length === 0 || target.length > 64) return;

  if (target !== VIEW_CONTEXT_FAMILY) {
    const family = await getMyFamily();
    if (!family) return;
    const children = await getMyChildren(family.id);
    if (!children.some((child) => child.id === target)) return;
  }

  const cookieStore = await cookies();
  cookieStore.set(VIEW_CONTEXT_COOKIE, target, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  // Every /app surface reads the selection (report resolver, planner
  // filter, chat focus chip), and they all share the layout segment.
  revalidatePath("/app", "layout");
}
