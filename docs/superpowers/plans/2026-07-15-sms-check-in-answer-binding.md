# SMS Check-in Answer Binding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Eve judge natural-language SMS assessment answers while deterministic code supplies the one authenticated active check-in and delivery that may change.

**Architecture:** Add one server-only child-progress lookup keyed by authenticated family, recipient, SMS channel, and destination hash. Stamp its result into trusted Eve session attributes, then require `respond_check_in` to match that trusted check-in while the existing progress service continues enforcing recipient, revision, and delivery parity.

**Tech Stack:** TypeScript, Eve, Next.js 16, postgres.js, Supabase Postgres, Telnyx Chat SDK, Node test runner, Vercel.

## Global Constraints

- `familyId`, recipient identity, destination, check-in identity, revision, and delivery identity never come from the model.
- Eve owns semantic judgment and maps answers to `easily`, `getting_there`, `not_yet`, `not_sure`, or `skip`.
- Do not add another answer-phrase list or a second production model call.
- No schema migration is required.
- Keep imports at the top and use exhaustive TypeScript switches.
- Use no em dash in code, comments, docs, or copy.
- Do not change unrelated files or commit unless Sidney explicitly requests a commit.

---

### Task 1: Resolve one authenticated active SMS check-in

**Files:**
- Create: `apps/web/lib/child-progress/active-sms-progress-context.ts`
- Modify: `scripts/child-progress-postgres-test.mts`

**Interfaces:**
- Produces:
  ```ts
  export interface ActiveSmsProgressContext {
    checkInId: string;
    deliveryId: string;
  }

  export function resolveActiveSmsProgressContext(input: {
    familyId: string;
    memberUserId: string | null;
    phoneNumber: string;
  }): Promise<ActiveSmsProgressContext | null>;
  ```
- Security invariant: return a value only when exactly one active check-in points to a sent SMS delivery for the same family, recipient, and hashed destination.

- [x] **Step 1: Write the failing PostgreSQL regression**

Extend the disposable schema's `conversation_deliveries` table with the production columns used by the lookup:

```sql
channel text not null default 'sms',
destination_hash text not null default '',
```

Import the not-yet-created database seam and add fixtures for:

```ts
const exact = await resolveActiveSmsProgressContextWithDatabase(sql, {
  familyId,
  memberUserId,
  phoneNumber,
});
assert.deepEqual(exact, { checkInId, deliveryId });

const wrongPhone = await resolveActiveSmsProgressContextWithDatabase(sql, {
  familyId,
  memberUserId,
  phoneNumber: "+15555550199",
});
assert.equal(wrongPhone, null);
```

Add a second current workflow for the same authenticated destination and assert the resolver returns `null`. Mark the old delivery `replied_at` before one assertion and prove the resolver still returns it, because a clarification must not erase the active workflow.

- [x] **Step 2: Run the PostgreSQL harness and verify RED**

Run:

```sh
pnpm child-progress:e2e
```

Expected: FAIL because `active-sms-progress-context.ts` and its exported database seam do not exist.

- [x] **Step 3: Implement the resolver**

Create the module with this server-only query shape:

```ts
import { hashContinuityKey } from "../conversation-continuity/continuity-service";
import { mapDb } from "../map/db";

export interface ActiveSmsProgressContext {
  checkInId: string;
  deliveryId: string;
}

interface ActiveSmsProgressRow {
  check_in_id: string;
  delivery_id: string;
}

export async function resolveActiveSmsProgressContextWithDatabase(
  sql: ReturnType<typeof mapDb>,
  input: {
    familyId: string;
    memberUserId: string | null;
    phoneNumber: string;
  },
): Promise<ActiveSmsProgressContext | null> {
  const destinationHash = hashContinuityKey(
    `sms:${input.phoneNumber.toLowerCase()}`,
  );
  const rows = await sql<ActiveSmsProgressRow[]>`
    select check_in.id as check_in_id,
           delivery.id as delivery_id
    from public.progress_check_ins check_in
    join public.conversation_deliveries delivery
      on delivery.id = check_in.current_delivery_id
     and delivery.family_id = check_in.family_id
    where check_in.family_id = ${input.familyId}
      and check_in.state = 'active'
      and check_in.prompt_recipient_member_user_id
        is not distinct from ${input.memberUserId}::uuid
      and delivery.recipient_member_user_id
        is not distinct from ${input.memberUserId}::uuid
      and delivery.channel = 'sms'
      and delivery.destination_hash = ${destinationHash}
      and delivery.status = 'sent'
    limit 2
  `;
  return rows.length === 1
    ? {
        checkInId: rows[0].check_in_id,
        deliveryId: rows[0].delivery_id,
      }
    : null;
}

export function resolveActiveSmsProgressContext(input: {
  familyId: string;
  memberUserId: string | null;
  phoneNumber: string;
}): Promise<ActiveSmsProgressContext | null> {
  return resolveActiveSmsProgressContextWithDatabase(mapDb(), input);
}
```

Do not filter on `conversation_deliveries.replied_at`. A clarification may resolve the conversational loop while the progress workflow and its current delivery remain active.

- [x] **Step 4: Run the PostgreSQL harness and verify GREEN**

Run:

```sh
pnpm child-progress:e2e
```

Expected: PASS, including exact phone, wrong phone, multiple workflows, and clarification persistence.

---

### Task 2: Stamp active progress identity into the SMS turn

**Files:**
- Modify: `apps/web/lib/sms-inbound-auth.ts`
- Modify: `apps/web/lib/sms-inbound-auth.test.ts`
- Modify: `apps/web/agent/channels/telnyx.ts`

**Interfaces:**
- Consumes: `resolveActiveSmsProgressContext(...)`.
- Produces two server-only attributes as a pair:
  - `activeProgressCheckInId`
  - `activeProgressDeliveryId`

- [x] **Step 1: Write the failing attribute test**

Extend `trustedSmsInboundIdentityAttributes` with an optional active context and assert:

```ts
assert.deepEqual(
  trustedSmsInboundIdentityAttributes({
    providerMessageId: "telnyx-message-1",
    inboundReceiptId: "11111111-1111-4111-8111-111111111111",
    activeProgressContext: {
      checkInId: "22222222-2222-4222-8222-222222222222",
      deliveryId: "33333333-3333-4333-8333-333333333333",
    },
  }),
  {
    providerMessageId: "telnyx-message-1",
    inboundReceiptId: "11111111-1111-4111-8111-111111111111",
    activeProgressCheckInId:
      "22222222-2222-4222-8222-222222222222",
    activeProgressDeliveryId:
      "33333333-3333-4333-8333-333333333333",
  },
);
```

- [x] **Step 2: Run the focused test and verify RED**

Run:

```sh
pnpm exec tsx --test apps/web/lib/sms-inbound-auth.test.ts
```

Expected: FAIL because the optional active context is not accepted or returned.

- [x] **Step 3: Implement paired trusted attributes**

Add a top-level type import for `ActiveSmsProgressContext`. Return both IDs only when `activeProgressContext` is present. Preserve the current provider-message and inbound-receipt validation.

In `telnyx.ts`:

1. Import `resolveActiveSmsProgressContext`.
2. After family and canonical inbound resolution, call it with the authenticated `familyId`, `memberUserId`, and exact `senderNumber`.
3. On lookup failure, log one bounded error and omit both attributes. Do not drop the SMS.
4. Pass the optional result through `trustedSmsInboundIdentityAttributes` when constructing `send(...).auth.attributes`.

Use this shape:

```ts
let activeProgressContext: ActiveSmsProgressContext | null = null;
if (familyId) {
  try {
    activeProgressContext = await resolveActiveSmsProgressContext({
      familyId,
      memberUserId,
      phoneNumber: senderNumber,
    });
  } catch (error) {
    console.error(
      "telnyx channel: active progress lookup failed:",
      error instanceof Error ? error.message : "unknown",
    );
  }
}
```

- [x] **Step 4: Run the focused test and continuity suite**

Run:

```sh
pnpm exec tsx --test apps/web/lib/sms-inbound-auth.test.ts
pnpm check:continuity
```

Expected: PASS with no new warnings.

---

### Task 3: Require the trusted workflow for SMS progress answers

**Files:**
- Modify: `apps/web/lib/child-progress/types.ts`
- Modify: `apps/web/lib/child-progress/tool-contract.ts`
- Modify: `apps/web/lib/child-progress/tool-adapter.ts`
- Modify: `apps/web/lib/child-progress/tool-trust.test.ts`

**Interfaces:**
- `ProgressCheckInContext` gains optional server-only `activeProgressCheckInId`.
- On SMS, `repliedDeliveryId` comes only from a valid active-progress attribute pair.
- Other channels retain their existing explicit conversation delivery behavior.

- [x] **Step 1: Write failing trusted-context tests**

Create an SMS context containing a generic clarification delivery plus the active progress pair:

```ts
const context = createProgressToolContext({
  access: { familyId: FAMILY_ID },
  attributes: {
    channel: "sms",
    repliedDeliveryId:
      "44444444-4444-4444-8444-444444444444",
    activeProgressCheckInId: CHECK_IN_ID,
    activeProgressDeliveryId:
      "55555555-5555-4555-8555-555555555555",
    canonicalInboundText: "Up to 2",
    canonicalInboundMessageId: MESSAGE_ID,
  },
  sessionId: "session-1",
  turnId: "turn-1",
  now: NOW,
});

assert.equal(context.activeProgressCheckInId, CHECK_IN_ID);
assert.equal(
  context.repliedDeliveryId,
  "55555555-5555-4555-8555-555555555555",
);
```

Add an incomplete-pair case and assert both trusted progress fields become `null`.

Add adapter tests:

1. Matching `checkInId` reaches `respondCheckIn` with the active progress delivery.
2. Another `checkInId` returns `kind: "refused"` and performs zero operations.
3. SMS with no active pair returns `kind: "refused"` and performs zero operations.

- [x] **Step 2: Run the focused tests and verify RED**

Run:

```sh
HOMA_LIVE_PROGRESS_ENABLED=true pnpm exec tsx --tsconfig apps/web/tsconfig.json --test apps/web/lib/child-progress/tool-trust.test.ts
```

Expected: FAIL because the active progress fields and SMS guard do not exist.

- [x] **Step 3: Implement trusted context construction**

In `types.ts`, add:

```ts
activeProgressCheckInId?: string | null;
```

In `createProgressToolContext`, parse both active attributes with
`optionalUuidAttribute`. For SMS, accept them only as a complete pair:

```ts
const channel = progressChannelFromAttributes(attributes.channel);
const activeProgressCheckInId = optionalUuidAttribute(
  attributes.activeProgressCheckInId,
);
const activeProgressDeliveryId = optionalUuidAttribute(
  attributes.activeProgressDeliveryId,
);
const hasActiveProgressPair =
  channel === "sms" &&
  activeProgressCheckInId !== null &&
  activeProgressDeliveryId !== null;
```

Return:

```ts
activeProgressCheckInId: hasActiveProgressPair
  ? activeProgressCheckInId
  : null,
repliedDeliveryId:
  channel === "sms"
    ? hasActiveProgressPair
      ? activeProgressDeliveryId
      : null
    : optionalAttribute(attributes.repliedDeliveryId),
```

In `executeChildProgressCommand`, refuse before any operation when an SMS
`respond_check_in` does not match `context.activeProgressCheckInId`:

```ts
if (
  command.action === "respond_check_in" &&
  context.channel === "sms" &&
  context.activeProgressCheckInId !== command.checkInId
) {
  return refusedProgressResult();
}
```

- [x] **Step 4: Run focused and full ChildProgress checks**

Run:

```sh
HOMA_LIVE_PROGRESS_ENABLED=true pnpm exec tsx --tsconfig apps/web/tsconfig.json --test apps/web/lib/child-progress/tool-trust.test.ts
pnpm check:child-progress
```

Expected: PASS.

---

### Task 4: Remove the phrase workaround and guard Eve's judgment

**Files:**
- Modify: `apps/web/lib/conversation-continuity/reply-policy.ts`
- Modify: `apps/web/lib/conversation-continuity/reply-policy.test.ts`
- Create: `scripts/progress-check-in-answer-model-eval.mts`
- Modify: `package.json`

**Interfaces:**
- Conversation continuity may retain existing context heuristics.
- The incident-specific `up to N` phrase matcher is removed.
- The structural newest-revision filter remains because stale revisions are never causally current.

- [x] **Step 1: Remove the rejected phrase-specific implementation**

Delete:

- `PROGRESS_BOUNDED_QUANTITY_REPLY`
- `isBoundedQuantityProgressReply`
- its call from `isProgressChoiceReply`
- the test named `matches a bounded numeric answer to one same-channel choice loop`

Keep `withoutSupersededProgressCandidates` and its newest-revision regression.

- [x] **Step 2: Add the model behavioral eval**

Create a model-level script using the production `HOMA_MODEL`, base
instructions, and `LINKED_SMS_PROGRESS_GUIDANCE`. Evaluate these cases:

```ts
const cases = [
  {
    message: "Yes up to 2",
    expected: "getting_there",
  },
  {
    message: "Yes",
    expected: "clarify",
  },
  {
    message: "Can we switch to a science activity instead?",
    expected: "topic_change",
  },
] as const;
```

For evaluation only, require exactly one output token from:

```ts
"easily" | "getting_there" | "not_yet" |
"not_sure" | "skip" | "clarify" | "topic_change"
```

Use the current delivered statement from the incident in the prompt, but no
family identifiers or contact data. Tag Gateway calls
`progress_check_in_answer_eval` and keep prompt training disabled.

Add:

```json
"eval:progress-check-in": "tsx scripts/progress-check-in-answer-model-eval.mts"
```

to root scripts.

- [x] **Step 3: Run continuity and model checks**

Run:

```sh
pnpm check:continuity
pnpm eval:progress-check-in
```

Expected: all deterministic tests pass and all three model cases print `PASS`.

---

### Task 5: Verify and deploy the production fix

**Files:**
- Verify every file above.
- Do not include unrelated dirty or untracked workspace files in deployment.

- [x] **Step 1: Run all required local gates**

Run:

```sh
pnpm check:isolation
pnpm check:continuity
pnpm check:child-progress
pnpm child-progress:e2e
pnpm typecheck
pnpm lint
pnpm build
pnpm --filter web exec eve build
```

Expected: exit code 0 for every command. Report any pre-existing lint warning
separately instead of describing lint as warning-free.

- [x] **Step 2: Review the final patch**

Run:

```sh
git diff --check
git diff -- \
  apps/web/agent/channels/telnyx.ts \
  apps/web/lib/child-progress \
  apps/web/lib/conversation-continuity/reply-policy.ts \
  apps/web/lib/conversation-continuity/reply-policy.test.ts \
  apps/web/lib/sms-inbound-auth.ts \
  apps/web/lib/sms-inbound-auth.test.ts \
  scripts/child-progress-postgres-test.mts \
  scripts/progress-check-in-answer-model-eval.mts \
  package.json
```

Confirm no contact data, family IDs, secrets, unrelated cleanup, or answer
phrase workaround remains.

- [x] **Step 3: Deploy only the reviewed source**

Check Vercel authentication and the linked production project. Because the
workspace contains unrelated untracked artifacts, deploy from a clean
temporary export of `HEAD` with only the reviewed files copied into it. Do not
commit or push unless Sidney separately requests that git action.

Wait for the Vercel deployment to become `READY`. If the build fails, inspect
the build logs, fix only the diagnosed issue, and repeat the local build gates.

- [x] **Step 4: Verify production**

1. Confirm the intended production deployment is `READY`.
2. Probe the public app and inspect fresh runtime errors.
3. Confirm the deployed artifact contains the active SMS progress resolver.
4. Run a controlled linked-family SMS check-in if an authenticated test phone
   is available. Verify a bounded answer is accepted after a clarification and
   only one progress response row is written.
5. If no controlled phone is available, state that end-to-end carrier
   verification remains unavailable rather than using the affected family's
   phone or mutating their progress without consent.

- [x] **Step 5: Record truthful handoff**

Report:

- the sanitized root cause;
- the structural fix;
- red-green evidence;
- every local gate and its exact status;
- deployment URL and Vercel state;
- live probe status and any remaining carrier-level verification gap;
- that the affected check-in remains safely paused and can resume with a fresh
  question.
