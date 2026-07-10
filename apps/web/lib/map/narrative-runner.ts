import {
  validateNarrative,
  validatePlanNarrative,
  type NarrativeMeta,
} from "@homa/core";

import { REPORT_PROMPT_VERSION } from "../../agent/report-writer-version";
import { emitMapEvent } from "./events";
import {
  allowedNumbersFrom,
  buildReportFacts,
  childPronounsFact,
  genderedPronounsAllowedFrom,
  type PlanFacts,
} from "./narrative-facts";
import {
  generatePlanNarrative,
  generateReportNarrative,
  NARRATIVE_MODEL,
} from "./narrative-generate";
import {
  claimPlanNarrative,
  claimReportNarrative,
  getPlanNarrativeSource,
  getReportNarrativeSource,
  storePlanNarrative,
  storeReportNarrative,
} from "./narrative-store";

/**
 * One narrative generation run, end to end: load facts, claim the row
 * (single-flight; a crashed run un-sticks after the stale window),
 * generate, gate, store, emit. Runs inside after() from the score route,
 * the status endpoint's self-heal, or the plan page; callers never await
 * it on the response path.
 */

function writingMeta(): NarrativeMeta {
  return {
    status: "writing",
    promptVersion: REPORT_PROMPT_VERSION,
    model: NARRATIVE_MODEL,
    startedAt: new Date().toISOString(),
  };
}

export async function runReportNarrative(childId: string): Promise<void> {
  const source = await getReportNarrativeSource(childId);
  if (!source) return;

  const claim = writingMeta();
  if (!(await claimReportNarrative(childId, claim))) return;

  const facts = buildReportFacts(source);
  const gateContext = {
    allowedNumbers: allowedNumbersFrom(facts),
    siblingNames: source.siblingNames,
    childName: source.childName,
    genderedPronounsAllowed: genderedPronounsAllowedFrom(facts),
    expectedSubjects: facts.subjects.map((subject) => subject.subjectId),
    expectedDrawers: facts.subjects
      .filter((subject) => subject.position !== "not_mapped")
      .map((subject) => subject.subjectId),
  };

  try {
    const generated = await generateReportNarrative(facts, source.familyId);
    const verdicts = validateNarrative(generated.value, gateContext);
    const meta: NarrativeMeta = {
      ...claim,
      generatedAt: new Date().toISOString(),
      durationMs: generated.durationMs,
      tokensIn: generated.tokensIn,
      tokensOut: generated.tokensOut,
      rejectedPieces: verdicts.rejectedPieces,
      status: verdicts.failed ? "failed" : "ready",
      ...(verdicts.failed
        ? { failReason: `gate: ${JSON.stringify(verdicts.rejected).slice(0, 400)}` }
        : {}),
    };
    await storeReportNarrative(childId, verdicts.failed ? null : generated.value, meta);

    if (verdicts.failed) {
      await emitMapEvent("map.narrative_fallback", {
        family_id: source.familyId,
        child_id: childId,
        kind: "report",
        reason: "gate-failed",
      });
    } else {
      await emitMapEvent("map.narrative_generated", {
        family_id: source.familyId,
        child_id: childId,
        kind: "report",
        duration_ms: generated.durationMs,
        tokens_in: generated.tokensIn,
        tokens_out: generated.tokensOut,
        rejected_pieces: verdicts.rejectedPieces,
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    await storeReportNarrative(childId, null, {
      ...claim,
      status: "failed",
      generatedAt: new Date().toISOString(),
      failReason: message.slice(0, 400),
    });
    await emitMapEvent("map.narrative_fallback", {
      family_id: source.familyId,
      child_id: childId,
      kind: "report",
      reason: "generation-error",
    });
    console.error(`report narrative failed for child ${childId}:`, message);
  }
}

export async function runPlanNarrative(childId: string, domainId: string): Promise<void> {
  const source = await getPlanNarrativeSource(childId, domainId);
  if (!source) return;

  const claim = writingMeta();
  if (!(await claimPlanNarrative(childId, domainId, claim))) return;

  const pronounsAllowed = genderedPronounsAllowedFrom(source);
  const facts: PlanFacts = {
    childName: source.childName,
    childAge: source.plan.childAgeLabel,
    childPronouns: childPronounsFact(pronounsAllowed, source.childName),
    subjectName: source.plan.subjectName,
    interests: source.interests,
    homeschoolStyle: source.homeschoolStyle,
    whatsWorking: source.whatsWorking,
    curriculums: source.curriculums,
    helpWith: source.helpWith,
    startingLine: source.plan.startingLine,
    targets: source.plan.targets,
    weeks: source.plan.weeks,
  };
  const gateContext = {
    allowedNumbers: allowedNumbersFrom(facts),
    siblingNames: source.siblingNames,
    childName: source.childName,
    genderedPronounsAllowed: pronounsAllowed,
  };

  try {
    const generated = await generatePlanNarrative(facts, source.familyId);
    const verdicts = validatePlanNarrative(generated.value, gateContext);
    const meta: NarrativeMeta = {
      ...claim,
      generatedAt: new Date().toISOString(),
      durationMs: generated.durationMs,
      tokensIn: generated.tokensIn,
      tokensOut: generated.tokensOut,
      rejectedPieces: verdicts.rejectedPieces,
      status: verdicts.failed ? "failed" : "ready",
      ...(verdicts.failed
        ? { failReason: `gate: ${JSON.stringify(verdicts.rejected).slice(0, 400)}` }
        : {}),
    };
    await storePlanNarrative(childId, domainId, verdicts.failed ? null : generated.value, meta);

    if (verdicts.failed) {
      await emitMapEvent("map.narrative_fallback", {
        family_id: source.familyId,
        child_id: childId,
        kind: "plan",
        reason: "gate-failed",
      });
    } else {
      await emitMapEvent("map.narrative_generated", {
        family_id: source.familyId,
        child_id: childId,
        kind: "plan",
        duration_ms: generated.durationMs,
        tokens_in: generated.tokensIn,
        tokens_out: generated.tokensOut,
        rejected_pieces: verdicts.rejectedPieces,
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    await storePlanNarrative(childId, domainId, null, {
      ...claim,
      status: "failed",
      generatedAt: new Date().toISOString(),
      failReason: message.slice(0, 400),
    });
    await emitMapEvent("map.narrative_fallback", {
      family_id: source.familyId,
      child_id: childId,
      kind: "plan",
      reason: "generation-error",
    });
    console.error(`plan narrative failed for child ${childId} ${domainId}:`, message);
  }
}
