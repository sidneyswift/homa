import type { FamilyTaskKind } from "../tasks/kinds";

export type PromptOutcome = "accepted" | "declined" | "answered";

export interface TaskPromptMetric {
  taskKind: FamilyTaskKind;
  sentInRange: boolean;
  resolvedInRange: boolean;
  outcome: PromptOutcome | null;
}

export interface TaskPromptOutcomeSummary {
  sentOffers: number;
  resolvedOffers: number;
  accepted: number;
  declined: number;
  answered: number;
  acceptanceDenominator: number;
}

export interface MorningOfferCohortRow {
  state: "open" | "resolved" | "expired" | "cancelled";
  expiresAt: Date;
  outcome: PromptOutcome | null;
  fulfilled: boolean;
}

export interface MorningOfferFunnelSummary {
  deliveredOffers: number;
  linkedReplies: number;
  waiting: number;
  noLinkedReply: number;
  maturedOffers: number;
  decisions: number;
  accepted: number;
  declined: number;
  answered: number;
  unclassified: number;
  fulfilled: number;
}

export interface PossibleMorningBriefInterestCandidate {
  sentMorningBriefAt: Date | null;
  messageCreatedAt: Date;
  repliedDeliveryId: string | null;
}

const POSSIBLE_INTEREST_WINDOW_MS = 4 * 60 * 60_000;

function emptyTaskPromptOutcomeSummary(): TaskPromptOutcomeSummary {
  return {
    sentOffers: 0,
    resolvedOffers: 0,
    accepted: 0,
    declined: 0,
    answered: 0,
    acceptanceDenominator: 0,
  };
}

export function summarizeMorningOfferFunnel(
  rows: MorningOfferCohortRow[],
  now: Date,
): MorningOfferFunnelSummary {
  let linkedReplies = 0;
  let waiting = 0;
  let noLinkedReply = 0;
  let accepted = 0;
  let declined = 0;
  let answered = 0;
  let fulfilled = 0;

  for (const row of rows) {
    switch (row.state) {
      case "resolved":
        linkedReplies += 1;
        switch (row.outcome) {
          case "accepted":
            accepted += 1;
            if (row.fulfilled) fulfilled += 1;
            break;
          case "declined":
            declined += 1;
            break;
          case "answered":
            answered += 1;
            break;
          case null:
            break;
          default: {
            const exhaustive: never = row.outcome;
            throw new Error(`Unhandled morning offer outcome: ${String(exhaustive)}`);
          }
        }
        break;
      case "open":
        if (row.expiresAt.getTime() > now.getTime()) {
          waiting += 1;
        } else {
          noLinkedReply += 1;
        }
        break;
      case "expired":
      case "cancelled":
        noLinkedReply += 1;
        break;
      default: {
        const exhaustive: never = row.state;
        throw new Error(`Unhandled morning offer state: ${String(exhaustive)}`);
      }
    }
  }

  const decisions = accepted + declined;
  const classified = decisions + answered;
  return {
    deliveredOffers: rows.length,
    linkedReplies,
    waiting,
    noLinkedReply,
    maturedOffers: linkedReplies + noLinkedReply,
    decisions,
    accepted,
    declined,
    answered,
    unclassified: Math.max(0, linkedReplies - classified),
    fulfilled,
  };
}

export function summarizeTaskPromptOutcomes(
  metrics: TaskPromptMetric[],
): Record<FamilyTaskKind, TaskPromptOutcomeSummary> {
  const summaries: Record<FamilyTaskKind, TaskPromptOutcomeSummary> = {
    journal_prompt: emptyTaskPromptOutcomeSummary(),
    morning_brief: emptyTaskPromptOutcomeSummary(),
    custom: emptyTaskPromptOutcomeSummary(),
  };
  for (const metric of metrics) {
    const summary = summaries[metric.taskKind];
    if (metric.sentInRange) summary.sentOffers += 1;
    if (!metric.resolvedInRange) continue;
    summary.resolvedOffers += 1;
    if (metric.outcome) {
      switch (metric.outcome) {
        case "accepted":
          summary.accepted += 1;
          summary.acceptanceDenominator += 1;
          break;
        case "declined":
          summary.declined += 1;
          summary.acceptanceDenominator += 1;
          break;
        case "answered":
          summary.answered += 1;
          break;
        default: {
          const exhaustive: never = metric.outcome;
          throw new Error(`Unhandled prompt outcome: ${String(exhaustive)}`);
        }
      }
    }
  }
  return summaries;
}

export function countPossibleMorningBriefInterest(
  candidates: PossibleMorningBriefInterestCandidate[],
): number {
  return candidates.filter((candidate) => {
    if (candidate.repliedDeliveryId || !candidate.sentMorningBriefAt) {
      return false;
    }
    const elapsedMs =
      candidate.messageCreatedAt.getTime() -
      candidate.sentMorningBriefAt.getTime();
    return elapsedMs >= 0 && elapsedMs <= POSSIBLE_INTEREST_WINDOW_MS;
  }).length;
}
