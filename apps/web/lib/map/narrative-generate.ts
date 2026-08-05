import { generateObject } from "ai";
import { z } from "zod";

import type { PlanNarrative, ReportNarrative } from "@homa/core";

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

export async function generateReportNarrative(
  facts: ReportFacts,
  familyId: string | null = null,
): Promise<GenerationResult<ReportNarrative>> {
  const subjectIds = facts.subjects.map((subject) => subject.subjectId);
  const drawerIds = facts.subjects
    .filter((subject) => subject.position !== "not_mapped")
    .map((subject) => subject.subjectId);

  // The schema names every expected key explicitly, so a missing subject
  // line is a schema failure at generation time, not a surprise at render
  // (synthesis and keepsake retired round 2, founder ask 2026-07-09: the
  // report no longer renders either piece).
  const schema = z.object({
    note: z.string(),
    subjects: requiredStrings(subjectIds),
    drawers: requiredStrings(drawerIds),
  });

  const started = Date.now();
  const result = await generateObject({
    model: NARRATIVE_MODEL,
    system: systemPrompt(),
    prompt: [
      `Write ${facts.childName}'s progress report pieces from these facts, computed by code.`,
      "Every number you write must appear in the facts. Return the pieces described in your instructions.",
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
    value: result.object as ReportNarrative,
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
