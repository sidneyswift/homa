/**
 * Where open_state_records can honestly say a view opened. The iPhone app
 * (its chat and its voice mode, which share the mobile channel) is the one
 * surface that draws the state-records view from that tool's result; web
 * chat, SMS and phone calls draw nothing, so a "phone is opening" result
 * there made Homa claim a view that never appeared.
 */
export function opensNativeStateRecordsView(attributes: unknown): boolean {
  return (
    !!attributes &&
    typeof attributes === "object" &&
    (attributes as { channel?: unknown }).channel === "mobile"
  );
}
