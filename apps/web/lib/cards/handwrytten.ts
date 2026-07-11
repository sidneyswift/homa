import { Handwrytten } from "handwrytten";

/**
 * Thin server-only wrapper around the official Handwrytten SDK (robots
 * writing with real pens). Only lib/cards/thank-you.ts calls this.
 *
 * Env (all server-only):
 *   HANDWRYTTEN_API_KEY    from app.handwrytten.com/api-keys
 *   HANDWRYTTEN_CARD_ID    the chosen stationery template id
 *   HANDWRYTTEN_FONT       the chosen handwriting font id/label
 *   HANDWRYTTEN_TEST_MODE  "true" = orders validate but never print or bill
 *
 * We drive the two-step basket flow instead of orders.send() because only
 * basket.send() accepts testMode (orders.send() does not forward it), and
 * the two are otherwise identical: orders.send() is addOrder + send under
 * the hood. The basket is account-global, so a failure clears it before
 * rethrowing; a leftover item would double-send on the next sweep.
 */

let client: Handwrytten | undefined;

export interface HandwryttenCardRequest {
  firstName: string;
  lastName: string;
  street1: string;
  city: string;
  /** Two-letter US state code (families.us_state). */
  state: string;
  zip: string;
  message: string;
  wishes: string;
}

export function handwryttenConfigured(): boolean {
  return Boolean(
    process.env.HANDWRYTTEN_API_KEY &&
      process.env.HANDWRYTTEN_CARD_ID &&
      process.env.HANDWRYTTEN_FONT,
  );
}

function handwryttenClient(): Handwrytten {
  if (client) return client;
  const apiKey = process.env.HANDWRYTTEN_API_KEY;
  if (!apiKey) throw new Error("handwrytten: HANDWRYTTEN_API_KEY must be set");
  client = new Handwrytten({ apiKey });
  return client;
}

/**
 * sendHandwryttenCard(request): places one real-pen card order and returns
 * the vendor order id when the response exposes one (null is fine: the row
 * just stays "sent" instead of graduating to "mailed").
 */
export async function sendHandwryttenCard(
  request: HandwryttenCardRequest,
): Promise<{ orderId: string | null }> {
  const hw = handwryttenClient();
  const testMode = process.env.HANDWRYTTEN_TEST_MODE === "true";
  try {
    await hw.basket.addOrder({
      cardId: process.env.HANDWRYTTEN_CARD_ID as string,
      font: process.env.HANDWRYTTEN_FONT as string,
      addresses: [
        {
          firstName: request.firstName,
          lastName: request.lastName,
          street1: request.street1,
          city: request.city,
          state: request.state,
          zip: request.zip,
          country: "US",
          message: request.message,
          wishes: request.wishes,
        },
      ],
    });
    const result = await hw.basket.send(testMode ? { testMode: true } : {});
    return { orderId: extractOrderId(result) };
  } catch (error) {
    try {
      await hw.basket.clear();
    } catch {
      // Best effort; the real failure below is the one worth surfacing.
    }
    throw error;
  }
}

/**
 * getHandwryttenOrderStatus(orderId): the vendor's status string for a
 * placed order, or null when unavailable.
 */
export async function getHandwryttenOrderStatus(orderId: string): Promise<string | null> {
  const order = await handwryttenClient().orders.get(orderId);
  return order.status ?? null;
}

/**
 * The API does not publish a status enum, so this is a conservative
 * heuristic: unknown statuses simply leave the row at "sent", which is
 * harmless. Matches "Mailed", "Shipped", "Delivered", "Completed", etc.
 */
export function isMailedStatus(status: string): boolean {
  const normalized = status.toLowerCase();
  return ["mail", "ship", "deliver", "complete", "fulfill"].some((word) =>
    normalized.includes(word),
  );
}

/** basket/send returns an untyped record; fish the order id out of the
 *  shapes the API is known to use, and shrug (null) at anything else. */
function extractOrderId(record: Record<string, unknown>): string | null {
  const direct = record.order_id ?? record.id;
  if (typeof direct === "string" || typeof direct === "number") return String(direct);
  const orders = record.orders;
  if (Array.isArray(orders) && orders.length > 0) {
    const first = orders[0] as Record<string, unknown> | undefined;
    const nested = first?.order_id ?? first?.id;
    if (typeof nested === "string" || typeof nested === "number") return String(nested);
  }
  return null;
}
