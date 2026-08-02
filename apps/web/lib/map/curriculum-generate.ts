import { readFileSync } from "node:fs";
import path from "node:path";

import { generateObject } from "ai";
import { z } from "zod";

import { buildFourWeekPlan, type Curriculum } from "@homa/core";

import { HOMA_MODEL } from "../../agent/model";
import { gatewayAttribution, recordModelUsage } from "../model-usage";
import type { ReportFacts } from "./narrative-facts";

/**
 * The model call that writes a "Call Homa" curriculum (founder decision
 * 2026-07-07): LLM-authored, whatever length Homa judges the family
 * needs, from the report's computed facts plus what was extracted from
 * the review call. Same generateObject/gateway posture as
 * narrative-generate.ts's report writer, different system prompt
 * (agent/curriculum-writer.md): a curriculum proposes NEW activities and
 * materials, it does not restate computed facts, so there is no fixed
 * numeric-citation contract here.
 */

export interface CallFacts {
  subjectsDiscussed: string[];
  concerns: string[];
  interestsConfirmed: string[];
  goals: string[];
  parentRequests: string[];
  callSummary: string;
}

export interface CurriculumGenerationResult {
  value: Curriculum;
  durationMs: number;
  tokensIn: number;
  tokensOut: number;
  model: string;
}

let cachedSystemPrompt: string | null = null;

/** agent/curriculum-writer.md; cwd is apps/web under the Next server. */
function systemPrompt(): string {
  if (cachedSystemPrompt) return cachedSystemPrompt;
  cachedSystemPrompt = readFileSync(
    path.join(process.cwd(), "agent", "curriculum-writer.md"),
    "utf8",
  );
  return cachedSystemPrompt;
}

const curriculumSchema = z.object({
  title: z.string(),
  durationLabel: z.string(),
  overview: z.string(),
  subjects: z
    .array(
      z.object({
        subjectName: z.string(),
        approach: z.string(),
        weeks: z
          .array(
            z.object({
              theme: z.string(),
              focus: z.string(),
              activities: z.array(z.string()).min(2).max(4),
              materials: z.array(z.string()),
            }),
          )
          .min(1)
          .max(8),
      }),
    )
    .min(1)
    .max(6),
  materialsList: z.array(z.string()),
  parentNote: z.string(),
});

export async function generateCurriculum(
  report: ReportFacts,
  call: CallFacts,
  familyId: string | null = null,
  curriculumId: string = familyId ?? "fleet-curriculum-fixture",
): Promise<CurriculumGenerationResult> {
  const started = Date.now();
  const result = await generateObject({
    model: HOMA_MODEL,
    system: systemPrompt(),
    prompt: [
      `Write ${report.childName}'s curriculum from these facts.`,
      `<report_facts>${JSON.stringify(report)}</report_facts>`,
      `<call_facts>${JSON.stringify(call)}</call_facts>`,
    ].join("\n\n"),
    schema: curriculumSchema,
    maxOutputTokens: 16000,
    maxRetries: 1,
    providerOptions: {
      gateway: {
        disallowPromptTraining: true,
        ...gatewayAttribution(familyId, "curriculum"),
      },
    },
  });

  await recordModelUsage({
    familyId,
    surface: "curriculum",
    model: HOMA_MODEL,
    modality: "text",
    inputTokens: result.usage.inputTokens,
    outputTokens: result.usage.outputTokens,
    durationMs: Date.now() - started,
    resourceKind: "curriculum",
    resourceId: curriculumId,
  });

  return {
    value: result.object,
    durationMs: Date.now() - started,
    tokensIn: result.usage.inputTokens ?? 0,
    tokensOut: result.usage.outputTokens ?? 0,
    model: HOMA_MODEL,
  };
}

/**
 * The safety net when generation fails validation twice: wraps the
 * existing deterministic four-week plan (packages/core/src/map/plans.ts)
 * for whichever subject the call actually discussed, so a family never
 * gets nothing just because the freer LLM content tripped a brand law.
 */
export function fallbackCurriculum(
  report: ReportFacts,
  call: CallFacts,
): Curriculum {
  const subjectName = call.subjectsDiscussed[0] ?? report.subjects[0]?.subjectName ?? "Learning";
  const subject = report.subjects.find((entry) => entry.subjectName === subjectName);
  const plan =
    subject &&
    buildFourWeekPlan(subject.subjectId, report.childAgeMonths, [], {
      interests: report.interests,
    });

  const weeks = plan
    ? plan.weeks.map((week) => ({
        theme: `Week ${week.week}`,
        focus: week.focus,
        activities: week.activities,
        materials: [],
      }))
    : [
        {
          theme: "Week 1",
          focus: "Getting started",
          activities: ["A short, warm practice session together"],
          materials: [],
        },
      ];

  return {
    title: `${report.childName}'s ${subjectName.toLowerCase()} month`,
    durationLabel: "4 weeks",
    overview: `A starting plan aimed at ${subjectName.toLowerCase()}, built from your call with Homa.`,
    subjects: [{ subjectName, approach: plan?.startingLine ?? "Starting fresh, together.", weeks }],
    materialsList: [],
    parentNote: "This is a starting point. Text or call anytime to build on it together.",
  };
}
