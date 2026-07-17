import { createHash } from "node:crypto";

import {
  citationSourceNames,
  type ResearchCitation,
} from "./citation-source";
import type { KnowledgeLens, KnowledgeTopicType } from "./gate";

export type BriefKnowledgeFit = "frontier" | "subject" | "method" | "broad_subject";

export interface BriefKnowledgeUse {
  knowledgeId: string;
  usedAt: string;
}

export interface BriefKnowledgeRow {
  id: string;
  topicType: KnowledgeTopicType;
  topicKey: string;
  lens: KnowledgeLens | null;
  stage: string | null;
  title: string;
  summary: string;
  confidence: "high" | "medium" | "low";
  sourceTier: number | null;
  citations: ResearchCitation[];
  lastVerifiedAt: string;
  freshnessTtlDays: number;
  recentDeliveredUseCount: number;
}

export interface BriefKnowledgeCandidate extends BriefKnowledgeRow {
  sourceNames: string[];
  fit: BriefKnowledgeFit;
}

export interface BriefSelectionInput {
  familyId: string;
  localDate: string;
  now: Date;
  stages: readonly string[];
  subjectKeys: readonly string[];
  frontierDomains: readonly string[];
  methodKeys: readonly string[];
  recentUses: readonly BriefKnowledgeUse[];
}

const COOL_DOWN_MS = 14 * 24 * 60 * 60 * 1000;
const FIT_RANK: Record<BriefKnowledgeFit, number> = {
  frontier: 0,
  subject: 1,
  method: 2,
  broad_subject: 3,
};

function isFresh(row: BriefKnowledgeRow, now: Date): boolean {
  const verifiedAt = Date.parse(row.lastVerifiedAt);
  return Number.isFinite(verifiedAt) && now.getTime() - verifiedAt <= row.freshnessTtlDays * 86400000;
}

function hasCooldown(row: BriefKnowledgeRow, uses: readonly BriefKnowledgeUse[], now: Date): boolean {
  return uses.some(
    (use) =>
      use.knowledgeId === row.id &&
      now.getTime() - Date.parse(use.usedAt) < COOL_DOWN_MS,
  );
}

function deriveFit(row: BriefKnowledgeRow, input: BriefSelectionInput): BriefKnowledgeFit | null {
  if (input.frontierDomains.includes(row.topicKey)) return "frontier";
  if (row.lens === "method" && input.methodKeys.includes(row.topicKey)) return "method";
  if (input.subjectKeys.includes(row.topicKey)) {
    return row.stage === null && row.topicType === "subject" ? "broad_subject" : "subject";
  }
  return null;
}

function hasValidStageAndTier(row: BriefKnowledgeRow, input: BriefSelectionInput): boolean {
  if (row.lens === "method") return true;
  if (row.lens === "current_study") {
    return row.stage !== null &&
      input.stages.includes(row.stage) &&
      row.sourceTier !== null &&
      row.sourceTier >= 1 &&
      row.sourceTier <= 3;
  }
  if (row.stage === null && row.topicType === "subject" && input.subjectKeys.includes(row.topicKey)) return true;
  if (!row.stage || !input.stages.includes(row.stage)) return false;
  return true;
}

function stableRank(row: BriefKnowledgeRow, input: BriefSelectionInput): string {
  return createHash("sha256")
    .update(`${input.familyId}:${input.localDate}:${row.id}`)
    .digest("hex");
}

/** Returns eligible rows in deterministic family-local display order. */
export function rankBriefKnowledge(
  rows: readonly BriefKnowledgeRow[],
  input: BriefSelectionInput,
): BriefKnowledgeCandidate[] {
  return rows
    .flatMap((row) => {
      const sourceNames = citationSourceNames(row.citations);
      const fit = deriveFit(row, input);
      if (
        !fit ||
        row.confidence === "low" ||
        sourceNames.length === 0 ||
        !isFresh(row, input.now) ||
        hasCooldown(row, input.recentUses, input.now) ||
        !hasValidStageAndTier(row, input)
      ) {
        return [];
      }
      return [{ ...row, sourceNames, fit }];
    })
    .sort((left, right) => {
      const fitDifference = FIT_RANK[left.fit] - FIT_RANK[right.fit];
      if (fitDifference !== 0) return fitDifference;
      const useDifference = left.recentDeliveredUseCount - right.recentDeliveredUseCount;
      if (useDifference !== 0) return useDifference;
      return stableRank(left, input).localeCompare(stableRank(right, input));
    });
}

/** Picks one deterministic eligible candidate, or nothing safe to teach. */
export function selectBriefKnowledge(
  rows: readonly BriefKnowledgeRow[],
  input: BriefSelectionInput,
): BriefKnowledgeCandidate | null {
  return rankBriefKnowledge(rows, input)[0] ?? null;
}
