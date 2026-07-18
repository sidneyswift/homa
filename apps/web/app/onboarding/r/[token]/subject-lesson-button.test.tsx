import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { scoreMap } from "@homa/core";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";

import { WALL_STALE_LESSON_LINE } from "../../../../components/billing/wall-copy";
import {
  SAMPLE_AGE_MONTHS,
  SAMPLE_ANSWERS,
} from "../../sample/sample-answers";
import { ReportView, type ReportViewData } from "./report-view";

const CHILD_ID = "11111111-1111-4111-8111-111111111111";
const REPORT_TOKEN = "report-token";
const ROUTER = {
  back() {},
  forward() {},
  refresh() {},
  hmrRefresh() {},
  push() {},
  replace() {},
  prefetch: async () => {},
};
const REPORT_VIEW_SOURCE = readFileSync(
  new URL("./report-view.tsx", import.meta.url),
  "utf8",
);
const GLOBALS_CSS_SOURCE = readFileSync(
  new URL("../../../globals.css", import.meta.url),
  "utf8",
);

function cssHexToken(name: string): string {
  const match = GLOBALS_CSS_SOURCE.match(
    new RegExp(`--${name}:\\s*#([0-9a-f]{6})`, "iu"),
  );
  assert.ok(match?.[1], `Expected CSS token --${name}`);
  return match[1];
}

function relativeLuminance(hex: string): number {
  const channels = hex.match(/../gu)?.map(
    (channel) => Number.parseInt(channel, 16) / 255,
  );
  assert.equal(channels?.length, 3);
  return channels.map((channel) =>
    channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4
  ).reduce(
    (sum, channel, index) =>
      sum + channel * [0.2126, 0.7152, 0.0722][index],
    0,
  );
}

function contrastRatio(first: string, second: string): number {
  const firstLuminance = relativeLuminance(first);
  const secondLuminance = relativeLuminance(second);
  return (
    (Math.max(firstLuminance, secondLuminance) + 0.05)
    / (Math.min(firstLuminance, secondLuminance) + 0.05)
  );
}

const SCORES = scoreMap(SAMPLE_AGE_MONTHS, SAMPLE_ANSWERS);
const ELIGIBLE_SUBJECT_IDS = SCORES.subjects
  .filter(
    (subject) =>
      !subject.exposureBased && subject.position !== "not_mapped",
  )
  .map((subject) => subject.subjectId);
assert.ok(ELIGIBLE_SUBJECT_IDS.length > 0);
const LESSON_SUBJECT_ID = ELIGIBLE_SUBJECT_IDS[0];
const EXPOSURE_SUBJECT_IDS = SCORES.subjects
  .filter((subject) => subject.exposureBased)
  .map((subject) => subject.subjectId);
const NOT_MAPPED_SUBJECT_IDS = SCORES.subjects
  .filter((subject) => subject.position === "not_mapped")
  .map((subject) => subject.subjectId);
assert.ok(EXPOSURE_SUBJECT_IDS.length > 0);
assert.ok(NOT_MAPPED_SUBJECT_IDS.length > 0);

const REPORT_DATA: ReportViewData = {
  token: REPORT_TOKEN,
  scores: SCORES,
  bankVersion: "test-bank",
  generatedAt: "2026-07-15T12:00:00.000Z",
  childName: "Maya",
  birthMonth: "2022-05-01",
  parentFirstName: "Sarah",
  usState: "TX",
  familyId: "22222222-2222-4222-8222-222222222222",
  childId: CHILD_ID,
  answers: SAMPLE_ANSWERS.map((entry) => ({
    itemId: entry.itemId,
    answer: entry.answer,
  })),
  history: [],
  eras: [
    {
      generated_at: "2026-07-15T12:00:00.000Z",
      scores: SCORES,
      renormalized: false,
      basisKey: "test",
    },
  ],
  otherKids: [],
  plans: [],
  familyPhone: null,
};

interface ReportRenderOptions {
  enabled: boolean;
  canBuild: boolean;
  mirror?: boolean;
  sample?: boolean;
  hasLesson?: boolean;
  lessonStatus?: "queued" | "running" | "ready" | "failed";
  lessonSubjectIds?: string[];
}

function renderReport(options: ReportRenderOptions): string {
  const lessonSubjectIds =
    options.lessonSubjectIds
    ?? (options.hasLesson ? [LESSON_SUBJECT_ID] : []);
  const subjectLessons = lessonSubjectIds.map((subjectId, index) => ({
    id: `33333333-3333-4333-8333-${String(index + 1).padStart(12, "0")}`,
    subjectId,
    buildStatus: options.lessonStatus ?? "ready",
  }));
  return renderToStaticMarkup(
    <AppRouterContext.Provider value={ROUTER}>
      <ReportView
        data={REPORT_DATA}
        mirror={options.mirror}
        sample={options.sample}
        subjectLessonsEnabled={options.enabled}
        subjectLessons={subjectLessons}
        viewerActions={{
          call: false,
          month: false,
          lesson: options.canBuild,
        }}
      />
    </AppRouterContext.Provider>,
  );
}

function subjectCardHtml(html: string, subjectId: string): string {
  const start = html.indexOf(`id="subject-${subjectId}"`);
  assert.ok(start >= 0);
  const next = html.indexOf("<details", start + 1);
  return html.slice(start, next >= 0 ? next : undefined);
}

type ButtonState =
  | "idle"
  | "busy"
  | "account-required"
  | "walled"
  | "failed";

interface SubjectLessonButtonModule {
  SUBJECT_LESSON_BUSY_LABEL: string;
  SUBJECT_LESSON_GENERIC_FAILURE: string;
  SUBJECT_LESSON_OWNER_DENIAL: string;
  SUBJECT_LESSON_INFO_NOTE_CLASS: string;
  SubjectLessonButton(props: {
    childId: string;
    subjectId: string;
    lessonUrl: string | null;
    wall: {
      monthlyUrl: string;
      annualUrl: string;
    } | null;
    emphasis: "primary" | "secondary";
  }): React.ReactNode;
  requestSubjectLessonBuild(
    childId: string,
    subjectId: string,
    request: (
      input: RequestInfo | URL,
      init?: RequestInit,
    ) => Promise<Response>,
  ): Promise<
    | { status: "opened"; url: string }
    | { status: "account-required" | "walled" | "failed" }
  >;
  runSubjectLessonBuildAction(
    input: {
      childId: string;
      subjectId: string;
      wall: {
        monthlyUrl: string;
        annualUrl: string;
      } | null;
    },
    dependencies: {
      beacon(input: {
        kind: "door_tap";
        door: "lesson";
        childId: string;
      }): void;
      openWall(): void;
      requestBuild(): Promise<
        | { status: "opened"; url: string }
        | { status: "account-required" | "walled" | "failed" }
      >;
      navigate(url: string): void;
      setState(state: ButtonState): void;
    },
  ): Promise<void>;
}

async function loadSubjectLessonButton(): Promise<SubjectLessonButtonModule> {
  return await import("./subject-lesson-button");
}

describe("retained report subject lesson actions", () => {
  it("keeps every legacy per-subject plan action while the flag is off", () => {
    const html = renderReport({
      enabled: false,
      canBuild: true,
      hasLesson: true,
    });

    assert.match(html, /Build the 4-week plan/u);
    assert.match(html, /door=plan|\/plan\//u);
    assert.doesNotMatch(html, /Build the next lesson|Open the lesson/u);
  });

  it("shows one strong primary lesson action on every eligible subject", () => {
    const html = renderReport({ enabled: true, canBuild: true });

    for (const subjectId of ELIGIBLE_SUBJECT_IDS) {
      const card = subjectCardHtml(html, subjectId);
      assert.match(
        card,
        /<button[^>]*bg-\[var\(--clay-700\)\][^>]*>Build the next lesson<\/button>/u,
      );
      assert.equal(
        (card.match(/Build the next lesson/gu) ?? []).length,
        1,
      );
      assert.doesNotMatch(card, /Open the lesson/u);
      assert.match(card, /Answer a few deeper questions/u);
    }
    assert.doesNotMatch(html, /Build the 4-week plan/u);
  });

  it("opens a target-current lesson as the same strong primary action", () => {
    const html = renderReport({
      enabled: true,
      canBuild: true,
      hasLesson: true,
      lessonStatus: "queued",
    });
    const card = subjectCardHtml(html, LESSON_SUBJECT_ID);

    assert.match(
      card,
      /<a[^>]*bg-\[var\(--clay-700\)\][^>]*>Open the lesson<\/a>/u,
    );
    assert.match(
      card,
      new RegExp(
        `/onboarding/r/${REPORT_TOKEN}/lesson/${LESSON_SUBJECT_ID}`,
        "u",
      ),
    );
    assert.doesNotMatch(card, /Build the next lesson/u);
  });

  it("shows no lesson action for exposure-based or not-mapped subjects", () => {
    const ineligibleSubjectIds = [
      ...EXPOSURE_SUBJECT_IDS,
      ...NOT_MAPPED_SUBJECT_IDS,
    ];
    const html = renderReport({
      enabled: true,
      canBuild: true,
      lessonSubjectIds: ineligibleSubjectIds,
    });

    for (const subjectId of ineligibleSubjectIds) {
      const card = subjectCardHtml(html, subjectId);
      assert.doesNotMatch(
        card,
        /Build the next lesson|Open the lesson/u,
      );
    }
  });

  it("keeps token viewers read-only and ready lessons readable", () => {
    const noLessonHtml = renderReport({
      enabled: true,
      canBuild: false,
    });
    assert.doesNotMatch(noLessonHtml, /Build the next lesson/u);

    const readyHtml = renderReport({
      enabled: true,
      canBuild: false,
      hasLesson: true,
    });
    assert.match(readyHtml, /Open the lesson/u);
    assert.doesNotMatch(readyHtml, /Build the next lesson/u);
  });

  it("keeps mirror actions inert with the matching label", () => {
    const buildHtml = renderReport({
      enabled: true,
      canBuild: false,
      mirror: true,
    });
    assert.match(buildHtml, /Build the next lesson/u);
    assert.match(buildHtml, /hers to tap/u);
    assert.doesNotMatch(buildHtml, /href="[^"]*lesson/u);

    const openHtml = renderReport({
      enabled: true,
      canBuild: false,
      mirror: true,
      hasLesson: true,
    });
    assert.match(openHtml, /Open the lesson/u);
    assert.match(openHtml, /hers to tap/u);
    assert.doesNotMatch(openHtml, /href="[^"]*lesson/u);
  });

  it("keeps the sample onboarding-bound and names lessons", () => {
    const html = renderReport({
      enabled: true,
      canBuild: false,
      sample: true,
    });

    assert.match(html, /href="\/onboarding"/u);
    assert.match(html, /Get your own report to build lessons/u);
    assert.doesNotMatch(html, /unlock plans|Build the 4-week plan/u);
  });

  it("leaves the whole-child month implementation in place", () => {
    assert.match(REPORT_VIEW_SOURCE, /MONTH_PLAN_SUBJECT/u);
    assert.match(REPORT_VIEW_SOURCE, /<MonthButton/u);
    assert.match(REPORT_VIEW_SOURCE, /monthOffered/u);
  });
});

describe("SubjectLessonButton", () => {
  it("renders an existing lesson as a 44px AA-safe primary link", async () => {
    const { SubjectLessonButton } = await loadSubjectLessonButton();
    const html = renderToStaticMarkup(
      <AppRouterContext.Provider value={ROUTER}>
        <SubjectLessonButton
          childId={CHILD_ID}
          subjectId="math"
          lessonUrl={`/onboarding/r/${REPORT_TOKEN}/lesson/math`}
          wall={null}
          emphasis="primary"
        />
      </AppRouterContext.Provider>,
    );

    assert.match(
      html,
      /<a[^>]*bg-\[var\(--clay-700\)\][^>]*hover:bg-\[var\(--clay-600\)\][^>]*>Open the lesson<\/a>/u,
    );
    assert.match(html, /min-h-11/u);
    assert.match(html, /focus-visible:shadow-\[var\(--shadow-focus\)\]/u);
    assert.doesNotMatch(html, /<button/u);
  });

  it("beacons before opening the preloaded wall and does not POST", async () => {
    const { runSubjectLessonBuildAction } =
      await loadSubjectLessonButton();
    const calls: string[] = [];

    await runSubjectLessonBuildAction(
      {
        childId: CHILD_ID,
        subjectId: "math",
        wall: {
          monthlyUrl: "https://example.com/monthly",
          annualUrl: "https://example.com/annual",
        },
      },
      {
        beacon: (input) =>
          calls.push(`beacon:${JSON.stringify(input)}`),
        openWall: () => calls.push("wall"),
        requestBuild: async () => {
          calls.push("post");
          return { status: "failed" };
        },
        navigate: () => calls.push("navigate"),
        setState: (state) => calls.push(`state:${state}`),
      },
    );

    assert.deepEqual(calls, [
      `beacon:${JSON.stringify({
        kind: "door_tap",
        door: "lesson",
        childId: CHILD_ID,
      })}`,
      "wall",
    ]);
  });

  it("POSTs the child and subject, then navigates only on success", async () => {
    const {
      requestSubjectLessonBuild,
      runSubjectLessonBuildAction,
    } = await loadSubjectLessonButton();
    let requestBody: unknown;
    const outcome = await requestSubjectLessonBuild(
      CHILD_ID,
      "math",
      async (input, init) => {
        assert.equal(input, "/api/map/subject-lesson/build");
        assert.equal(init?.method, "POST");
        requestBody = JSON.parse(String(init?.body));
        return Response.json({
          ok: true,
          url: `/onboarding/r/${REPORT_TOKEN}/lesson/math`,
        });
      },
    );
    assert.deepEqual(requestBody, {
      childId: CHILD_ID,
      subjectId: "math",
    });

    const calls: string[] = [];
    await runSubjectLessonBuildAction(
      { childId: CHILD_ID, subjectId: "math", wall: null },
      {
        beacon: (input) => calls.push(`beacon:${input.door}`),
        openWall: () => calls.push("wall"),
        requestBuild: async () => outcome,
        navigate: (url) => calls.push(`navigate:${url}`),
        setState: (state) => calls.push(`state:${state}`),
      },
    );
    assert.deepEqual(calls, [
      "beacon:lesson",
      "state:busy",
      `navigate:/onboarding/r/${REPORT_TOKEN}/lesson/math`,
    ]);
  });

  it("uses the accepted loading and failure copy", async () => {
    const buttonModule = await loadSubjectLessonButton();

    assert.equal(
      buttonModule.SUBJECT_LESSON_BUSY_LABEL,
      "Making the lesson...",
    );
    assert.equal(
      buttonModule.SUBJECT_LESSON_GENERIC_FAILURE,
      "Your report is safe. The lesson didn't start. You can try again.",
    );
    assert.equal(
      buttonModule.SUBJECT_LESSON_OWNER_DENIAL,
      "Your report is safe. This lesson can only be built from the account that created the report.",
    );
    assert.equal(
      WALL_STALE_LESSON_LINE,
      "Your report is safe. Refreshing this page will reopen the lesson option.",
    );
  });

  it("classifies owner denial and a stale wall separately", async () => {
    const { requestSubjectLessonBuild } =
      await loadSubjectLessonButton();
    const ownerDenied = await requestSubjectLessonBuild(
      CHILD_ID,
      "math",
      async () => Response.json({ ok: false }, { status: 403 }),
    );
    const staleWall = await requestSubjectLessonBuild(
      CHILD_ID,
      "math",
      async () =>
        Response.json(
          { ok: false, reason: "walled" },
          { status: 403 },
        ),
    );

    assert.deepEqual(ownerDenied, { status: "account-required" });
    assert.deepEqual(staleWall, { status: "walled" });
  });

  it("uses AA-safe text for info notes", async () => {
    const { SUBJECT_LESSON_INFO_NOTE_CLASS } =
      await loadSubjectLessonButton();

    assert.match(SUBJECT_LESSON_INFO_NOTE_CLASS, /text-strong/u);
    assert.match(
      SUBJECT_LESSON_INFO_NOTE_CLASS,
      /bg-\[var\(--info-soft\)\]/u,
    );
    assert.doesNotMatch(SUBJECT_LESSON_INFO_NOTE_CLASS, /sky-600/u);
    assert.ok(
      contrastRatio(
        cssHexToken("stone-900"),
        cssHexToken("sky-100"),
      ) >= 4.5,
    );
  });
});

describe("report lesson data wiring", () => {
  const MAP_STORE_SOURCE = readFileSync(
    new URL("../../../../lib/map/store.ts", import.meta.url),
    "utf8",
  );
  const SUBJECT_LESSON_STORE_SOURCE = readFileSync(
    new URL(
      "../../../../lib/subject-lessons/store.ts",
      import.meta.url,
    ),
    "utf8",
  );
  const SUMMARY_FILTER_SOURCE = readFileSync(
    new URL(
      "../../../../lib/subject-lessons/summary-filter.ts",
      import.meta.url,
    ),
    "utf8",
  );
  const TOKEN_PAGE_SOURCE = readFileSync(
    new URL("./page.tsx", import.meta.url),
    "utf8",
  );
  const APP_PAGE_SOURCE = readFileSync(
    new URL("../../../app/[childId]/report/page.tsx", import.meta.url),
    "utf8",
  );
  const MIRROR_PAGE_SOURCE = readFileSync(
    new URL(
      "../../../admin/families/[familyId]/report/[childId]/page.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const SAMPLE_PAGE_SOURCE = readFileSync(
    new URL("../../sample/page.tsx", import.meta.url),
    "utf8",
  );
  const SCORING_SOURCE = readFileSync(
    new URL("../../scoring-step.tsx", import.meta.url),
    "utf8",
  );
  const MAP_FLOW_SOURCE = readFileSync(
    new URL("../../map-flow.tsx", import.meta.url),
    "utf8",
  );

  it("checks the flag before the ready-only token summary query", () => {
    const functionStart = MAP_STORE_SOURCE.indexOf(
      "export async function listReadySubjectLessonSummariesByReportToken",
    );
    assert.ok(functionStart >= 0);
    const source = MAP_STORE_SOURCE.slice(functionStart);
    assert.ok(
      source.indexOf("if (!subjectLessonsEnabled()) return []")
        < source.indexOf("const sql = mapDb()"),
    );
    assert.match(source, /report\.token = \$\{token\}/u);
    assert.match(source, /lesson\.build_status = 'ready'/u);
  });

  it("matches owner and token summaries to the current target in one query", () => {
    const tokenStart = MAP_STORE_SOURCE.indexOf(
      "export async function listReadySubjectLessonSummariesByReportToken",
    );
    const tokenEnd = MAP_STORE_SOURCE.indexOf(
      "export async function getTrajectoryEvidence",
      tokenStart,
    );
    const tokenSource = MAP_STORE_SOURCE.slice(tokenStart, tokenEnd);
    const ownerStart = SUBJECT_LESSON_STORE_SOURCE.indexOf(
      "export async function listCurrentSubjectLessonSummaries",
    );
    const ownerEnd = SUBJECT_LESSON_STORE_SOURCE.indexOf(
      "export async function reapStaleSubjectLessons",
      ownerStart,
    );
    const ownerSource = SUBJECT_LESSON_STORE_SOURCE.slice(
      ownerStart,
      ownerEnd,
    );

    for (const source of [tokenSource, ownerSource]) {
      assert.match(source, /source_fingerprint/u);
      assert.match(source, /public\.child_answers/u);
      assert.match(source, /birth_date/u);
      assert.match(
        source,
        /filterSubjectLessonSummariesForCurrentTargets/u,
      );
      assert.equal((source.match(/await sql</gu) ?? []).length, 1);
    }
    assert.match(SUMMARY_FILTER_SOURCE, /selectSubjectLessonTarget/u);
    assert.match(SUMMARY_FILTER_SOURCE, /lessonSourceFingerprint/u);
  });

  it("uses owner-scoped summaries and ready-only token fallback", () => {
    for (const source of [TOKEN_PAGE_SOURCE, APP_PAGE_SOURCE]) {
      assert.match(source, /listCurrentSubjectLessonSummaries/u);
      assert.match(
        source,
        /listReadySubjectLessonSummariesByReportToken/u,
      );
      assert.match(source, /isFamilyAccountOwner/u);
      assert.match(source, /viewerActions=\{\{/u);
      assert.match(source, /lesson:/u);
    }
  });

  it("updates mirror and sample without granting build access", () => {
    assert.match(
      MIRROR_PAGE_SOURCE,
      /listCurrentSubjectLessonSummaries/u,
    );
    assert.match(MIRROR_PAGE_SOURCE, /subjectLessonsEnabled=/u);
    assert.doesNotMatch(
      MIRROR_PAGE_SOURCE,
      /viewerActions=\{\{[^}]*lesson:\s*true/u,
    );
    assert.match(SAMPLE_PAGE_SOURCE, /subjectLessonsEnabled=/u);
    assert.doesNotMatch(
      SAMPLE_PAGE_SOURCE,
      /listCurrentSubjectLessonSummaries|listReadySubjectLessonSummariesByReportToken/u,
    );
  });

  it("does not restore deep-dive lesson redirects", () => {
    for (const source of [SCORING_SOURCE, MAP_FLOW_SOURCE]) {
      assert.doesNotMatch(source, /subject-lesson\/build/u);
      assert.doesNotMatch(source, /Making the practice page/u);
    }
  });
});
