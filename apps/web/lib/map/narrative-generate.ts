import { generateObject } from "ai";
import { z } from "zod";

import { skillPhrase, type PlanNarrative, type ReportNarrative } from "@homa/core";

import { HOMA_MODEL } from "../../agent/model";
import { REPORT_PROMPT_VERSION } from "../../agent/report-writer-version";
import { gatewayAttribution, recordModelUsage } from "../model-usage";
import type { PlanFacts, ReportFacts } from "./narrative-facts";
import { REPORT_WRITER_PROMPT } from "./report-writer-prompt.generated";

/**
 * The model call that writes the report's words (D8 overturn). One
 * generateObject per report (and per plan), through the Vercel AI Gateway:
 * deployed, the gateway authenticates via the Vercel project (the same way
 * eve chat already does); locally it reads the Vercel OIDC token from
 * .env.local. disallowPromptTraining applies the provider's per-call
 * training control without expanding Homa's public privacy promise.
 *
 * No timeout and no retry cap beyond one internal transport retry
 * (founder ruling: "let the agent do its thing"; quality over speed).
 */

export const NARRATIVE_MODEL = HOMA_MODEL;

export interface GenerationResult<T> {
  value: T;
  durationMs: number;
  tokensIn: number;
  tokensOut: number;
  promptVersion: string;
  model: string;
}

function systemPrompt(): string {
  return REPORT_WRITER_PROMPT;
}

function requiredStrings(ids: string[]): z.ZodObject<Record<string, z.ZodString>> {
  return z.object(Object.fromEntries(ids.map((id) => [id, z.string()])));
}

const reportDraftDrawer = z.object({
  activity: z.string().nullable().optional(),
  materials: z.string().nullable().optional(),
});

function sentence(text: string): string {
  return text.trim().replace(/[.?!]+$/u, "");
}

function normalized(text: string): string {
  return sentence(text).toLowerCase().replace(/\s+/gu, " ");
}

function firstJsonObject(value: string): unknown {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') inString = true;
    else if (character === "{") depth += 1;
    else if (character === "}") {
      depth -= 1;
      if (depth === 0) return JSON.parse(value.slice(0, index + 1));
    }
  }
  return JSON.parse(value);
}

function isSingleActivity(activity: string): boolean {
  return !/\b(?:and|then|after that|followed by|bridging|to practice|bear crawl|crab walk|frog jump)\b/iu.test(activity);
}

/**
 * Preserve the skill while removing the two deficit constructions that the
 * report copy gate found in real model drafts. These are exact presentation
 * repairs, not semantic routing or scoring decisions.
 */
function parentSafePhrase(text: string): string {
  return text
    .replace(/\bcounts? past 20 without getting stuck\b/giu, "counts past 20")
    .replace(/\bwaits? a short turn without falling apart(?:\s*\([^)]*\)|,?\s*(?:with|even with) support)?/giu, "takes a short turn with support")
    .replace(/\buses? the toilet during the day,?\s*with only (?:the )?occasional miss(?:es)?\b/giu, "uses the toilet during the day")
    .replace(/\bWITH\b/gu, "with");
}

function reportSkillPhrase(text: string): string {
  return skillPhrase(text).replace(
    /\bstringing large beads or threads laces\b/giu,
    "stringing large beads or threading laces",
  );
}

function nextSkillInvitation(childName: string, text: string): string {
  if (/^tells you\b/iu.test(text)) {
    return `Try asking ${childName} to ${text.replace(/^tells\b/iu, "tell")}`;
  }
  return `Try ${reportSkillPhrase(text)}`;
}

function draftSchema(drawerIds: string[]) {
  return z.object({
    noteFacts: z.array(z.string()).max(2),
    drawers: z.object(
      Object.fromEntries(drawerIds.map((id) => [id, reportDraftDrawer.optional()])),
    ),
  });
}

function reportParametersSchema(drawerIds: string[]) {
  const parameters = draftSchema(drawerIds);
  return z.union([
    parameters,
    z.string().transform((value) => parameters.parse(firstJsonObject(value))),
  ]);
}

function formatReportNarrative(
  facts: ReportFacts,
  draft: z.infer<ReturnType<typeof draftSchema>>,
): ReportNarrative {
  const noteFacts = draft.noteFacts
    .map((fact) => sentence(parentSafePhrase(fact)))
    .filter(Boolean)
    .slice(0, 2);
  const note = noteFacts.length > 0
    ? noteFacts.map((fact) => `${facts.childName} ${fact}.`).join(" ")
    : "Thanks for sharing what you are seeing at home.";
  const subjects: Record<string, string> = {};
  const drawers: Record<string, string> = {};

  for (const subject of facts.subjects) {
    const confirmedSkill = subject.confirmedSkill
      ? sentence(parentSafePhrase(subject.confirmedSkill))
      : null;
    const nextSkill = subject.nextStep
      ? sentence(parentSafePhrase(subject.nextStep))
      : null;
    subjects[subject.subjectId] = subject.position === "not_mapped"
      ? nextSkill
        ? `${subject.subjectName} is not mapped yet. ${nextSkillInvitation(facts.childName, nextSkill)}.`
        : `${subject.subjectName} is not mapped yet.`
      : confirmedSkill
        ? `${facts.childName} ${confirmedSkill.charAt(0).toLowerCase()}${confirmedSkill.slice(1)}.`
        : nextSkill
          ? `${nextSkillInvitation(facts.childName, nextSkill)}.`
          : `Try ${subject.subjectName.toLowerCase()} together.`;
  }

  for (const subject of facts.subjects) {
    if (subject.position === "not_mapped") continue;
    const drafted = draft.drawers[subject.subjectId];
    if (!drafted?.activity) continue;
    const activity = sentence(parentSafePhrase(drafted.activity));
    if (
      !activity
      || !isSingleActivity(activity)
      || normalized(activity) === normalized(subject.confirmedSkill ?? "")
      || normalized(activity) === normalized(subject.nextStep ?? "")
    ) {
      continue;
    }
    const rawMaterials = drafted?.materials ? sentence(drafted.materials) : "";
    const materials = /^(?:none(?: needed)?|no materials? needed)$/iu.test(rawMaterials)
      ? ""
      : rawMaterials;
    drawers[subject.subjectId] = materials
      ? `Try this: ${activity}. Use ${materials}.`
      : `Try this: ${activity}.`;
  }

  return { note, subjects, drawers };
}

export async function generateReportNarrative(
  facts: ReportFacts,
  familyId: string | null = null,
): Promise<GenerationResult<ReportNarrative>> {
  const drawerIds = facts.subjects
    .filter((subject) => subject.position !== "not_mapped")
    .map((subject) => subject.subjectId);

  // The schema names every optional drawer key explicitly. Subject lines are
  // deterministic map facts, so a model omission cannot create a blank card.
  const schema = z.object({
    parameters: reportParametersSchema(drawerIds),
  });

  const started = Date.now();
  const result = await generateObject({
    model: NARRATIVE_MODEL,
    system: systemPrompt(),
    prompt: [
      `Write ${facts.childName}'s progress report pieces from these facts, computed by code.`,
      "Every number you write must appear in the facts. Return the structured draft described in your instructions.",
      `<facts>${JSON.stringify(facts)}</facts>`,
    ].join("\n\n"),
    schema,
    // Sixteen subject lines plus sixteen drawers runs 3k to 7k tokens
    // observed; a deep-dive-enriched report cleared 8k and truncated
    // mid-JSON (seen live 2026-07-07), so the ceiling sits far above the
    // fattest real report. Cost is per token USED, not per cap.
    maxOutputTokens: 16000,
    maxRetries: 1,
    providerOptions: {
      gateway: {
        disallowPromptTraining: true,
        ...gatewayAttribution(familyId, "report_narrative"),
      },
    },
  });

  await recordModelUsage({
    familyId,
    surface: "report_narrative",
    model: NARRATIVE_MODEL,
    modality: "text",
    inputTokens: result.usage.inputTokens,
    outputTokens: result.usage.outputTokens,
    durationMs: Date.now() - started,
  });

  return {
    value: formatReportNarrative(facts, result.object.parameters),
    durationMs: Date.now() - started,
    tokensIn: result.usage.inputTokens ?? 0,
    tokensOut: result.usage.outputTokens ?? 0,
    promptVersion: REPORT_PROMPT_VERSION,
    model: NARRATIVE_MODEL,
  };
}

export async function generatePlanNarrative(
  facts: PlanFacts,
  familyId: string | null = null,
): Promise<GenerationResult<PlanNarrative>> {
  const schema = z.object({
    intro: z.string(),
    weeks: z.array(z.string()).length(4),
    closing: z.string(),
  });

  const started = Date.now();
  const result = await generateObject({
    model: NARRATIVE_MODEL,
    system: systemPrompt(),
    prompt: [
      `Write the four-week plan pieces for ${facts.childName}'s ${facts.subjectName} month from these facts, computed by code.`,
      "Every number you write must appear in the facts. Return intro, exactly 4 week lines, and closing.",
      `<facts>${JSON.stringify(facts)}</facts>`,
    ].join("\n\n"),
    schema,
    maxOutputTokens: 8000,
    maxRetries: 1,
    providerOptions: {
      gateway: {
        disallowPromptTraining: true,
        ...gatewayAttribution(familyId, "plan_narrative"),
      },
    },
  });

  await recordModelUsage({
    familyId,
    surface: "plan_narrative",
    model: NARRATIVE_MODEL,
    modality: "text",
    inputTokens: result.usage.inputTokens,
    outputTokens: result.usage.outputTokens,
    durationMs: Date.now() - started,
  });

  return {
    value: result.object as PlanNarrative,
    durationMs: Date.now() - started,
    tokensIn: result.usage.inputTokens ?? 0,
    tokensOut: result.usage.outputTokens ?? 0,
    promptVersion: REPORT_PROMPT_VERSION,
    model: NARRATIVE_MODEL,
  };
}
