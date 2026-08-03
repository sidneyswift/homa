import type { EveMessage, EveMessagePart } from "eve/react";

/** An authenticated report-open tool output, consumed by the chat client. */
export interface ReportOpenSignal {
  childId: string;
}

export function parseReportOpenPart(part: EveMessagePart): ReportOpenSignal | null {
  if (
    part.type !== "dynamic-tool" ||
    part.toolName !== "open_progress_report" ||
    part.state !== "output-available"
  ) {
    return null;
  }
  const output = (part.output ?? {}) as Record<string, unknown>;
  if (output.opened !== true || typeof output.childId !== "string") return null;
  return { childId: output.childId };
}

export interface LatestReportOpen {
  partKey: string;
  signal: ReportOpenSignal;
}

/** The newest report-open output in this chat session, if there is one. */
export function latestReportOpen(
  messages: readonly EveMessage[],
): LatestReportOpen | null {
  let latest: LatestReportOpen | null = null;
  for (const message of messages) {
    if (message.role !== "assistant") continue;
    for (const [partIndex, part] of message.parts.entries()) {
      const signal = parseReportOpenPart(part);
      if (signal) latest = { partKey: `${message.id}:${partIndex}`, signal };
    }
  }
  return latest;
}
