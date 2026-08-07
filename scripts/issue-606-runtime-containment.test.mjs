import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const writers = [
  "apps/web/lib/voice/transcript-sync.ts",
  "scripts/telnyx-transcripts-sync.mts",
];

for (const writer of writers) {
  test(writer + " keeps mutable phone mappings out of adult ownership", () => {
    const source = readFileSync(resolve(repositoryRoot, writer), "utf8");
    assert.match(source, /family_id, child_id,\s*member_user_id, caller_e164/u);
    assert.match(
      source,
      /\$\{owner\.childId\},\s*null,\s*\$\{owner\.caller\}/u
    );
    assert.match(
      source,
      /child_id = excluded\.child_id,\s*member_user_id = null,/u
    );
    assert.doesNotMatch(source, /member_user_id = excluded\.member_user_id/u);
    assert.doesNotMatch(
      source,
      /select[^;]*member_user_id[^;]*from public\.family_phones/su
    );
  });
}

const privilegedReaders = [
  {
    file: "apps/web/lib/agent-pinned.ts",
    required: [
      "memberUserId: string | null",
      "from public.family_members current_member",
      "user_message.member_user_id",
      "is distinct from ${input.memberUserId}",
    ],
  },
  {
    file: "apps/web/lib/conversation-visibility.ts",
    required: [
      "from public.family_members current_member",
      "loadAdultSessionReviewMessages",
      "exportConversationMessagesForAdult",
      "is distinct from ${input.memberUserId}",
    ],
  },
  {
    file: "apps/web/lib/conversation-continuity/postgres-repository.ts",
    required: [
      "from public.family_members current_member",
      "role = 'assistant'",
      "is distinct from ${memberUserId}",
      "delivery.recipient_member_user_id = ${memberUserId}",
    ],
  },
  {
    file: "apps/web/lib/conversation-continuity/ledger.ts",
    required: [
      "from public.family_members current_member",
      "scope = 'member' and member_user_id is null",
      "memberUserId = attrs.memberUserId ?? null",
    ],
  },
  {
    file: "apps/web/lib/conversation-continuity/web-session-binding.ts",
    required: [
      "from public.family_members current_member",
      "webSessionThreadHash(input.memberUserId)",
    ],
  },
  {
    file: "apps/web/lib/voice/recent-calls.ts",
    required: [
      "t.member_user_id = ${input.memberUserId}",
      "from public.family_members current_member",
    ],
  },
  {
    file: "apps/web/lib/learning/call-memory.ts",
    required: [
      "member_user_id is not null",
      "from public.family_members current_member",
    ],
  },
];

for (const reader of privilegedReaders) {
  test(reader.file + " contains current-member raw-history access", () => {
    const source = readFileSync(resolve(repositoryRoot, reader.file), "utf8");
    for (const required of reader.required) {
      assert.ok(
        source.includes(required),
        `${reader.file} is missing ${JSON.stringify(required)}`
      );
    }
  });
}

test("routes use the shared adult visibility boundary", () => {
  const exportRoute = readFileSync(
    resolve(
      repositoryRoot,
      "apps/web/app/api/account-deletion/export/route.ts"
    ),
    "utf8"
  );
  const reviewRoute = readFileSync(
    resolve(repositoryRoot, "apps/web/app/api/learning/review/route.ts"),
    "utf8"
  );
  const review = readFileSync(
    resolve(repositoryRoot, "apps/web/lib/learning/session-review.ts"),
    "utf8"
  );
  assert.match(exportRoute, /exportConversationMessagesForAdult/u);
  assert.match(reviewRoute, /memberUserId: auth\.userId/u);
  assert.match(review, /loadAdultSessionReviewMessages/u);
});
