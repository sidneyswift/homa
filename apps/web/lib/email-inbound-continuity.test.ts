import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  parseInboundEmail,
  parseInboundEmailEvent,
  retrieveInboundEmail,
} from "./email-inbound";

describe("inbound email continuity metadata", () => {
  it("extracts Message-ID and In-Reply-To from Resend headers", () => {
    const email = parseInboundEmail({
      data: {
        from: "Parent <parent@example.com>",
        subject: "Re: Morning brief",
        text: "Yes",
        headers: {
          "message-id": "<incoming-42@example.com>",
          "in-reply-to": "<outbound-17@example.com>",
        },
      },
    });

    assert.equal(email.messageId, "<incoming-42@example.com>");
    assert.equal(email.inReplyTo, "<outbound-17@example.com>");
  });

  it("handles header arrays without trusting casing", () => {
    const email = parseInboundEmail({
      data: {
        from: "parent@example.com",
        text: "Yes",
        headers: [
          { name: "Message-ID", value: "<incoming-99@example.com>" },
          { name: "In-Reply-To", value: "<outbound-88@example.com>" },
        ],
      },
    });

    assert.equal(email.messageId, "<incoming-99@example.com>");
    assert.equal(email.inReplyTo, "<outbound-88@example.com>");
  });
});

describe("current Resend receiving contract", () => {
  it("extracts the email id from the metadata-only webhook", () => {
    assert.deepEqual(
      parseInboundEmailEvent({
        type: "email.received",
        data: {
          email_id: "email-42",
          from: "parent@example.com",
          message_id: "<incoming-42@example.com>",
          subject: "Re: Morning brief",
        },
      }),
      {
        emailId: "email-42",
        fromEmail: "parent@example.com",
        messageId: "<incoming-42@example.com>",
        subject: "Re: Morning brief",
      },
    );
  });

  it("retrieves body and headers before routing the agent turn", async () => {
    const calls: string[] = [];
    const email = await retrieveInboundEmail(
      "email-42",
      "secret-key",
      async (url, init) => {
        calls.push(String(url));
        assert.equal(
          (init?.headers as Record<string, string>).Authorization,
          "Bearer secret-key",
        );
        return new Response(
          JSON.stringify({
            id: "email-42",
            from: "parent@example.com",
            subject: "Re: Morning brief",
            text: "Yes",
            message_id: "<incoming-42@example.com>",
            headers: {
              "in-reply-to": "<outbound-17@example.com>",
            },
          }),
          { status: 200 },
        );
      },
    );

    assert.deepEqual(calls, [
      "https://api.resend.com/emails/receiving/email-42",
    ]);
    assert.equal(email.text, "Yes");
    assert.equal(email.inReplyTo, "<outbound-17@example.com>");
  });
});
