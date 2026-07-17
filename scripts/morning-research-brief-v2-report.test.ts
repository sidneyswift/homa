import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertMorningResearchBriefReportIsPiiFree,
  buildMorningResearchBriefRolloutReport,
  buildMorningResearchBriefV2Report,
  parseMorningResearchBriefReportWindow,
  percentile,
  type MorningResearchBriefReportRows,
  type MorningResearchBriefRolloutReportRows,
} from "./morning-research-brief-v2-report-lib";

describe("morning research brief v2 report aggregates", () => {
  it("calculates counts, compliance, outcomes, and p50/p90 run latency", () => {
    const report = buildMorningResearchBriefV2Report({
      runs: [
        {
          status: "done",
          deliveredChannel: "sms",
          hasNamedSource: true,
          sourceRepeated: false,
          rowRepeated: false,
          runLatencyMs: 10,
        },
        {
          status: "done",
          deliveredChannel: "email",
          hasNamedSource: true,
          sourceRepeated: true,
          rowRepeated: false,
          runLatencyMs: 20,
        },
        {
          status: "failed",
          deliveredChannel: null,
          hasNamedSource: false,
          sourceRepeated: false,
          rowRepeated: true,
          runLatencyMs: 30,
        },
      ],
      sms: {
        attempted: 2,
        sent: 1,
        confirmedSmsToEmailFallback: 1,
        unattributedEmailDeliveries: 2,
      },
      formats: [
        { withinCharacterLimit: true, withinSegmentLimit: true },
        { withinCharacterLimit: false, withinSegmentLimit: true },
      ],
      usage: [
        { inputTokens: 100 },
        { inputTokens: 200 },
        { inputTokens: 300 },
        { inputTokens: 400 },
        { inputTokens: null },
      ],
      workflowIndicators: {
        durationAtOrAboveThreshold: 2,
        runningOlderThanThreshold: 1,
        terminalFailures: 3,
      },
      outcomes: { accepted: 3, declined: 2, answered: 1 },
      possibleInterest: 4,
      feedback: { helpful: 5, notForUs: 2 },
    } satisfies MorningResearchBriefReportRows);

    assert.equal(report.runCount, 3);
    assert.deepEqual(report.runStatus, { done: 2, failed: 1 });
    assert.deepEqual(report.deliveryChannel, { sms: 1, email: 1, undelivered: 1 });
    assert.deepEqual(report.sms, {
      attempted: 2,
      sent: 1,
      confirmedSmsToEmailFallback: 1,
      unattributedEmailDeliveries: 2,
    });
    assert.deepEqual(report.formatCompliance, {
      characterLimitCompliant: 1,
      segmentLimitCompliant: 2,
      fullyCompliant: 1,
    });
    assert.deepEqual(report.sourceQuality, {
      namedSourceRate: 2 / 3,
      repeatedSourceRate: 1 / 3,
      repeatedKnowledgeRowRate: 1 / 3,
    });
    assert.deepEqual(report.modelUsage, {
      composeSteps: 5,
      inputTokens: 1000,
    });
    assert.deepEqual(report.runLatency, {
      observedRuns: 3,
      p50Ms: 20,
      p90Ms: 28,
    });
    assert.deepEqual(report.workflowRiskIndicators, {
      thresholdSeconds: 800,
      durationAtOrAboveThreshold: 2,
      runningOlderThanThreshold: 1,
      terminalFailures: 3,
    });
    assert.deepEqual(report.outcomes, { accepted: 3, declined: 2, answered: 1 });
    assert.equal(report.possibleInterestWithinFourHours, 4);
    assert.deepEqual(report.explicitFeedback, { helpful: 5, notForUs: 2 });
  });

  it("uses interpolated percentiles and returns null without latency observations", () => {
    assert.equal(percentile([10, 20, 30, 40], 0.5), 25);
    assert.equal(percentile([10, 20, 30, 40], 0.9), 37);
    assert.equal(percentile([], 0.5), null);
  });

  it("requires a valid since boundary and accepts an optional until boundary", () => {
    assert.deepEqual(
      parseMorningResearchBriefReportWindow([
        "--since",
        "2026-07-16T00:00:00.000Z",
        "--until",
        "2026-07-17T00:00:00.000Z",
      ]),
      {
        since: new Date("2026-07-16T00:00:00.000Z"),
        until: new Date("2026-07-17T00:00:00.000Z"),
      },
    );
    assert.throws(
      () => parseMorningResearchBriefReportWindow([]),
      /Missing required --since/u,
    );
    assert.throws(
      () =>
        parseMorningResearchBriefReportWindow([
          "--since",
          "2026-07-17T00:00:00.000Z",
          "--until",
          "2026-07-16T00:00:00.000Z",
        ]),
      /after --since/u,
    );
  });

  it("rejects a report that could expose personal or content fields", () => {
    assert.doesNotThrow(() =>
      assertMorningResearchBriefReportIsPiiFree(
        buildMorningResearchBriefV2Report({
          runs: [],
          sms: {
            attempted: 0,
            sent: 0,
            confirmedSmsToEmailFallback: 0,
            unattributedEmailDeliveries: 0,
          },
          formats: [],
          usage: [],
          workflowIndicators: {
            durationAtOrAboveThreshold: 0,
            runningOlderThanThreshold: 0,
            terminalFailures: 0,
          },
          outcomes: { accepted: 0, declined: 0, answered: 0 },
          possibleInterest: 0,
          feedback: { helpful: 0, notForUs: 0 },
        }),
      ),
    );
    assert.throws(
      () => assertMorningResearchBriefReportIsPiiFree({ familyId: "forbidden" }),
      /PII-safe/,
    );
  });

  it("compares legacy baseline and v2 treatment with run latency named honestly", () => {
    const emptyCohort = {
      runs: [],
      sms: {
        attempted: 0,
        sent: 0,
        confirmedSmsToEmailFallback: 0,
        unattributedEmailDeliveries: 0,
      },
      formats: [],
      usage: [],
      workflowIndicators: {
        durationAtOrAboveThreshold: 0,
        runningOlderThanThreshold: 0,
        terminalFailures: 0,
      },
      outcomes: { accepted: 0, declined: 0, answered: 0 },
      possibleInterest: 0,
      feedback: { helpful: 0, notForUs: 0 },
    };
    const rows = {
      legacy: {
        ...emptyCohort,
        runs: [{
          status: "done",
          deliveredChannel: "sms",
          hasNamedSource: false,
          sourceRepeated: false,
          rowRepeated: false,
          runLatencyMs: 100,
        }],
      },
      research_brief_v2: {
        ...emptyCohort,
        runs: [{
          status: "failed",
          deliveredChannel: null,
          hasNamedSource: false,
          sourceRepeated: false,
          rowRepeated: false,
          runLatencyMs: 900_000,
        }],
        workflowIndicators: {
          durationAtOrAboveThreshold: 1,
          runningOlderThanThreshold: 0,
          terminalFailures: 1,
        },
      },
    } satisfies MorningResearchBriefRolloutReportRows;

    const report = buildMorningResearchBriefRolloutReport(rows);
    assert.deepEqual(report.comparison, {
      baselineDeliveryVersion: "legacy",
      treatmentDeliveryVersion: "research_brief_v2",
    });
    assert.equal(report.cohorts.legacy.runCount, 1);
    assert.equal(report.cohorts.research_brief_v2.runCount, 1);
    assert.deepEqual(report.cohorts.legacy.runLatency, {
      observedRuns: 1,
      p50Ms: 100,
      p90Ms: 100,
    });
    assert.deepEqual(report.cohorts.research_brief_v2.runLatency, {
      observedRuns: 1,
      p50Ms: 900_000,
      p90Ms: 900_000,
    });
    assert.equal(
      "p50ComposeLatencyMs" in report.cohorts.research_brief_v2.modelUsage,
      false,
    );
    assert.equal(
      report.cohorts.research_brief_v2.workflowRiskIndicators
        .durationAtOrAboveThreshold,
      1,
    );
  });
});
