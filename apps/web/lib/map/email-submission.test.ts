import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  classifyResendHttpFailure,
  submitAgentComposedEmail,
  submitResearchBriefEmail,
} from "./email";
import {
  deliverTaskMessage,
  type TaskDeliveryLedger,
} from "../conversation-continuity/task-delivery";
import type {
  DeliveryAttempt,
} from "../conversation-continuity/delivery-ledger";
import type { TaskReplyContract } from "../conversation-continuity/delivery-policy";
import { resolveReplyIntent } from "../conversation-continuity/reply-policy";

const ORIGINAL_RESEND_API_KEY = process.env.RESEND_API_KEY;
const ORIGINAL_FETCH = globalThis.fetch;
const ORIGINAL_CONSOLE_ERROR = console.error;

async function withMockResend(
  fetchImplementation: typeof fetch,
  operation: () => Promise<void>,
  muteErrors = false,
): Promise<void> {
  process.env.RESEND_API_KEY = "resend-test-key";
  globalThis.fetch = fetchImplementation;
  if (muteErrors) console.error = () => undefined;
  try {
    await operation();
  } finally {
    globalThis.fetch = ORIGINAL_FETCH;
    console.error = ORIGINAL_CONSOLE_ERROR;
    if (ORIGINAL_RESEND_API_KEY === undefined) {
      delete process.env.RESEND_API_KEY;
    } else {
      process.env.RESEND_API_KEY = ORIGINAL_RESEND_API_KEY;
    }
  }
}

describe("Resend submission failure classification", () => {
  it("distinguishes definitive rejection from unknown acceptance", () => {
    assert.equal(classifyResendHttpFailure(400), "rejected");
    assert.equal(classifyResendHttpFailure(401), "rejected");
    assert.equal(classifyResendHttpFailure(408), "unknown");
    assert.equal(classifyResendHttpFailure(429), "unknown");
    assert.equal(classifyResendHttpFailure(500), "unknown");
  });
});

describe("research brief email shell", () => {
  it("rejects a v2 brief that claims same-morning research", async () => {
    let requests = 0;
    await withMockResend(
      async () => {
        requests += 1;
        return Response.json({ id: "must-not-send" });
      },
      async () => {
        const result = await submitResearchBriefEmail(
          "parent@example.com",
          `This morning I researched maps

What I learned: ERIC says paths grow. A small step helps.

Why it's interesting: Story likes maps. Story can trace a path.

Want me to make Story a map game for map tracing?`,
          undefined,
          "research_brief_v2",
        );
        assert.deepEqual(result, { status: "rejected" });
        assert.equal(requests, 0);
      },
    );
  });
});

describe("Resend RFC Message-ID retrieval", () => {
  it("returns the Resend submission id before bounded RFC Message-ID retrieval", async () => {
    const requests: Array<{ url: string; method: string }> = [];

    await withMockResend(
      async (input, init) => {
        const url = String(input);
        requests.push({ url, method: init?.method ?? "GET" });
        if (url === "https://api.resend.com/emails") {
          return Response.json({ id: "resend-api-1" });
        }
        return Response.json({
          message_id: "  Message.Case@resend.dev  ",
        });
      },
      async () => {
        const result = await submitAgentComposedEmail(
          "parent@example.com",
          "Subject",
          ["Body"],
        );

        assert.equal(result.status, "submitted");
        if (result.status !== "submitted") assert.fail("email was not accepted");
        assert.equal(result.providerSubmissionId, "resend-api-1");
        assert.deepEqual(requests, [
          { url: "https://api.resend.com/emails", method: "POST" },
        ]);
        assert.equal(
          await result.retrieveProviderMessageId(),
          "<Message.Case@resend.dev>",
        );
        assert.deepEqual(requests, [
          { url: "https://api.resend.com/emails", method: "POST" },
          {
            url: "https://api.resend.com/emails/resend-api-1",
            method: "GET",
          },
        ]);
      },
    );
  });

  it("preserves POST acceptance when RFC Message-ID retrieval is unavailable", async () => {
    let postedReplyTo: string[] = [];
    await withMockResend(
      async (input, init) => {
        if (String(input) === "https://api.resend.com/emails") {
          postedReplyTo = (
            JSON.parse(String(init?.body)) as { reply_to: string[] }
          ).reply_to;
          return Response.json({ id: "resend-api-2" });
        }
        return new Response(null, { status: 503 });
      },
      async () => {
        const result = await submitAgentComposedEmail(
          "parent@example.com",
          "Subject",
          ["Body"],
          "reply+signed@mail.thankshoma.com",
        );

        assert.equal(result.status, "submitted");
        if (result.status !== "submitted") assert.fail("email was not accepted");
        assert.equal(result.providerSubmissionId, "resend-api-2");
        assert.equal(await result.retrieveProviderMessageId(), null);
        assert.deepEqual(postedReplyTo, [
          "reply+signed@mail.thankshoma.com",
        ]);
      },
      true,
    );
  });

  it("bounds a hanging RFC Message-ID lookup and fails soft", async () => {
    await withMockResend(
      async (input, init) => {
        if (String(input) === "https://api.resend.com/emails") {
          return Response.json({ id: "resend-api-hang" });
        }
        return await new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("aborted", "AbortError"));
          });
        });
      },
      async () => {
        const submission = await Promise.race([
          submitAgentComposedEmail(
            "parent@example.com",
            "Subject",
            ["Body"],
            undefined,
            { rfcMessageIdTimeoutMs: 5 },
          ),
          new Promise<"timed-out">((resolve) => {
            setTimeout(() => resolve("timed-out"), 100);
          }),
        ]);
        assert.notEqual(submission, "timed-out");
        if (submission === "timed-out") return;
        assert.equal(submission.status, "submitted");
        if (submission.status !== "submitted") return;
        assert.equal(await submission.retrieveProviderMessageId(), null);
      },
      true,
    );
  });

  it("does not retrieve the RFC Message-ID before the accepted POST is durable", async () => {
    const requests: string[] = [];
    let durableSubmissionId: string | null = null;
    const attempt: DeliveryAttempt = {
      id: "delivery-crash",
      familyId: "family-1",
      episodeId: "episode-1",
      messageId: "message-1",
      taskRunId: "run-1",
      memberUserId: "member-1",
      channel: "email",
      destination: "parent@example.com",
      providerThreadKey: "email:parent@example.com",
      existingStatus: "pending",
      shouldSend: true,
    };
    const ledger: TaskDeliveryLedger = {
      async beginAttempt() {
        return attempt;
      },
      async finishAttempt(_attempt, outcome) {
        if (outcome.delivered) {
          durableSubmissionId = outcome.providerSubmissionId ?? null;
        }
        throw new Error("simulated crash before durable acceptance");
      },
      async enrichProviderMessageId() {
        assert.fail("enrichment requires durable sent state");
      },
      async openLoop() {},
    };

    await withMockResend(
      async (input) => {
        requests.push(String(input));
        if (String(input) === "https://api.resend.com/emails") {
          return Response.json({ id: "resend-api-crash" });
        }
        return Response.json({ message_id: "<must-not-fetch@example.com>" });
      },
      async () => {
        await assert.rejects(
          deliverTaskMessage(
            {
              familyId: "family-1",
              episodeId: "episode-1",
              messageId: "message-1",
              taskRunId: "run-1",
              kind: "morning_brief",
              text: "Want me to make the game?",
              recipients: [{
                recipientKey: "member:member-1",
                memberUserId: "member-1",
                displayName: "Parent",
                phoneNumbers: [],
                email: "parent@example.com",
              }],
              deliveryMode: "email",
            },
            {
              ledger,
              transports: {
                async sendSms() {
                  assert.fail("not called");
                },
                async sendEmail(email, body) {
                  return await submitAgentComposedEmail(
                    email,
                    "Morning brief",
                    [body],
                  );
                },
              },
            },
          ),
          /simulated crash/u,
        );
        assert.equal(durableSubmissionId, "resend-api-crash");
        assert.deepEqual(requests, ["https://api.resend.com/emails"]);
      },
    );
  });

  it("persists the RFC Message-ID and resolves a substantive native reply", async () => {
    let storedProviderSubmissionId: string | null = null;
    let storedProviderMessageId: string | null = null;
    let postedReplyTo: string[] = [];
    const order: string[] = [];
    const attempt: DeliveryAttempt = {
      id: "delivery-1",
      familyId: "family-1",
      episodeId: "episode-1",
      messageId: "message-1",
      taskRunId: "run-1",
      memberUserId: "member-1",
      channel: "email",
      destination: "parent@example.com",
      providerThreadKey: "email:parent@example.com",
      existingStatus: "pending",
      shouldSend: true,
    };
    const ledger: TaskDeliveryLedger = {
      async beginAttempt() {
        return attempt;
      },
      async finishAttempt(_attempt, outcome) {
        if (outcome.delivered) {
          storedProviderSubmissionId =
            outcome.providerSubmissionId ?? null;
          storedProviderMessageId = outcome.providerMessageId ?? null;
          order.push(`finish:${storedProviderSubmissionId}`);
        }
      },
      async enrichProviderMessageId(
        _attempt,
        providerSubmissionId,
        providerMessageId,
      ) {
        assert.equal(providerSubmissionId, "resend-api-3");
        storedProviderMessageId = providerMessageId;
        order.push(`enrich:${providerMessageId}`);
      },
      async openLoop(
        attempt: DeliveryAttempt,
        contract: TaskReplyContract,
      ) {
        void attempt;
        void contract;
      },
    };

    await withMockResend(
      async (input, init) => {
        if (String(input) === "https://api.resend.com/emails") {
          order.push("post");
          postedReplyTo = (
            JSON.parse(String(init?.body)) as { reply_to: string[] }
          ).reply_to;
          return Response.json({ id: "resend-api-3" });
        }
        order.push("get");
        return Response.json({
          message_id: "<native-outbound@resend.dev>",
        });
      },
      async () => {
        const delivery = await deliverTaskMessage(
          {
            familyId: "family-1",
            episodeId: "episode-1",
            messageId: "message-1",
            taskRunId: "run-1",
            kind: "morning_brief",
            text: "Want me to make the game?",
            recipients: [
              {
                recipientKey: "member:member-1",
                memberUserId: "member-1",
                displayName: "Parent",
                phoneNumbers: [],
                email: "parent@example.com",
              },
            ],
            deliveryMode: "email",
          },
          {
            ledger,
            transports: {
              async sendSms() {
                throw new Error("not called");
              },
              async sendEmail(email, body) {
                return await submitAgentComposedEmail(
                  email,
                  "Morning brief",
                  [body],
                  "reply+signed@mail.thankshoma.com",
                );
              },
            },
          },
        );
        const reply = resolveReplyIntent({
          text: "We tried it after breakfast and it worked well.",
          now: new Date("2026-07-16T14:00:00.000Z"),
          memberUserId: "member-1",
          currentChannel: "email",
          explicitDeliveryId: null,
          providerReplyTo: " native-outbound@resend.dev ",
          candidates: [
            {
              deliveryId: "delivery-1",
              episodeId: "episode-1",
              messageId: "message-1",
              recipientMemberUserId: "member-1",
              channel: "email",
              providerMessageId: storedProviderMessageId,
              sentAt: new Date("2026-07-16T13:00:00.000Z"),
              expiresAt: new Date("2026-07-17T13:00:00.000Z"),
              replyKind: "yes_no",
              destinationAuthenticated: true,
            },
          ],
        });

        assert.equal(delivery.status, "done");
        assert.equal(storedProviderSubmissionId, "resend-api-3");
        assert.equal(
          storedProviderMessageId,
          "<native-outbound@resend.dev>",
        );
        assert.deepEqual(order, [
          "post",
          "finish:resend-api-3",
          "get",
          "enrich:<native-outbound@resend.dev>",
        ]);
        assert.deepEqual(postedReplyTo, [
          "reply+signed@mail.thankshoma.com",
        ]);
        assert.equal(reply.kind, "matched");
        if (reply.kind === "matched") {
          assert.equal(reply.outcome, "answered");
        }
      },
    );
  });
});
