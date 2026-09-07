export const ABILITY_CONTEXT_COOKIE = "homa-ability-context";

const MAX_COOKIE_VALUE = 512;

export interface AbilityContextCookieValue {
  childId: string;
  abilityId: string;
}

export function encodeAbilityContext(value: AbilityContextCookieValue): string {
  // Next encodes cookie values when serializing Set-Cookie. Encoding here too
  // turns the separator into %257C, which the Eve request parser cannot read.
  return `${value.childId}|${value.abilityId}`;
}

export function readAbilityContextCookie(
  cookieHeader: string | null,
): AbilityContextCookieValue | null {
  if (!cookieHeader) return null;
  const raw = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${ABILITY_CONTEXT_COOKIE}=`))
    ?.slice(ABILITY_CONTEXT_COOKIE.length + 1);
  if (!raw || raw.length > MAX_COOKIE_VALUE) return null;
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return null;
  }
  const separator = decoded.indexOf("|");
  if (separator <= 0 || separator === decoded.length - 1) return null;
  const childId = decoded.slice(0, separator);
  const abilityId = decoded.slice(separator + 1);
  if (childId.length > 80 || abilityId.length > 240) return null;
  return { childId, abilityId };
}
