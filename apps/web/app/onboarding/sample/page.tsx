import type { Metadata } from "next";

import { planQuestions, scoreMap, type MapAnswer, type MapAnswerInput } from "@homa/core";

import { ReportView, type ReportViewData } from "../r/[token]/report-view";
import { SAMPLE_NARRATIVE } from "./narrative.fixture";

/**
 * /onboarding/sample: the public sample report. Skeptics get to inspect the exact
 * artifact before giving an email (the sample IS the ad). Rendered through
 * the real ReportView with clearly labeled demonstration data: Maya, 4y2m,
 * a warm mixed profile with one visible month of movement. The narrative is
 * the committed, founder-reviewed fixture (generated once by
 * scripts/map-narrative-fixtures.mts); this page NEVER makes a model call.
 */

export const metadata: Metadata = {
  title: "Sample progress report",
  description:
    "A sample of the free progress report: strengths first, national benchmarks behind every subject, and a plan for whatever is growing.",
  alternates: { canonical: "/onboarding/sample" },
};

/** Maya's birth month, pinned so the sample always reads 4y 2m. */
function sampleBirthMonth(): string {
  const now = new Date();
  const born = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 50, 1));
  return `${born.getUTCFullYear()}-${String(born.getUTCMonth() + 1).padStart(2, "0")}`;
}

function sampleAnswers(ageMonths: number): MapAnswerInput[] {
  const byDomain: Record<string, MapAnswer | [MapAnswer, MapAnswer]> = {
    language: ["easily", "easily"],
    phonics: ["easily", "easily"],
    science: ["easily", "easily"],
    social_emotional: ["easily", "easily"],
    math: ["easily", "getting_there"],
    literacy: ["easily", "not_yet"],
    music: "easily",
    social_studies: "easily",
    art: "easily",
    gross_motor: "easily",
    executive_function: "easily",
    spanish: "skip",
    self_care: "getting_there",
    fine_motor: "not_yet",
    writing: "not_sure",
  };

  const answers: MapAnswerInput[] = [];
  for (const plan of planQuestions(ageMonths)) {
    const spec = byDomain[plan.domainId] ?? "easily";
    const [base, ladder] = Array.isArray(spec) ? spec : [spec, null];
    answers.push({ itemId: plan.base.id, answer: base });
    if (base !== "easily" || !ladder) continue;
    // Climb the whole ladder while the spec says "easily", exactly like a
    // strong subject would in the real flow.
    for (const rung of plan.ladders) {
      answers.push({ itemId: rung.id, answer: ladder });
      if (ladder !== "easily") break;
    }
  }
  return answers;
}

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: "https://thankshoma.com" },
    {
      "@type": "ListItem",
      position: 2,
      name: "Sample progress report",
      item: "https://thankshoma.com/onboarding/sample",
    },
  ],
};

export default function SampleReportPage() {
  const birthMonth = sampleBirthMonth();
  const ageMonths = 50;
  const answers = sampleAnswers(ageMonths);
  const scores = scoreMap(ageMonths, answers);

  // One month of visible movement: last month fine motor hadn't started
  // moving and math was one rung lower. Honest theater, labeled as sample.
  const priorAnswers = answers
    .filter((entry) => !entry.itemId.startsWith("math.") || answers.indexOf(entry) < 2)
    .map((entry) =>
      entry.itemId.startsWith("self_care.") ? { ...entry, answer: "not_yet" as MapAnswer } : entry,
    );
  const priorScores = scoreMap(ageMonths, priorAnswers);
  const monthAgo = new Date();
  monthAgo.setDate(monthAgo.getDate() - 28);

  const data: ReportViewData = {
    token: "sample",
    scores,
    bankVersion: "sample",
    generatedAt: new Date().toISOString(),
    childName: "Maya",
    birthMonth,
    parentFirstName: "Sarah",
    usState: "TX",
    leadId: "00000000-0000-0000-0000-000000000000",
    childId: "00000000-0000-0000-0000-000000000000",
    answers: answers.map((entry) => ({ itemId: entry.itemId, answer: entry.answer })),
    history: [{ scores: priorScores, generated_at: monthAgo.toISOString() }],
    otherKids: [],
    plans: [],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd).replace(/</g, "\\u003c") }}
      />
      <ReportView
        data={data}
        sample
        narrativeView={{ narrative: SAMPLE_NARRATIVE, rejectedPieces: [] }}
      />
    </>
  );
}
