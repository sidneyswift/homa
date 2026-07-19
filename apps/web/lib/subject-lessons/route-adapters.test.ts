import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { describe, it } from "node:test";

const routeSource = async (
  route: "build" | "keep" | "retry" | "status",
): Promise<string> => await readFile(
  new URL(
    `../../app/api/map/subject-lesson/${route}/route.ts`,
    import.meta.url,
  ),
  "utf8",
);

describe("subject lesson route adapters", () => {
  it("wires every retained route through the exact flag and owner policy", async () => {
    for (const route of ["build", "keep", "retry", "status"] as const) {
      const source = await routeSource(route);
      assert.match(source, /subjectLessonsEnabled/u);
      assert.match(source, /authorizeFamilyAccountOwner/u);
    }
  });

  it("imports the action-cost surface in build and retry", async () => {
    for (const source of await Promise.all([
      routeSource("build"),
      routeSource("retry"),
    ])) {
      assert.match(source, /ACTION_COSTS/u);
      assert.match(
        source,
        /ACTION_COSTS\.subjectLessonWithWorksheet\.modelUsageSurface/u,
      );
    }
  });

  it("uses atomic reuse-only mode before the wall", async () => {
    const source = await routeSource("build");
    assert.match(source, /mode: "reuse-only"/u);
    assert.doesNotMatch(source, /createIfMissing/u);
  });

  it("contains requested, retried, and first-transition Keep emitters", async () => {
    const [build, keep, retry, status] = await Promise.all([
      routeSource("build"),
      routeSource("keep"),
      routeSource("retry"),
      routeSource("status"),
    ]);
    assert.match(build, /emitMapEvent\("map\.subject_lesson_requested"/u);
    assert.match(retry, /emitMapEvent\("map\.subject_lesson_retried"/u);
    assert.match(keep, /emitMapEvent\("map\.subject_lesson_kept"/u);
    assert.match(keep, /emitMapEvent\("materials\.finalized"/u);
    assert.doesNotMatch(
      `${build}\n${keep}\n${retry}\n${status}`,
      /map\.subject_lesson_completed/u,
    );
  });

  it("keeps directly without starting an agent turn", async () => {
    const source = await routeSource("keep");
    assert.match(source, /keepSubjectLessonMaterialWithReceipt/u);
    assert.doesNotMatch(
      source,
      /startSubjectLessonSession|ACTION_COSTS|modelUsageSurface|eve\/v1/u,
    );
  });

  it("does not ship Complete route or policy artifacts", async () => {
    await Promise.all([
      assert.rejects(
        access(
          new URL(
            "../../app/api/map/subject-lesson/complete/route.ts",
            import.meta.url,
          ),
        ),
        { code: "ENOENT" },
      ),
      assert.rejects(
        access(new URL("./complete-route-policy.ts", import.meta.url)),
        { code: "ENOENT" },
      ),
    ]);

    const [routes, contracts] = await Promise.all([
      readFile(new URL("./routes.ts", import.meta.url), "utf8"),
      readFile(new URL("./route-contracts.ts", import.meta.url), "utf8"),
    ]);
    assert.doesNotMatch(routes, /createSubjectLessonCompleteHandler/u);
    assert.doesNotMatch(contracts, /SubjectLessonCompleteRouteDependencies/u);
  });

  it("never derives the internal destination from browser input", async () => {
    const [build, retry, contracts] = await Promise.all([
      readFile(new URL("./build-route-policy.ts", import.meta.url), "utf8"),
      readFile(new URL("./retry-route-policy.ts", import.meta.url), "utf8"),
      readFile(new URL("./route-contracts.ts", import.meta.url), "utf8"),
    ]);
    const source = `${build}\n${retry}\n${contracts}`;
    assert.doesNotMatch(source, /request\.url/u);
    assert.doesNotMatch(source, /x-forwarded-host/iu);
    assert.doesNotMatch(source, /\bhost\b/iu);
    assert.doesNotMatch(
      contracts,
      /StartSubjectLessonSessionInput[\s\S]*origin:/u,
    );
  });
});

describe("subject lesson cron and event wiring", () => {
  it("emits one failed event for each stale transition receipt", async () => {
    const source = await readFile(
      new URL("../../app/api/map/cron/route.ts", import.meta.url),
      "utf8",
    );
    const flagGuard = source.indexOf("if (subjectLessonsEnabled())");
    const reaper = source.indexOf(
      "const staleLessonReceipts = await reapStaleSubjectLessons()",
      flagGuard,
    );
    const count = source.indexOf(
      "staleSubjectLessons = staleLessonReceipts.length",
      reaper,
    );
    const loop = source.indexOf(
      "for (const receipt of staleLessonReceipts)",
      count,
    );
    const eventOffset = source.slice(loop).search(
      /emitMapEvent\(\s*"map\.subject_lesson_failed"/u,
    );
    assert.ok(flagGuard >= 0);
    assert.ok(reaper > flagGuard);
    assert.ok(count > reaper);
    assert.ok(loop > count);
    assert.ok(eventOffset > 0);
    assert.match(source, /staleSubjectLessonFailureEvent\(receipt\)/u);
  });

  it("has no remaining subject lesson event staging", async () => {
    const source = await readFile(
      new URL("../../../../scripts/events-check.mts", import.meta.url),
      "utf8",
    );
    const start = source.indexOf("const STAGED_EVENTS");
    const end = source.indexOf("const failures", start);
    assert.doesNotMatch(source.slice(start, end), /map\.subject_lesson_/u);
  });
});
