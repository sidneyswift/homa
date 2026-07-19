import type { Metadata } from "next";

import { scoreMap } from "@homa/core";

import type { TrajectoryEra } from "../../../lib/map/trajectory-eras";
import { subjectLessonsEnabled } from "../../../lib/subject-lessons/flag";
import { ReportView, type ReportViewData } from "../r/[token]/report-view";
import { SAMPLE_NARRATIVE } from "./narrative.fixture";
import { SAMPLE_AGE_MONTHS, SAMPLE_ANSWERS, SAMPLE_PRIOR_ANSWERS } from "./sample-answers";

/**
 * /onboarding/sample: the public sample report. Skeptics get to inspect the exact
 * artifact before giving an email (the sample IS the ad). Rendered through
 * the real ReportView with clearly labeled demonstration data: Maya, 4y2m,
 * a warm mixed profile with one visible month of movement. The narrative is
 * the committed, founder-reviewed fixture (generated once by
 * scripts/map-narrative-fixtures.mts); this page NEVER makes a model call.
 * Answers are pinned item ids (sample-answers.ts), so bank growth can
 * never silently change the numbers the reviewed narrative talks about.
 */

export const metadata: Metadata = {
  title: "Sample progress report",
  description:
    "A sample of the free progress report: strengths first, national benchmarks for every subject, and a plan for whatever is growing.",
  alternates: { canonical: "/onboarding/sample" },
};

/** Maya's birth month, pinned so the sample always reads 4y 2m. */
function sampleBirthMonth(): string {
  const now = new Date();
  const born = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - SAMPLE_AGE_MONTHS, 1));
  return `${born.getUTCFullYear()}-${String(born.getUTCMonth() + 1).padStart(2, "0")}`;
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
  const lessonFlagOn = subjectLessonsEnabled();
  const birthMonth = sampleBirthMonth();
  const ageMonths = SAMPLE_AGE_MONTHS;
  const answers = SAMPLE_ANSWERS;
  const scores = scoreMap(ageMonths, answers);

  // One month of visible movement: last month self-care hadn't started
  // moving and math was one rung lower. Honest theater, labeled as sample.
  const priorScores = scoreMap(ageMonths, SAMPLE_PRIOR_ANSWERS);
  const monthAgo = new Date();
  monthAgo.setDate(monthAgo.getDate() - 28);

  // Both sample scorings are computed right here under one bank and one
  // scorer, so the eras declare one shared basis: the demonstration
  // chart must never grow a "we changed how we measure" boundary.
  const generatedAt = new Date().toISOString();
  const eras: TrajectoryEra[] = [
    {
      generated_at: monthAgo.toISOString(),
      scores: priorScores,
      renormalized: false,
      basisKey: "sample",
    },
    {
      generated_at: generatedAt,
      scores,
      renormalized: false,
      basisKey: "sample",
    },
  ];

  const data: ReportViewData = {
    token: "sample",
    scores,
    bankVersion: "sample",
    generatedAt,
    childName: "Maya",
    birthMonth,
    parentFirstName: "Sarah",
    usState: "TX",
    familyId: "00000000-0000-0000-0000-000000000000",
    childId: "00000000-0000-0000-0000-000000000000",
    answers: answers.map((entry) => ({ itemId: entry.itemId, answer: entry.answer })),
    history: [{ scores: priorScores, generated_at: monthAgo.toISOString() }],
    eras,
    otherKids: [],
    plans: [],
    familyPhone: null,
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
        subjectLessonsEnabled={lessonFlagOn}
      />
    </>
  );
}
