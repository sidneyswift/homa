import { MAP_INTERESTS_CAP } from "@homa/core";

import { isProfileNonAnswer } from "../profile-quality";

type JsonObject = Record<string, unknown> | null | undefined;

export function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

export function uniqueStrings(...lists: string[][]): string[] {
  return [...new Set(lists.flat())];
}

export function profileInterestList(value: unknown): string[] {
  return stringList(value).filter((interest) => !isProfileNonAnswer(interest));
}

export function cleanProfileInterests(value: unknown): string[] {
  return profileInterestList(value).slice(0, MAP_INTERESTS_CAP);
}

export function profileHelpList(value: unknown): string[] {
  return stringList(value).filter((entry) => !isProfileNonAnswer(entry));
}

export function cleanProfileFocus(value: unknown): string | null {
  return typeof value === "string" && !isProfileNonAnswer(value) ? value : null;
}

export function profileFocusList(profile: JsonObject): string[] {
  const focus = cleanProfileFocus(profile?.focus);
  return focus ? [focus] : [];
}

export function firstFamilyStyle(context: JsonObject): string | undefined {
  const styles = stringList(context?.styles);
  return styles[0] ?? (typeof context?.style === "string" ? context.style : undefined);
}
