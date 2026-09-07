import { selectParentVisibleMaterialMessageParts } from "../../app/app/material-message-parts";

/** Use the same review and revision selection as the parent's web chat. */
export function requireDeliveredHandwritingDraft(
  toolCalls: readonly { name: string; output?: unknown }[],
): string {
  const visible = selectParentVisibleMaterialMessageParts(toolCalls.map((call) => ({
    type: "dynamic-tool",
    state: "output-available",
    toolName: call.name,
    output: call.output,
  })));
  if (visible.length !== 1) {
    throw new Error(`Expected one delivered handwriting draft, found ${visible.length} parent-visible material cards.`);
  }
  const selected = visible[0];
  if (selected.status !== "draft" || !selected.material.id) {
    throw new Error("The delivered handwriting page must be a persisted draft awaiting the parent's approval.");
  }
  return selected.material.id;
}
