/**
 * The native first making's job title and plan (mobile onboarding v1
 * wave 3), built deterministically from the kid card's saved answers.
 * The mobile making route enqueues this; the background-making eval
 * seeds the exact same plan, so the eval's build session reads the brief
 * production writes instead of a hand-copied paraphrase of it.
 */

export interface MobileFirstMakingChild {
  id: string;
  name: string;
  birth_month: string | null;
  profile: { interests?: string[]; focus?: string } | null;
}

export interface MobileFirstMakingJob {
  title: string;
  plan: {
    request: string;
    theme?: string;
    kind: "worksheet";
    childName: string;
  };
}

export function ageFromBirthDate(
  birthDate: string | null,
  now: Date = new Date(),
): number | null {
  if (!birthDate) return null;
  const parsed = new Date(birthDate);
  if (Number.isNaN(parsed.getTime())) return null;
  let age = now.getUTCFullYear() - parsed.getUTCFullYear();
  const monthDelta = now.getUTCMonth() - parsed.getUTCMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getUTCDate() < parsed.getUTCDate())) {
    age -= 1;
  }
  return age >= 0 && age <= 21 ? age : null;
}

export function mobileFirstMakingJob(
  child: MobileFirstMakingChild,
  now: Date = new Date(),
): MobileFirstMakingJob {
  const theme = child.profile?.interests?.[0]?.trim() || null;
  const focus = child.profile?.focus?.trim() || null;
  const age = ageFromBirthDate(child.birth_month, now);

  const title = theme
    ? `${child.name}'s ${theme} page`.slice(0, 90)
    : `${child.name}'s first page`.slice(0, 90);
  const request = [
    `One printable page for ${child.name}${age !== null ? `, age ${age}` : ""}.`,
    theme ? `${child.name} loves ${theme}; let that carry the whole page.` : null,
    focus ? `They are working on ${focus}; land the practice right at that edge.` : null,
    "This is the family's very first making from mobile onboarding: one page, print-ready, pitched exactly to this child.",
    // Two kids can share a name (it happened live, 2026-08-21: a
    // 10-year-old's brief lost to a same-named 3-year-old from family
    // context and got a preschool letters page). The facts above are
    // the child; family context never overrides them.
    `If your family context lists another child named ${child.name}, ignore that child entirely: the age and focus in THIS brief are the child this page is for, and create_printable's childId must be ${child.id}.`,
  ]
    .filter(Boolean)
    .join(" ")
    .slice(0, 900);

  return {
    title,
    plan: {
      request,
      ...(theme ? { theme } : {}),
      kind: "worksheet",
      childName: child.name,
    },
  };
}
