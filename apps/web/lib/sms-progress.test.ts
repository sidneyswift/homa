import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  sendSmsProgressTextOnce,
  type SmsProgressDependencies,
} from "./sms-progress";

function progressDependencies(options?: {
  limited?: boolean;
  accepted?: boolean;
}) {
  const submissions: { phoneNumber: string; text: string }[] = [];
  const dependencies: SmsProgressDependencies = {
    isRateLimited: () => options?.limited ?? false,
    createTimeoutSignal: () => new AbortController().signal,
    sendSms: async (phoneNumber, text) => {
      submissions.push({ phoneNumber, text });
      return options?.accepted ?? true;
    },
  };
  return { dependencies, submissions };
}

describe("SMS progress submission", () => {
  it("submits one custom progress message", async () => {
    const { dependencies, submissions } = progressDependencies();

    const sent = await sendSmsProgressTextOnce(
      {
        familyId: "family-1",
        phoneNumber: "+15555550100",
        text: "I’m checking that now. I’ll text you when I have it.",
      },
      dependencies,
    );

    assert.equal(sent, true);
    assert.deepEqual(submissions, [
      {
        phoneNumber: "+15555550100",
        text: "I’m checking that now. I’ll text you when I have it.",
      },
    ]);
  });

  it("uses the neutral fallback text", async () => {
    const { dependencies, submissions } = progressDependencies();

    await sendSmsProgressTextOnce(
      { familyId: null, phoneNumber: "+15555550101" },
      dependencies,
    );

    assert.equal(
      submissions[0]?.text,
      "I’m on it. This may take a moment, and I’ll text you when it’s ready.",
    );
  });

  it("suppresses a duplicate without contacting Telnyx", async () => {
    const claimedKeys = new Set<string>();
    const { dependencies, submissions } = progressDependencies();
    dependencies.isRateLimited = (key) => {
      const duplicate = claimedKeys.has(key);
      claimedKeys.add(key);
      return duplicate;
    };

    const firstSent = await sendSmsProgressTextOnce(
      { familyId: "family-1", phoneNumber: "+15555550100" },
      dependencies,
    );
    const duplicateSent = await sendSmsProgressTextOnce(
      { familyId: "family-1", phoneNumber: "+15555550100" },
      dependencies,
    );

    assert.equal(firstSent, true);
    assert.equal(duplicateSent, false);
    assert.equal(submissions.length, 1);
  });

  it("keeps each parent phone's progress window independent", async () => {
    const claimedKeys = new Set<string>();
    const { dependencies, submissions } = progressDependencies();
    dependencies.isRateLimited = (key) => {
      const duplicate = claimedKeys.has(key);
      claimedKeys.add(key);
      return duplicate;
    };

    const firstSent = await sendSmsProgressTextOnce(
      { familyId: "family-1", phoneNumber: "+15555550100" },
      dependencies,
    );
    const secondSent = await sendSmsProgressTextOnce(
      { familyId: "family-1", phoneNumber: "+15555550101" },
      dependencies,
    );

    assert.equal(firstSent, true);
    assert.equal(secondSent, true);
    assert.equal(submissions.length, 2);
  });

  it("gives Telnyx a five-second abort signal", async () => {
    const expectedSignal = new AbortController().signal;
    let requestedTimeoutMs: number | null = null;
    let receivedSignal: AbortSignal | undefined;
    const dependencies: SmsProgressDependencies = {
      isRateLimited: () => false,
      createTimeoutSignal: (timeoutMs) => {
        requestedTimeoutMs = timeoutMs;
        return expectedSignal;
      },
      sendSms: async (_phoneNumber, _text, signal) => {
        receivedSignal = signal;
        return true;
      },
    };

    await sendSmsProgressTextOnce(
      { familyId: "family-1", phoneNumber: "+15555550100" },
      dependencies,
    );

    assert.equal(requestedTimeoutMs, 5_000);
    assert.equal(receivedSignal, expectedSignal);
  });

  it("reports a Telnyx rejection honestly", async () => {
    const { dependencies } = progressDependencies({ accepted: false });

    const sent = await sendSmsProgressTextOnce(
      { familyId: "family-1", phoneNumber: "+15555550100" },
      dependencies,
    );

    assert.equal(sent, false);
  });

  it("fails soft when the SMS transport throws", async (t) => {
    const originalConsoleError = console.error;
    let loggedMessage = "";
    console.error = (...args: unknown[]) => {
      loggedMessage = args.join(" ");
    };
    t.after(() => {
      console.error = originalConsoleError;
    });
    const { dependencies } = progressDependencies();
    dependencies.sendSms = async () => {
      throw new Error("transport unavailable");
    };

    const sent = await sendSmsProgressTextOnce(
      { familyId: "family-1", phoneNumber: "+15555550100" },
      dependencies,
    );

    assert.equal(sent, false);
    assert.match(loggedMessage, /transport unavailable/);
  });
});
