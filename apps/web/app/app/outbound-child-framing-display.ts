import { visibleOutboundChildFramingText } from "@homa/core";
import type { EveMessagePart } from "eve/react";

export function approvedOutboundChildFramingTexts(
  parts: readonly EveMessagePart[],
): ReadonlySet<string> {
  const approved = new Set<string>();
  for (const part of parts) {
    if (
      part.type !== "dynamic-tool"
      || part.toolName !== "review_child_framing"
      || part.state !== "output-available"
    ) {
      continue;
    }
    const output = (part.output ?? {}) as Record<string, unknown>;
    if (output.accepted === true && typeof output.text === "string") {
      approved.add(output.text);
    }
  }
  return approved;
}

export function visibleWebChildFramingText(input: {
  text: string;
  approvedTexts: ReadonlySet<string>;
  streaming: boolean;
}): string | null {
  return visibleOutboundChildFramingText({
    text: input.text,
    approvedText: input.approvedTexts.has(input.text) ? input.text : null,
    channel: "web",
    streaming: input.streaming,
  });
}
