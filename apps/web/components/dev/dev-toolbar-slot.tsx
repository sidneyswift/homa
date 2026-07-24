import { mapDb } from "../../lib/map/db";
import { requireFamily } from "../../lib/map/session";
import { DevToolbar } from "./dev-toolbar";

/**
 * The gate in front of the dev badge.
 *
 * A server component so the decision is made where the environment
 * actually is: production never even ships the client component,
 * because this returns null before importing anything about it.
 *
 * The same two conditions the reset route itself checks, restated here
 * rather than imported from it, because a route file is a request
 * handler and importing one into the layout drags its whole module
 * graph into every page render.
 */

function devTestSessionsEnabled(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  const value = (process.env.HOMA_DEV_TEST_SESSIONS ?? "").trim().toLowerCase();
  return value === "1" || value === "true";
}

export async function DevToolbarSlot() {
  if (!devTestSessionsEnabled()) return null;
  // A signed-out visitor has nothing to reset, and the badge would be
  // noise on the marketing pages.
  const family = await requireFamily().catch(() => null);
  if (!family) return null;
  // Real families never get a reset button, even locally. The route
  // refuses them anyway; not offering is the better half of that.
  // Its own one-column read rather than widening the shared FamilyRow,
  // which every map route selects on every request in production.
  const rows = await mapDb()<{ sandbox: boolean }[]>`
    select sandbox from public.families where id = ${family.id}
  `;
  if (!rows[0]?.sandbox) return null;
  return <DevToolbar familyId={family.id} />;
}
