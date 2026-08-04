import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";

import {
  focusSubjectLessonHandoff,
  requestSubjectLessonKeep,
  shouldMoveFocusToSubjectLessonHandoff,
} from "./lesson-keep-button";
import {
  getSubjectLessonRetryCopy,
  requestSubjectLessonRetry,
  type SubjectLessonRetryTarget,
} from "./lesson-retry-button";
import {
  createSubjectLessonPollController,
  shouldPollSubjectLessonStatus,
  SUBJECT_LESSON_POLL_INTERVAL_MS,
} from "./lesson-status-poll";
import {
  resolveSubjectLessonOwnerMaterial,
  SubjectLessonPageView,
  type SubjectLessonPageViewProps,
} from "./lesson-view";

const LESSON_ID = "11111111-1111-4111-8111-111111111111";
const MATERIAL_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_ID = "33333333-3333-4333-8333-333333333333";
const LESSON_GOAL_CONTEXT = "This is the goal for this lesson.";

const PAGE_SOURCE = readFileSync(
  new URL("./page.tsx", import.meta.url),
  "utf8",
);
const VIEW_SOURCE = readFileSync(
  new URL("./lesson-view.tsx", import.meta.url),
  "utf8",
);
const LAYOUT_SOURCE = readFileSync(
  new URL("./lesson-layout.tsx", import.meta.url),
  "utf8",
);
const POLL_SOURCE = readFileSync(
  new URL("./lesson-status-poll.tsx", import.meta.url),
  "utf8",
);
const RETRY_SOURCE = readFileSync(
  new URL("./lesson-retry-button.tsx", import.meta.url),
  "utf8",
);
const MATERIAL_CARD_SOURCE = readFileSync(
  new URL("../../../../../app/material-card.tsx", import.meta.url),
  "utf8",
);
const KEEP_SOURCE = readFileSync(
  new URL("./lesson-keep-button.tsx", import.meta.url),
  "utf8",
);
const STORE_SOURCE = readFileSync(
  new URL(
    "../../../../../../lib/subject-lessons/store.ts",
    import.meta.url,
  ),
  "utf8",
);
const TYPES_SOURCE = readFileSync(
  new URL(
    "../../../../../../lib/subject-lessons/types.ts",
    import.meta.url,
  ),
  "utf8",
);
const FAMILY_PHONE_SOURCE = readFileSync(
  new URL("../../../../../../lib/family-phone.ts", import.meta.url),
  "utf8",
);
const PARENTS_SECTION_SOURCE = readFileSync(
  new URL("../../../../../app/settings/parents-section.tsx", import.meta.url),
  "utf8",
);
const GLOBALS_CSS = readFileSync(
  new URL("../../../../../globals.css", import.meta.url),
  "utf8",
);
const QUIET_PRIMITIVES_CSS = readFileSync(
  new URL("../../../../../../components/design/quiet-primitives.css", import.meta.url),
  "utf8",
);

const ROUTER = {
  back() {},
  forward() {},
  refresh() {},
  hmrRefresh() {},
  push() {},
  replace() {},
  prefetch: async () => {},
};

const READY_CONTENT = {
  title: "Count a collection in two ways",
  materials: ["Ten buttons", "A pencil"],
  steps: [
    "You might invite Maya to count the buttons one at a time.",
    "Maya moves each button into a new row as she counts again.",
    "You and Maya compare the two totals.",
  ],
  practice:
    "Tomorrow, Maya counts a different small collection in the same two ways.",
};

const EMPTY_CONTENT = {
  title: "",
  materials: [],
  steps: [],
  practice: "",
};

const BASE_PROPS: SubjectLessonPageViewProps = {
  access: "owner",
  token: "report-token",
  subjectId: "math",
  lessonId: LESSON_ID,
  childName: "Maya",
  subjectName: "Math",
  targetStatement: "Counts a collection accurately to 10",
  buildStatus: "ready",
  content: READY_CONTENT,
  material: {
    title: "Maya's counting practice",
    kind: "worksheet",
    skill: "Counting to 10",
    childName: "Maya",
    previewUrl: "https://example.com/counting.jpg",
    pdfUrl: "https://example.com/counting.pdf",
  },
  ownerMaterial: {
    lessonId: LESSON_ID,
    materialId: MATERIAL_ID,
    status: "draft",
  },
  showPhoneSetupLink: true,
};

function renderLessonView(
  overrides: Partial<SubjectLessonPageViewProps> = {},
): string {
  return renderToStaticMarkup(
    <AppRouterContext.Provider value={ROUTER}>
      <SubjectLessonPageView {...BASE_PROPS} {...overrides} />
    </AppRouterContext.Provider>,
  );
}

function assertTextOrder(html: string, orderedText: string[]): void {
  let previousIndex = -1;
  for (const text of orderedText) {
    const index = html.indexOf(text);
    assert.ok(index >= 0, `Expected rendered text: ${text}`);
    assert.ok(
      index > previousIndex,
      `Expected "${text}" after the prior rendered section`,
    );
    previousIndex = index;
  }
}

function cssHexToken(name: string): string {
  const match = GLOBALS_CSS.match(
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

function interactiveClassForText(html: string, text: string): string {
  const escapedText = text.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const match = html.match(
    new RegExp(
      `<(?:a|button)[^>]*class="([^"]+)"[^>]*>(?:<span[^>]*>)?${escapedText}(?:</span>)?</(?:a|button)>`,
      "u",
    ),
  );
  assert.ok(match?.[1], `Expected interactive control: ${text}`);
  return match[1];
}

function createDeferred<T>(): {
  promise: Promise<T>;
  resolve(value: T): void;
} {
  let resolvePromise: (value: T) => void = () => {};
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve;
  });
  return {
    promise,
    resolve: resolvePromise,
  };
}

function createManualPollScheduler() {
  const tasks: Array<{
    callback: () => void;
    cancelled: boolean;
  }> = [];
  return {
    schedule(callback: () => void, delay: number): () => void {
      assert.equal(delay, SUBJECT_LESSON_POLL_INTERVAL_MS);
      const task = { callback, cancelled: false };
      tasks.push(task);
      return () => {
        task.cancelled = true;
      };
    },
    runNext(): void {
      const task = tasks.shift();
      assert.ok(task, "Expected a scheduled poll");
      if (!task.cancelled) task.callback();
    },
    pendingCount(): number {
      return tasks.filter((task) => !task.cancelled).length;
    },
  };
}

async function flushAsyncWork(): Promise<void> {
  await new Promise<void>((resolve) => {
    setImmediate(resolve);
  });
}

describe("retained subject lesson states", () => {
  it("renders one combined wait status for the lesson and worksheet", () => {
    for (const buildStatus of ["queued", "running"] as const) {
      const html = renderLessonView({
        buildStatus,
        content: EMPTY_CONTENT,
        material: null,
        ownerMaterial: null,
      });
      assertTextOrder(html, [
        "Maya",
        "Math",
        "Lesson goal",
        LESSON_GOAL_CONTEXT,
        BASE_PROPS.targetStatement,
        "Homa is making the lesson and worksheet",
        "This page updates when both are ready.",
        "You can leave and come back. Your request is saved.",
      ]);
      assert.match(html, /aria-busy="true"/u);
      assert.match(
        html,
        /<p[^>]*role="status"[^>]*>This page updates when both are ready\.<\/p>/u,
      );
      assert.doesNotMatch(
        html,
        /Homa is making this lesson|Making the worksheet|lesson request|practice page|Try again|Mark lesson complete|Keep/u,
      );
    }
  });

  it("keeps lesson content visible when only the worksheet failed", () => {
    const html = renderLessonView({
      buildStatus: "failed",
      material: null,
      ownerMaterial: null,
    });
    assertTextOrder(html, [
      "Lesson goal",
      LESSON_GOAL_CONTEXT,
      BASE_PROPS.targetStatement,
      "The lesson",
      READY_CONTENT.title,
      READY_CONTENT.steps[0],
      "Practice afterward",
      READY_CONTENT.practice,
      "Worksheet",
      "The lesson is saved. The worksheet did not finish.",
      "Make the worksheet again",
    ]);
    assert.doesNotMatch(
      html,
      /practice page|Try the page|Print it|Keep/u,
    );
  });

  it("uses the accepted full-failure copy and owner-only retry", () => {
    const html = renderLessonView({
      buildStatus: "failed",
      content: EMPTY_CONTENT,
      material: null,
      ownerMaterial: null,
    });
    assertTextOrder(html, [
      "Lesson goal",
      LESSON_GOAL_CONTEXT,
      BASE_PROPS.targetStatement,
      "The lesson",
      "The lesson did not finish. Your request is saved.",
      "Make the lesson again",
    ]);
    assert.doesNotMatch(
      html,
      /practice page|Try again|Mark lesson complete|Keep/u,
    );
  });

  it("renders the ready lesson, worksheet, and one polite announcement", () => {
    const html = renderLessonView();
    assertTextOrder(html, [
      "Lesson goal",
      LESSON_GOAL_CONTEXT,
      BASE_PROPS.targetStatement,
      "The lesson",
      READY_CONTENT.title,
      READY_CONTENT.materials[0],
      READY_CONTENT.steps[0],
      "Practice afterward",
      READY_CONTENT.practice,
      "Worksheet",
      "Maya&#x27;s counting practice",
      "Print it",
      "Keep in Binder",
      "Binder saves the worksheet for later. The lesson stays at this link.",
    ]);
    assert.equal(
      html.match(/Lesson and worksheet ready\./gu)?.length,
      1,
    );
    assert.match(
      html,
      /<[^>]+role="status"[^>]*>Lesson and worksheet ready\.<\/[^>]+>/u,
    );
    assert.doesNotMatch(
      html,
      /practice page|Worksheet ready|Mark lesson complete|\/complete|mark_material_final/u,
    );
  });

  it("keeps token-ready rendering read-only and nonready tokens closed", () => {
    const readyHtml = renderLessonView({
      access: "token",
      ownerMaterial: null,
    });
    assert.match(readyHtml, /Print it/u);
    assert.doesNotMatch(
      readyHtml,
      new RegExp(
        `${LESSON_ID}|${MATERIAL_ID}|draft|Try again|Keep in Binder|Kept in Binder|Message Homa`,
        "u",
      ),
    );

    const failedHtml = renderLessonView({
      access: "token",
      buildStatus: "failed",
      content: EMPTY_CONTENT,
      material: null,
      ownerMaterial: null,
    });
    assert.match(failedHtml, /This lesson link isn&#x27;t active\./u);
    assert.doesNotMatch(
      failedHtml,
      new RegExp(`${BASE_PROPS.targetStatement}|Try again|${LESSON_ID}`, "u"),
    );
  });
});

describe("retained lesson security and Keep seam", () => {
  it("derives owner-only draft identity from the newer family-pinned row", () => {
    const ownerMaterial = resolveSubjectLessonOwnerMaterial({
      access: "owner",
      readyLessonId: LESSON_ID,
      readyMaterialId: MATERIAL_ID,
      ownerState: {
        id: LESSON_ID,
        materialId: MATERIAL_ID,
        materialStatus: "draft",
      },
    });
    assert.deepEqual(ownerMaterial, {
      lessonId: LESSON_ID,
      materialId: MATERIAL_ID,
      status: "draft",
    });
    assert.equal(
      resolveSubjectLessonOwnerMaterial({
        access: "token",
        readyLessonId: LESSON_ID,
        readyMaterialId: MATERIAL_ID,
        ownerState: {
          id: LESSON_ID,
          materialId: MATERIAL_ID,
          materialStatus: "draft",
        },
      }),
      null,
    );
    assert.equal(
      resolveSubjectLessonOwnerMaterial({
        access: "owner",
        readyLessonId: LESSON_ID,
        readyMaterialId: MATERIAL_ID,
        ownerState: {
          id: LESSON_ID,
          materialId: OTHER_ID,
          materialStatus: "draft",
        },
      }),
      null,
    );
    assert.match(PAGE_SOURCE, /resolveSubjectLessonOwnerMaterial/u);
    assert.match(TYPES_SOURCE, /materialStatus:/u);
    assert.match(STORE_SOURCE, /material\.status as material_status/u);
  });

  it("renders the owner action without exposing lesson or material identity", () => {
    const html = renderLessonView();
    assert.match(html, /Keep in Binder/u);
    assert.doesNotMatch(html, new RegExp(`${LESSON_ID}|${MATERIAL_ID}|draft`, "u"));
  });

  it("keeps the page GET side-effect-free and omits completion artifacts", () => {
    const routeSource = [
      PAGE_SOURCE,
      VIEW_SOURCE,
      LAYOUT_SOURCE,
      POLL_SOURCE,
      RETRY_SOURCE,
    ].join("\n");
    assert.doesNotMatch(
      PAGE_SOURCE,
      /claimOrReuse|startSubjectLessonSession|\/api\/map\/subject-lesson\/(?:build|retry)/u,
    );
    assert.doesNotMatch(
      routeSource,
      /SubjectLessonComplete|Mark lesson complete|\/api\/map\/subject-lesson\/complete/u,
    );
    assert.doesNotMatch(PAGE_SOURCE, /mark_material_final|finalizeMaterial/u);
  });
});

describe("owner worksheet Keep and daily-loop handoff", () => {
  it("shows one primary Keep action for an owner draft and no early kept claim", () => {
    const html = renderLessonView();

    assert.equal(html.match(/Keep in Binder/gu)?.length, 1);
    assert.match(
      html,
      /<button[^>]*><span>Keep in Binder<\/span><\/button><p[^>]*>Binder saves the worksheet for later\. The lesson stays at this link\.<\/p>/u,
    );
    assert.doesNotMatch(
      html,
      /Kept in Binder|Message Homa about this lesson|Prefer text\?|Phone setup is optional\.|Open phone settings/u,
    );
    const className = interactiveClassForText(html, "Keep in Binder");
    assert.match(className, /quiet-action quiet-action--primary/u);
    assert.doesNotMatch(className, /clay-700|clay-600|rounded-pill/u);
  });

  it("shows the kept handoff and conditional phone setup link after finalization", () => {
    const html = renderLessonView({
      ownerMaterial: {
        lessonId: LESSON_ID,
        materialId: MATERIAL_ID,
        status: "final",
      },
      showPhoneSetupLink: true,
    });

    assertTextOrder(html, [
      "Kept in Binder",
      "Homa can help you adjust the lesson or talk through how it went.",
      "Message Homa about this lesson",
      "Prefer text?",
      "Phone setup is optional. Homa sends one research note by text each weekday morning.",
      "Open phone settings",
    ]);
    assert.match(
      html,
      /class="[^"]*quiet-action quiet-action--primary[^"]*" href="\/app"><span>Message Homa about this lesson<\/span><\/a>/u,
    );
    assert.match(
      html,
      /class="[^"]*quiet-action quiet-action--secondary[^"]*" href="\/app\/settings\?edit=phone#parents"><span>Open phone settings<\/span><\/a>/u,
    );
    assert.match(
      html,
      /<section[^>]*aria-labelledby="phone-setup-heading"[^>]*class="[^"]*quiet-lesson__phone[^"]*"[^>]*>/u,
    );
    assert.match(
      interactiveClassForText(html, "Message Homa about this lesson"),
      /quiet-action quiet-action--primary/u,
    );
    assert.match(
      interactiveClassForText(html, "Open phone settings"),
      /quiet-action quiet-action--secondary/u,
    );
    assert.doesNotMatch(
      interactiveClassForText(html, "Open phone settings"),
      /clay-700|clay-600|rounded-pill/u,
    );
    assert.doesNotMatch(html, /The worksheet is in Binder\./u);

    const linkedPhoneHtml = renderLessonView({
      ownerMaterial: {
        lessonId: LESSON_ID,
        materialId: MATERIAL_ID,
        status: "final",
      },
      showPhoneSetupLink: false,
    });
    assert.match(linkedPhoneHtml, /Message Homa about this lesson/u);
    assert.doesNotMatch(
      linkedPhoneHtml,
      /Prefer text\?|Phone setup is optional\.|Homa sends one research note by text each weekday morning\.|Open phone settings/u,
    );
  });

  it("announces kept state persistently and moves focus after a new Keep", () => {
    const html = renderLessonView({
      ownerMaterial: {
        lessonId: LESSON_ID,
        materialId: MATERIAL_ID,
        status: "final",
      },
    });

    assert.match(
      html,
      /<section[^>]*role="status"[^>]*aria-live="polite"[^>]*aria-atomic="true"[^>]*>/u,
    );
    assert.match(
      html,
      /<h3[^>]*id="kept-worksheet-heading"[^>]*tabindex="-1"[^>]*>Kept in Binder<\/h3>/u,
    );
    assert.equal(
      shouldMoveFocusToSubjectLessonHandoff({
        initiallyKept: false,
        kept: true,
      }),
      true,
    );
    assert.equal(
      shouldMoveFocusToSubjectLessonHandoff({
        initiallyKept: true,
        kept: true,
      }),
      false,
    );

    let focusCalls = 0;
    focusSubjectLessonHandoff({
      focus() {
        focusCalls += 1;
      },
    });
    assert.equal(focusCalls, 1);
    assert.match(KEEP_SOURCE, /useEffect/u);
    assert.match(
      KEEP_SOURCE,
      /focusSubjectLessonHandoff\(handoffHeadingRef\.current\)/u,
    );
  });

  it("shows neither Keep nor the handoff to token viewers", () => {
    const html = renderLessonView({
      access: "token",
      ownerMaterial: null,
      showPhoneSetupLink: true,
    });

    assert.doesNotMatch(
      html,
      /Keep in Binder|Binder saves the worksheet|Kept in Binder|Message Homa about this lesson|Prefer text\?|research note by text|Open phone settings/u,
    );
  });

  it("posts only the lesson id and accepts only an explicit kept response", async () => {
    let receivedUrl = "";
    let receivedInit: RequestInit | undefined;
    const kept = await requestSubjectLessonKeep(
      LESSON_ID,
      async (input, init) => {
        receivedUrl = String(input);
        receivedInit = init;
        return Response.json({ ok: true, kept: true });
      },
    );

    assert.equal(kept, true);
    assert.equal(receivedUrl, "/api/map/subject-lesson/keep");
    assert.equal(receivedInit?.method, "POST");
    assert.deepEqual(JSON.parse(String(receivedInit?.body)), {
      lessonId: LESSON_ID,
    });

    for (const response of [
      Response.json({ ok: false, kept: true }, { status: 502 }),
      Response.json({ ok: true, kept: false }),
      new Response("not json", { status: 200 }),
    ]) {
      assert.equal(
        await requestSubjectLessonKeep(
          LESSON_ID,
          async () => response,
        ),
        false,
      );
    }
  });

  it("keeps the action available with the accepted Keep failure copy", () => {
    assert.match(KEEP_SOURCE, /Keeping\.\.\./u);
    assert.match(
      KEEP_SOURCE,
      /The worksheet is still on this page, but it was not saved to Binder\./u,
    );
    assert.match(KEEP_SOURCE, /Keep in Binder/u);
    assert.match(KEEP_SOURCE, /if \(kept\)/u);
    assert.match(KEEP_SOURCE, /setKept\(true\)/u);
  });

  it("loads only a family-scoped phone boolean and anchors Parents settings", () => {
    const helperStart = FAMILY_PHONE_SOURCE.indexOf(
      "export async function hasFamilyPhone",
    );
    const helperEnd = FAMILY_PHONE_SOURCE.indexOf(
      "export async function addFamilyPhone",
      helperStart,
    );
    assert.ok(helperStart >= 0);
    assert.ok(helperEnd > helperStart);
    const helperSource = FAMILY_PHONE_SOURCE.slice(helperStart, helperEnd);

    assert.match(helperSource, /Promise<boolean>/u);
    assert.match(helperSource, /where family_id = \$\{familyId\}/u);
    assert.match(helperSource, /select exists/u);
    assert.doesNotMatch(helperSource, /phone_e164/u);
    assert.match(PAGE_SOURCE, /hasFamilyPhone/u);
    assert.match(PARENTS_SECTION_SOURCE, /<div id="parents">/u);
  });
});

describe("retained lesson contrast and retry", () => {
  it("uses AA tokens for controls, supporting text, markers, and errors", () => {
    const readyHtml = renderLessonView();
    const failedHtml = renderLessonView({
      buildStatus: "failed",
      content: EMPTY_CONTENT,
      material: null,
      ownerMaterial: null,
    });
    const inactiveHtml = renderLessonView({
      access: "token",
      buildStatus: "failed",
      material: null,
      ownerMaterial: null,
    });
    for (const className of [
      interactiveClassForText(readyHtml, "Print it"),
      interactiveClassForText(readyHtml, "Keep in Binder"),
      interactiveClassForText(failedHtml, "Make the lesson again"),
      interactiveClassForText(inactiveHtml, "Back to the report"),
    ]) {
      assert.match(className, /quiet-action/u);
      assert.doesNotMatch(className, /clay-700|clay-600|rounded-pill/u);
    }
    assert.doesNotMatch(readyHtml, />Worksheet ready</u);
    assert.match(readyHtml, /quiet-lesson__steps/u);
    assert.match(QUIET_PRIMITIVES_CSS, /\.quiet-lesson__steps/u);
    assert.match(MATERIAL_CARD_SOURCE, /quiet-artifact-card__title/u);
    assert.match(RETRY_SOURCE, /quiet-lesson__error/u);

    const white = cssHexToken("on-brand");
    const rose600 = cssHexToken("rose-600");
    assert.ok(contrastRatio(white, cssHexToken("clay-700")) >= 4.5);
    assert.ok(contrastRatio(white, cssHexToken("clay-600")) >= 4.5);
    assert.ok(contrastRatio(white, rose600) >= 4.5);
    assert.ok(contrastRatio(cssHexToken("gold-100"), rose600) >= 4.5);
  });

  it("posts retry only to the restored retry route", async () => {
    let receivedUrl = "";
    let receivedInit: RequestInit | undefined;
    const retried = await requestSubjectLessonRetry(
      LESSON_ID,
      async (input, init) => {
        receivedUrl = String(input);
        receivedInit = init;
        return Response.json({ ok: true });
      },
    );
    assert.equal(retried, true);
    assert.equal(receivedUrl, "/api/map/subject-lesson/retry");
    assert.equal(receivedInit?.method, "POST");
    assert.deepEqual(JSON.parse(String(receivedInit?.body)), {
      lessonId: LESSON_ID,
    });
    assert.match(RETRY_SOURCE, /Make the worksheet again/u);
    assert.match(RETRY_SOURCE, /Making the worksheet\.\.\./u);
    assert.match(RETRY_SOURCE, /Make the lesson again/u);
    assert.match(RETRY_SOURCE, /Making the lesson\.\.\./u);
  });

  it("matches retry feedback to both typed retry targets", () => {
    const targets: SubjectLessonRetryTarget[] = ["worksheet", "lesson"];
    assert.deepEqual(
      targets.map((retryTarget) => getSubjectLessonRetryCopy(retryTarget)),
      [
        {
          action: "Make the worksheet again",
          pending: "Making the worksheet...",
          error: "The worksheet did not start. Your lesson is still saved.",
        },
        {
          action: "Make the lesson again",
          pending: "Making the lesson...",
          error: "The lesson did not start. Your request is still saved.",
        },
      ],
    );
  });
});

describe("retained lesson polling lifecycle", () => {
  it("polls every 2.5 seconds only while queued or running", () => {
    assert.equal(SUBJECT_LESSON_POLL_INTERVAL_MS, 2_500);
    assert.equal(shouldPollSubjectLessonStatus("queued"), true);
    assert.equal(shouldPollSubjectLessonStatus("running"), true);
    assert.equal(shouldPollSubjectLessonStatus("ready"), false);
    assert.equal(shouldPollSubjectLessonStatus("failed"), false);
  });

  it("keeps at most one status request in flight", async () => {
    const scheduler = createManualPollScheduler();
    const firstRequest = createDeferred<"running">();
    let requestCount = 0;
    const controller = createSubjectLessonPollController({
      initialStatus: "running",
      requestStatus: async () => {
        requestCount += 1;
        return await firstRequest.promise;
      },
      schedule: scheduler.schedule,
      refresh() {},
    });
    controller.start();
    scheduler.runNext();
    controller.start();
    assert.equal(requestCount, 1);
    assert.equal(scheduler.pendingCount(), 0);
    firstRequest.resolve("running");
    await flushAsyncWork();
    assert.equal(scheduler.pendingCount(), 1);
    controller.cancel();
  });

  it("aborts the active request when the component lifecycle cancels", () => {
    const scheduler = createManualPollScheduler();
    const requestSignals: AbortSignal[] = [];
    const controller = createSubjectLessonPollController({
      initialStatus: "queued",
      requestStatus: async (signal) => {
        requestSignals.push(signal);
        return await new Promise<"running">(() => {});
      },
      schedule: scheduler.schedule,
      refresh() {},
    });
    controller.start();
    scheduler.runNext();
    const requestSignal = requestSignals[0];
    assert.ok(requestSignal);
    assert.equal(requestSignal.aborted, false);
    controller.cancel();
    assert.equal(requestSignal.aborted, true);
    assert.match(POLL_SOURCE, /return \(\) => controller\.cancel\(\);/u);
  });

  it("refreshes once on terminal and retries a transient failure", async () => {
    const scheduler = createManualPollScheduler();
    let requestCount = 0;
    let refreshCount = 0;
    const controller = createSubjectLessonPollController({
      initialStatus: "running",
      requestStatus: async () => {
        requestCount += 1;
        if (requestCount === 1) throw new Error("temporary status failure");
        return "ready";
      },
      schedule: scheduler.schedule,
      refresh() {
        refreshCount += 1;
      },
    });
    controller.start();
    scheduler.runNext();
    await flushAsyncWork();
    assert.equal(requestCount, 1);
    assert.equal(scheduler.pendingCount(), 1);
    scheduler.runNext();
    await flushAsyncWork();
    assert.equal(requestCount, 2);
    assert.equal(refreshCount, 1);
    assert.equal(scheduler.pendingCount(), 0);
    controller.start();
    assert.equal(refreshCount, 1);
  });
});
