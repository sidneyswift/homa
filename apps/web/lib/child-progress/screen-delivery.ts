/** Authenticated native text uses the same canonical web provenance as browser chat. */
export function isWebDeliveryChannel(channel: unknown): boolean {
  return channel === undefined || channel === "web" || channel === "mobile";
}
