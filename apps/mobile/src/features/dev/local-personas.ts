/**
 * The local stack's test parents (tooling/local-stack/README.md). One
 * roster, read by the dev-only picker (src/app/labs/personas.tsx) and by
 * the seed script that creates them (scripts/local-stack-personas.mts).
 *
 * These accounts exist only in the private Supabase on a developer's
 * Mac. The password is not a secret: it opens nothing anywhere else, and
 * the picker that uses it lives under src/app/labs/, which Metro blocks
 * from production bundles (metro.config.js). The product itself stays
 * passwordless; this file never ships.
 *
 * Every address carries +homatest, so even a family that somehow
 * reached production would be fenced as a test family.
 */

export const LOCAL_PERSONA_PASSWORD = "homa-local-persona";

export const LOCAL_PERSONA_IDS = ["new", "onboarding", "established"] as const;
export type LocalPersonaId = (typeof LOCAL_PERSONA_IDS)[number];

export interface LocalPersona {
  id: LocalPersonaId;
  label: string;
  detail: string;
  /** null: a brand-new address every time, so nothing to reset. */
  email: string | null;
}

export const LOCAL_PERSONAS: readonly LocalPersona[] = [
  {
    id: "new",
    label: "New parent",
    detail: "A brand-new account every tap. Starts on the first onboarding screen.",
    email: null,
  },
  {
    id: "onboarding",
    label: "Halfway through onboarding",
    detail: "Juno is added. Picks up on the parent screen, after the kids.",
    email: "onboarding+homatest@homa.test",
  },
  {
    id: "established",
    label: "Established family",
    detail: "Ada and Mateo, three months of hours, notes and memories.",
    email: "established+homatest@homa.test",
  },
];

export function isLocalPersonaId(value: unknown): value is LocalPersonaId {
  return (
    typeof value === "string" &&
    (LOCAL_PERSONA_IDS as readonly string[]).includes(value)
  );
}

/** A fresh address for the "new" persona; the stamp keeps each unique. */
export function freshNewParentEmail(now: number = Date.now()): string {
  return `new-${now.toString(36)}+homatest@homa.test`;
}

/** Matches every address freshNewParentEmail has ever produced. */
export const NEW_PARENT_EMAIL_PATTERN = /^new-[0-9a-z]+\+homatest@homa\.test$/u;
