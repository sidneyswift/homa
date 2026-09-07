interface ToolCall {
  name: string;
  input: Record<string, unknown>;
  output?: unknown;
}

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? value as Record<string, unknown> : {};

/** This gate checks structured retrieval receipts, never the meaning of prose.
 * A Ready source followed only by a link is not a lesson read. The separate
 * behavior eval judges lesson accuracy and the parent's final explanation.
 */
export function hasTargetedLessonReadOrSourceRefusal(calls: readonly ToolCall[]): boolean {
  const created = calls.some(call => call.name === "create_printable");
  const opened = calls.flatMap((call, openedAt) => {
    const output = record(call.output), asset = record(output.asset);
    return call.name === "get_family_asset" && output.found === true && asset.id === call.input.assetId
      ? [{asset, openedAt}] : [];
  });
  const ready = opened.filter(({asset}) => asset.status === "ready" && asset.resourceKind === "curriculum");
  if (!ready.length) return !created && (calls.some(call => call.name === "get_family_asset" && record(call.output).found === false) ||
    opened.some(({asset}) => ["processing", "needs_attention", "failed"].includes(String(asset.status))));
  return ready.some(({asset, openedAt}) => {
    return calls.some((read, index) => {
      if (index <= openedAt || read.name !== "read_family_curriculum" || read.input.assetId !== asset.id) return false;
      const receipt = record(read.output);
      return (receipt.read === true && receipt.assetId === asset.id && !calls.slice(0, index).some(call => call.name === "create_printable")) ||
        (receipt.read === false && !created && (receipt.assetId === asset.id ||
          (typeof receipt.error === "string" && receipt.error.length > 0)));
    });
  });
}
