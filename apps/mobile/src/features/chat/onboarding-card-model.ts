import {
  buildMapQuestionQueue,
  planQuestions,
  type MapAnswer,
  type MapItem,
} from "@homa/core";
import type { EveMessage, EveMessagePart } from "eve/react";

export interface ChecklistCardData {
  childId: string;
  childName: string;
  answered: number;
  remaining: number;
  minutesLeft: number;
  resumed: boolean;
}

export interface DetailCardData {
  kind: "family_basics" | "child" | "homeschool_profile";
  intro: string | null;
}

export interface ReportCardData {
  childId: string;
  childName: string;
  token: string;
  answered: number;
  skipped: number;
  mappedSubjects: number;
  totalSubjects: number;
  strengths: string[];
  alreadyScored: boolean;
}

export interface MapStateChild {
  id: string;
  name: string;
  ageMonths: number;
  inRange: boolean;
  reportToken: string | null;
  answered: number;
  interests: string[];
  helpWith: string | null;
  answers: { itemId: string; answer: MapAnswer }[];
}

export interface ChecklistPosition {
  answered: number;
  remaining: number;
  minutesLeft: number;
  complete: boolean;
  currentItem: MapItem | null;
}

const DETAIL_KINDS = new Set<DetailCardData["kind"]>([
  "family_basics",
  "child",
  "homeschool_profile",
]);

const SECONDS_PER_QUESTION = 18;

export function parseChecklistCardPart(
  part: EveMessagePart,
): ChecklistCardData | null {
  if (
    part.type !== "dynamic-tool"
    || part.toolName !== "start_checklist"
    || part.state !== "output-available"
  ) {
    return null;
  }
  const output = (part.output ?? {}) as Record<string, unknown>;
  if (
    output.started !== true
    || typeof output.childId !== "string"
    || typeof output.childName !== "string"
  ) {
    return null;
  }
  return {
    childId: output.childId,
    childName: output.childName,
    answered: typeof output.answered === "number" ? output.answered : 0,
    remaining: typeof output.remaining === "number" ? output.remaining : 0,
    minutesLeft: typeof output.minutesLeft === "number" ? output.minutesLeft : 1,
    resumed: output.resumed === true,
  };
}

export function parseDetailCardPart(part: EveMessagePart): DetailCardData | null {
  if (
    part.type !== "dynamic-tool"
    || part.toolName !== "ask_for_details"
    || part.state !== "output-available"
  ) {
    return null;
  }
  const output = (part.output ?? {}) as Record<string, unknown>;
  if (output.asked !== true || !DETAIL_KINDS.has(output.kind as DetailCardData["kind"])) {
    return null;
  }
  return {
    kind: output.kind as DetailCardData["kind"],
    intro: typeof output.intro === "string" ? output.intro : null,
  };
}

export function parseReportCardPart(part: EveMessagePart): ReportCardData | null {
  if (
    part.type !== "dynamic-tool"
    || part.toolName !== "score_child_report"
    || part.state !== "output-available"
  ) {
    return null;
  }
  const output = (part.output ?? {}) as Record<string, unknown>;
  if (
    output.scored !== true
    || typeof output.childId !== "string"
    || typeof output.childName !== "string"
    || typeof output.token !== "string"
  ) {
    return null;
  }
  return {
    childId: output.childId,
    childName: output.childName,
    token: output.token,
    answered: typeof output.answered === "number" ? output.answered : 0,
    skipped: typeof output.skipped === "number" ? output.skipped : 0,
    mappedSubjects:
      typeof output.mappedSubjects === "number" ? output.mappedSubjects : 0,
    totalSubjects:
      typeof output.totalSubjects === "number" ? output.totalSubjects : 0,
    strengths: Array.isArray(output.strengths)
      ? output.strengths.filter((value): value is string => typeof value === "string")
      : [],
    alreadyScored: output.alreadyScored === true,
  };
}

export interface ActiveOnboardingCard<T> {
  message: EveMessage;
  partKey: string;
  card: T;
}

function latestCard<T>(
  messages: readonly EveMessage[],
  parse: (part: EveMessagePart) => T | null,
): ActiveOnboardingCard<T> | null {
  let latest: ActiveOnboardingCard<T> | null = null;
  for (const message of messages) {
    if (message.role === "user") {
      latest = null;
      continue;
    }
    if (message.role !== "assistant") continue;
    for (const [partIndex, part] of message.parts.entries()) {
      const card = parse(part);
      if (card) latest = { message, partKey: `${message.id}:${partIndex}`, card };
    }
  }
  return latest;
}

export function latestChecklistRequest(messages: readonly EveMessage[]) {
  return latestCard(messages, parseChecklistCardPart);
}

export function latestDetailRequest(messages: readonly EveMessage[]) {
  return latestCard(messages, parseDetailCardPart);
}

export function latestReportReveal(messages: readonly EveMessage[]) {
  return latestCard(messages, parseReportCardPart);
}

export function checklistPositionFor(child: MapStateChild): ChecklistPosition {
  const answers = Object.fromEntries(
    child.answers.map((entry) => [entry.itemId, entry.answer]),
  );
  const queue = buildMapQuestionQueue(planQuestions(child.ageMonths), answers);
  return {
    answered: child.answered,
    remaining: queue.length,
    minutesLeft: Math.max(1, Math.ceil((queue.length * SECONDS_PER_QUESTION) / 60)),
    complete: child.answered > 0 && queue.length === 0,
    currentItem: queue[0]?.item ?? null,
  };
}

export function withChecklistAnswer(
  child: MapStateChild,
  itemId: string,
  answer: MapAnswer,
): MapStateChild {
  const answers = child.answers.filter((entry) => entry.itemId !== itemId);
  return {
    ...child,
    answered: answers.length + 1,
    answers: [...answers, { itemId, answer }],
  };
}

export function commaSeparatedValues(value: string): string[] {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function birthDateFromParts(input: {
  year: string;
  month: string;
  day: string;
}): string | null {
  const year = Number(input.year);
  const month = Number(input.month);
  const day = Number(input.day);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }
  const candidate = new Date(year, month - 1, day);
  if (
    candidate.getFullYear() !== year
    || candidate.getMonth() !== month - 1
    || candidate.getDate() !== day
    || candidate > new Date()
  ) {
    return null;
  }
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function spokenDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}
