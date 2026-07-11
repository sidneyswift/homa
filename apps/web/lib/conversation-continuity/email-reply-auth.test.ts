import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildSignedReplyAddress,
  emailAuthenticationPasses,
  parseSignedReplyDeliveryId,
} from "./email-reply-auth";

const DELIVERY_ID = "11111111-1111-4111-8111-111111111111";
const SECRET = "continuity-test-secret";

describe("recipient-specific email reply aliases", () => {
  it("round-trips the delivery id only with a valid signature", () => {
    const address = buildSignedReplyAddress(DELIVERY_ID, SECRET);

    assert.equal(
      parseSignedReplyDeliveryId([address], SECRET),
      DELIVERY_ID,
    );
    assert.equal(
      parseSignedReplyDeliveryId(
        [address.replace("reply+", "reply+2")],
        SECRET,
      ),
      null,
    );
  });

  it("ignores ordinary reply addresses", () => {
    assert.equal(
      parseSignedReplyDeliveryId(["homa@mail.thankshoma.com"], SECRET),
      null,
    );
  });
});

describe("legacy sender authentication", () => {
  it("requires a DMARC pass when no signed delivery alias is present", () => {
    assert.equal(
      emailAuthenticationPasses(
        "mx.example; dkim=pass header.d=gmail.com; spf=pass; dmarc=pass",
      ),
      true,
    );
    assert.equal(
      emailAuthenticationPasses(
        "mx.example; dkim=pass header.d=attacker.test; spf=pass; dmarc=fail",
      ),
      false,
    );
    assert.equal(emailAuthenticationPasses(null), false);
  });
});
