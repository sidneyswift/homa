# SMS Progress Messages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give parents one immediate progress text before Homa begins a genuinely slow SMS turn, without changing fast replies or adding an unvalidated RCS path.

**Architecture:** Generalize the existing material-build acknowledgement into a focused SMS progress service. The agent remains the slow-turn classifier and calls `send_heads_up` before substantial reasoning, research, or multi-tool work. Material tools retain their automatic fallback on the same dedupe lane, and the completed reply remains unchanged.

**Tech Stack:** TypeScript, Eve tools and instructions, Telnyx SMS REST helper, Node test runner through `tsx`, pnpm, Next.js 16.

**Design contract:** `docs/superpowers/specs/2026-07-11-sms-progress-design.md`

**Git constraint:** Do not create commits unless the user explicitly requests one.

---

## File map

- Create `apps/web/lib/sms-progress.ts`: One testable service for deduped SMS progress submission.
- Create `apps/web/lib/sms-progress.test.ts`: Focused behavior tests for the service.
- Modify `apps/web/lib/voice/telnyx-api.ts`: Accept an optional abort signal without changing existing callers.
- Modify `apps/web/lib/voice/telnyx-api.test.ts`: Prove the signal reaches the Telnyx fetch.
- Delete `apps/web/lib/materials/sms-ack.ts`: Its material-only name no longer matches its responsibility.
- Modify `apps/web/agent/tools/send_heads_up.ts`: Generalize the model-facing tool and await an honest Telnyx result.
- Modify `apps/web/agent/tools/generate_image.ts`: Keep the automatic material fallback on the shared service.
- Modify `apps/web/agent/tools/create_printable.ts`: Keep the automatic material fallback on the shared service.
- Modify `apps/web/agent/instructions/sms-mode.ts`: Define when slow SMS work receives a progress text and when it must remain quiet.
- Modify `apps/web/agent/instructions.md`: Make the global tool-selection rule match SMS mode.
- Modify `apps/web/agent/skills/materials-studio/SKILL.md`: Remove the conflicting duration promise.
- Modify `package.json`: Include the focused test in the continuity guard.
- Modify `HUMAN-TODO.md`: Record the external Telnyx RCS registration prerequisite.
- Modify `README.md`: Record the new service and the design-plan artifact directory.
- Modify `docs/homa-planning/build-log.md`: Record behavior, evidence, and the deferred RCS boundary.

### Task 1: Specify the SMS progress service

**Files:**
- Create: `apps/web/lib/sms-progress.test.ts`
- Create: `apps/web/lib/sms-progress.ts`
- Modify: `package.json:12`

- [ ] **Step 1: Write the failing service tests**

Create `apps/web/lib/sms-progress.test.ts`:

```ts
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

  it("reports a Telnyx rejection honestly", async () => {
    const { dependencies } = progressDependencies({ accepted: false });

    const sent = await sendSmsProgressTextOnce(
      { familyId: "family-1", phoneNumber: "+15555550100" },
      dependencies,
    );

    assert.equal(sent, false);
  });
});
```

- [ ] **Step 2: Run the focused test and verify red**

Run:

```bash
pnpm exec tsx --test apps/web/lib/sms-progress.test.ts
```

Expected: FAIL because `apps/web/lib/sms-progress.ts` does not exist.

- [ ] **Step 3: Implement the minimal service**

Create `apps/web/lib/sms-progress.ts`:

```ts
import { rateLimited } from "./map/ratelimit";
import { sendHomaSms } from "./voice/telnyx-api";

const SMS_PROGRESS_WINDOW_MS = 3 * 60 * 1000;
const DEFAULT_SMS_PROGRESS_TEXT =
  "I’m on it. This may take a moment, and I’ll text you when it’s ready.";

export interface SmsProgressDependencies {
  isRateLimited: (key: string, limit: number, windowMs: number) => boolean;
  sendSms: (phoneNumber: string, text: string) => Promise<boolean>;
}

const defaultDependencies: SmsProgressDependencies = {
  isRateLimited: rateLimited,
  sendSms: sendHomaSms,
};

export async function sendSmsProgressTextOnce(
  options: {
    familyId: string | null;
    phoneNumber: string;
    text?: string;
  },
  dependencies: SmsProgressDependencies = defaultDependencies,
): Promise<boolean> {
  const key = `sms-progress:${options.familyId ?? "unlinked"}:${options.phoneNumber}`;
  if (dependencies.isRateLimited(key, 1, SMS_PROGRESS_WINDOW_MS)) return false;

  try {
    return await dependencies.sendSms(
      options.phoneNumber,
      options.text ?? DEFAULT_SMS_PROGRESS_TEXT,
    );
  } catch (error) {
    console.error(
      "sms progress text failed:",
      error instanceof Error ? error.message : "unknown",
    );
    return false;
  }
}
```

- [ ] **Step 4: Add the focused test to the continuity guard**

Change the root `package.json` script to:

```json
"check:continuity": "tsx --test \"apps/web/lib/conversation-continuity/*.test.ts\" \"apps/web/lib/email-inbound-continuity.test.ts\" \"apps/web/lib/map/email-submission.test.ts\" \"apps/web/lib/sms-progress.test.ts\" \"apps/web/lib/sms-session-epoch.test.ts\""
```

- [ ] **Step 5: Run the focused test and verify green**

Run:

```bash
pnpm exec tsx --test apps/web/lib/sms-progress.test.ts
```

Expected: five passing tests with no warnings.

### Task 1A: Bound the progress-send wait

**Files:**
- Modify: `apps/web/lib/sms-progress.test.ts`
- Modify: `apps/web/lib/sms-progress.ts`
- Modify: `apps/web/lib/voice/telnyx-api.test.ts`
- Modify: `apps/web/lib/voice/telnyx-api.ts`
- Modify: `package.json:12`

- [ ] **Step 1: Write the failing timeout propagation tests**

Add a `createTimeoutSignal` dependency and third `signal` argument to the test
dependency shape, then add this service test:

```ts
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
```

Also add a test whose injected `sendSms` throws. Temporarily capture
`console.error`, restore it with `t.after`, and assert the helper returns
`false` while logging the transport error:

```ts
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
```

In `apps/web/lib/voice/telnyx-api.test.ts`, mock `globalThis.fetch`, configure
safe test environment values, and add:

```ts
it("forwards the caller's abort signal to fetch", async (t) => {
  const originalFetch = globalThis.fetch;
  const controller = new AbortController();
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  globalThis.fetch = async (_input, init) => {
    assert.equal(init?.signal, controller.signal);
    return Response.json({ data: { id: "message-1" } });
  };

  const result = await submitHomaSms(
    "+15555550100",
    "Test message",
    undefined,
    controller.signal,
  );

  assert.deepEqual(result, {
    status: "submitted",
    messageId: "message-1",
  });
});
```

Save and restore `TELNYX_SMS_ENABLED`, `TELNYX_API_KEY`, and
`TELNYX_FROM_NUMBER` around the test. Delete a variable on restore when its
original value was `undefined`.

- [ ] **Step 2: Run both tests and verify red**

Run:

```bash
pnpm exec tsx --test apps/web/lib/sms-progress.test.ts apps/web/lib/voice/telnyx-api.test.ts
```

Expected: the service does not request a timeout signal, and the Telnyx fetch
does not receive the caller's signal.

- [ ] **Step 3: Add the bounded progress path**

In `apps/web/lib/sms-progress.ts`, add:

```ts
const SMS_PROGRESS_SEND_TIMEOUT_MS = 5_000;

export interface SmsProgressDependencies {
  isRateLimited: (key: string, limit: number, windowMs: number) => boolean;
  createTimeoutSignal: (timeoutMs: number) => AbortSignal;
  sendSms: (
    phoneNumber: string,
    text: string,
    signal: AbortSignal,
  ) => Promise<boolean>;
}
```

Configure the defaults and pass the signal:

```ts
const defaultDependencies: SmsProgressDependencies = {
  isRateLimited: rateLimited,
  createTimeoutSignal: AbortSignal.timeout,
  sendSms: (phoneNumber, text, signal) =>
    sendHomaSms(phoneNumber, text, undefined, signal),
};

const signal = dependencies.createTimeoutSignal(SMS_PROGRESS_SEND_TIMEOUT_MS);
return await dependencies.sendSms(
  options.phoneNumber,
  options.text ?? DEFAULT_SMS_PROGRESS_TEXT,
  signal,
);
```

In `apps/web/lib/voice/telnyx-api.ts`, add an optional `signal?: AbortSignal`
fourth parameter to `submitHomaSms` and `sendHomaSms`. Pass it into the fetch
options and from `sendHomaSms` into `submitHomaSms`.

- [ ] **Step 4: Verify the focused cancellation tests are green**

Run:

```bash
pnpm exec tsx --test apps/web/lib/sms-progress.test.ts apps/web/lib/voice/telnyx-api.test.ts
```

Expected: all focused SMS progress and Telnyx tests pass without warnings.

- [ ] **Step 5: Include Telnyx cancellation in the continuity guard**

The final root script is:

```json
"check:continuity": "tsx --test \"apps/web/lib/conversation-continuity/*.test.ts\" \"apps/web/lib/email-inbound-continuity.test.ts\" \"apps/web/lib/map/email-submission.test.ts\" \"apps/web/lib/sms-progress.test.ts\" \"apps/web/lib/sms-session-epoch.test.ts\" \"apps/web/lib/voice/telnyx-api.test.ts\""
```

### Task 2: Move every existing caller to the shared service

**Files:**
- Modify: `apps/web/agent/tools/send_heads_up.ts`
- Modify: `apps/web/agent/tools/generate_image.ts`
- Modify: `apps/web/agent/tools/create_printable.ts`
- Delete: `apps/web/lib/materials/sms-ack.ts`

- [ ] **Step 1: Generalize and await `send_heads_up`**

Replace the material-only import with:

```ts
import { sendSmsProgressTextOnce } from "../../lib/sms-progress";
```

Update the input description to:

```ts
"One short line telling her what you are working through. Do not include markdown, links, or an exact time estimate.",
```

Update the tool description to:

```ts
"Text the parent one short progress message BEFORE slow work in an SMS conversation. Call it first when substantial reasoning, current research, several dependent tools, or a material build would otherwise leave her waiting in silence. Keep the line specific to her request. Do not use it for greetings, quick answers, clarifying questions, signup, consent, invitations, account linking, or one-step record updates. One progress text is allowed per slow turn. The completed reply remains the only reply to the parent's text. It is unnecessary on web chat, where she sees progress live.",
```

Replace the submission with:

```ts
const sent = await sendSmsProgressTextOnce({
  familyId: attributes.familyId ?? null,
  phoneNumber: attributes.phoneNumber,
  text: input.message,
});
```

Update success and failure notes so they say “progress text” and “slow turn,” not “build.”

- [ ] **Step 2: Move the material fallbacks**

In both `generate_image.ts` and `create_printable.ts`, import:

```ts
import { sendSmsProgressTextOnce } from "../../lib/sms-progress";
```

Replace each `sendWaitTextOnce(...)` call with an awaited call:

```ts
await sendSmsProgressTextOnce({
  familyId,
  phoneNumber: attributes.phoneNumber,
});
```

In `generate_image.ts`, preserve `access.familyId` as the `familyId` value.

- [ ] **Step 3: Delete the superseded material-only helper**

Delete `apps/web/lib/materials/sms-ack.ts` after all three imports point to
`apps/web/lib/sms-progress.ts`.

- [ ] **Step 4: Verify the focused service test remains green**

Run:

```bash
pnpm exec tsx --test apps/web/lib/sms-progress.test.ts
```

Expected: seven passing tests.

- [ ] **Step 5: Typecheck the web package**

Run:

```bash
pnpm --filter web typecheck
```

Expected: exit code 0.

### Task 3: Teach Eve the slow-turn boundary

**Files:**
- Modify: `apps/web/agent/instructions/sms-mode.ts`
- Modify: `apps/web/agent/instructions.md`
- Modify: `apps/web/agent/skills/materials-studio/SKILL.md`
- Modify: `apps/web/agent/tools/send_heads_up.ts`

- [ ] **Step 1: Add the SMS-mode policy**

Immediately after the SMS reply-length rule in `sms-mode.ts`, add:

```md
- Call send_heads_up as your FIRST action before substantial reasoning,
  current research, several dependent tools, or a material build. Name what
  you are working through. Do not promise an exact time. Then do the work and
  send the completed reply.
- Never call send_heads_up for greetings, quick answers, clarifying questions,
  signup steps, consent or invitation flows, account linking, or one-step
  memory and record updates.
```

Keep the material-specific child and skill wording, but replace every “minute
or two” promise in `sms-mode.ts`, `instructions.md`, and the materials-studio
skill. Use a duration-free promise to text when the requested material is
ready.

- [ ] **Step 2: Update the global tool-selection table**

Replace the current material-only row with:

```md
| You are about to begin substantial reasoning, current research, several dependent tools, or a material build over SMS | Call send_heads_up FIRST with one specific progress line |
```

- [ ] **Step 3: Run Homa’s copy gates**

Run the Homa copy reviewer against these user-visible strings:

- Default progress text in `apps/web/lib/sms-progress.ts`
- `send_heads_up` input guidance and tool notes
- The new SMS-mode policy

Then run the Homa copy editor on the revised strings. Apply only changes that
preserve the approved behavior: one reassuring sentence, no precise time
promise, no extra text on fast or sensitive flows.

- [ ] **Step 4: Re-run typecheck after copy edits**

Run:

```bash
pnpm --filter web typecheck
```

Expected: exit code 0.

### Task 4: Record the RCS prerequisite and repository map

**Files:**
- Modify: `HUMAN-TODO.md`
- Modify: `README.md`

- [ ] **Step 1: Add the founder-only RCS action**

Under `## Product activation gates` in `HUMAN-TODO.md`, add:

```md
- [ ] Register a branded Homa RCS agent with Telnyx and add the intended test phones during beta review. Record only the approval stage and test date in the build log. Keep agent IDs and account details in server-only environment configuration. After Telnyx supplies a test agent, ask an agent to design and verify `IS_TYPING`, inbound RCS webhooks, one final-reply transport, and SMS fallback before any production flag exists.
```

- [ ] **Step 2: Update the repository map**

Add these rows to `README.md`:

```md
| `apps/web/lib/sms-progress.ts` | Shared, deduped progress-text submission for slow SMS turns and material fallbacks |
| `docs/superpowers/` | Approved feature designs and executable implementation plans |
```

### Task 5: Verify the complete change

**Files:**
- Verify all files listed above.
- Modify: `docs/homa-planning/build-log.md`

- [ ] **Step 1: Run the focused and continuity tests**

Run:

```bash
pnpm exec tsx --test apps/web/lib/sms-progress.test.ts
pnpm check:continuity
```

Expected: every test passes.

- [ ] **Step 2: Run lint for the edited TypeScript files**

Run:

```bash
pnpm --filter web exec eslint \
  lib/sms-progress.ts \
  lib/sms-progress.test.ts \
  lib/voice/telnyx-api.ts \
  lib/voice/telnyx-api.test.ts \
  agent/tools/send_heads_up.ts \
  agent/tools/generate_image.ts \
  agent/tools/create_printable.ts \
  agent/instructions/sms-mode.ts
```

Expected: exit code 0 with no warnings introduced by this work.

- [ ] **Step 3: Run the web typecheck**

Run:

```bash
pnpm --filter web typecheck
```

Expected: exit code 0.

- [ ] **Step 4: Run the required Eve build**

Run:

```bash
pnpm --filter web exec eve build
```

Expected: exit code 0. This specifically proves the edited agent tool and
instruction modules compile outside Next’s bundler.

- [ ] **Step 5: Run the web production build**

Run:

```bash
pnpm --filter web build
```

Expected: exit code 0.

- [ ] **Step 6: Append sanitized implementation evidence**

Append a dated build-log entry that records:

- The user problem: a long reasoning turn looked broken on SMS.
- The selected approach: agent-first progress tool, not a serverless timer.
- The exact exclusions for fast and sensitive flows.
- The focused test command and result.
- Continuity, typecheck, lint, Next build, and Eve build results.
- RCS is deferred until a registered Telnyx beta agent exists.

Do not claim RCS availability or production deployment.

- [ ] **Step 7: Inspect the final diff**

Confirm:

- No destination phone number comes from model input.
- No timer or unvalidated RCS transport was added.
- Fast and sensitive flows are explicitly excluded.
- Existing material tools share the same progress dedupe lane.
- A failed progress text cannot stop the final agent reply.
- No secret, account ID, or test phone appears in tracked files.
