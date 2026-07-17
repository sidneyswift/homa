import { emitMapEvent } from "../map/events";
import type {
  PreparedResearchBriefAggregateRecoveryResult,
  PreparedResearchBriefDeliveryResult,
} from "./research-brief-delivery";

type ResearchBriefEventName =
  | "tasks.run_completed"
  | "research.brief_sent";

type ResearchBriefEventEmitter = (
  name: ResearchBriefEventName,
  props: Record<string, unknown>,
) => Promise<void>;

const productionEmitter: ResearchBriefEventEmitter = async (name, props) => {
  if (name === "tasks.run_completed") {
    await emitMapEvent(name, props as {
      family_id: string;
      kind: "morning_brief";
      status:
        | "done"
        | "partial"
        | "partial_uncertain"
        | "uncertain"
        | "failed";
    });
    return;
  }
  await emitMapEvent(name, props as {
    family_id: string;
    channel: "sms" | "email";
  });
};

async function emitDurableCompletion(
  familyId: string,
  delivery: {
    status:
      | "done"
      | "partial"
      | "partial_uncertain"
      | "uncertain"
      | "failed";
    deliveredChannel: "sms" | "email" | "none" | null;
    deliveredCount: number;
  },
  emit: ResearchBriefEventEmitter,
): Promise<void> {
  await emit("tasks.run_completed", {
    family_id: familyId,
    kind: "morning_brief",
    status: delivery.status,
  });
  if (
    delivery.deliveredCount > 0 &&
    (
      delivery.deliveredChannel === "sms" ||
      delivery.deliveredChannel === "email"
    )
  ) {
    await emit("research.brief_sent", {
      family_id: familyId,
      channel: delivery.deliveredChannel,
    });
  }
}

export async function emitResearchBriefDispatchCompletion(
  familyId: string,
  result: PreparedResearchBriefDeliveryResult,
  emit: ResearchBriefEventEmitter = productionEmitter,
): Promise<void> {
  if (
    result.status !== "completed" &&
    result.status !== "delivery_not_accepted"
  ) {
    return;
  }
  await emitDurableCompletion(familyId, result.delivery, emit);
}

export async function emitResearchBriefRecoveryCompletion(
  familyId: string,
  result: PreparedResearchBriefAggregateRecoveryResult,
  emit: ResearchBriefEventEmitter = productionEmitter,
): Promise<void> {
  if (result.status !== "recovered") return;
  await emitDurableCompletion(familyId, result.delivery, emit);
}
