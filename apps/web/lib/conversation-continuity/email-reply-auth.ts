import { createHmac, timingSafeEqual } from "node:crypto";

const REPLY_DOMAIN = "mail.thankshoma.com";
const SIGNATURE_LENGTH = 20;
const REPLY_PATTERN =
  /^reply\+([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.([a-f0-9]{20})@mail\.thankshoma\.com$/iu;

function signature(deliveryId: string, secret: string): string {
  return createHmac("sha256", secret)
    .update(deliveryId)
    .digest("hex")
    .slice(0, SIGNATURE_LENGTH);
}

export function buildSignedReplyAddress(
  deliveryId: string,
  secret: string,
): string {
  return `reply+${deliveryId}.${signature(deliveryId, secret)}@${REPLY_DOMAIN}`;
}

export function parseSignedReplyDeliveryId(
  addresses: string[],
  secret: string,
): string | null {
  for (const raw of addresses) {
    const address = raw.trim().toLowerCase();
    const match = REPLY_PATTERN.exec(address);
    const deliveryId = match?.[1];
    const actual = match?.[2];
    if (!deliveryId || !actual) continue;
    const expected = signature(deliveryId, secret);
    const actualBytes = Buffer.from(actual);
    const expectedBytes = Buffer.from(expected);
    if (
      actualBytes.length === expectedBytes.length &&
      timingSafeEqual(actualBytes, expectedBytes)
    ) {
      return deliveryId;
    }
  }
  return null;
}

export function emailAuthenticationPasses(
  authenticationResults: string | null,
): boolean {
  return Boolean(authenticationResults && /\bdmarc=pass\b/iu.test(authenticationResults));
}
