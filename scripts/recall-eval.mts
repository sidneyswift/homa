/**
 * The microwave eval (founder review 2026-07-10 evening): the Mac mini
 * Homa confidently denied a photo-anchored conversation ever happened
 * because the thread it lived in was invisible to its search. This
 * script pins the cloud answer to that failure class: it seeds a
 * synthetic family with the same shape of history (a typed message
 * about a microwave, a photo-only message that persisted ONLY as its
 * caption block) and asserts the recall tool's own query paths find it.
 *
 * What it proves: retrieval coverage (FTS always; the semantic arm when
 * an embedding key is present). What it cannot prove: the model's
 * conduct on a miss; that lives in agent/instructions.md ("When you
 * cannot find something") and stays a live-harness concern.
 *
 * Usage:
 *   pnpm eval:recall            seed, assert, clean up
 *   pnpm eval:recall -- --keep  leave the synthetic family for a look
 *
 * Env: apps/web/.env.local (SUPABASE_DB_PASSWORD; AI_GATEWAY_API_KEY
 * optional, enables the semantic checks). The synthetic family is
 * created and deleted inside one run; nothing touches real families.
 */

import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
try {
  loadEnvFile(path.join(repoRoot, "apps/web/.env.local"));
} catch {
  // Fine in CI or when env arrives from the shell.
}

const { mapDb } = await import("../apps/web/lib/map/db");
const { recallPinned } = await import("../apps/web/lib/agent-pinned");
const { embedText } = await import("../apps/web/lib/learning/embeddings");

const keep = process.argv.includes("--keep");
const sql = mapDb();

// The seeded history, mirroring the failure: a photo-only exchange whose
// only durable text is the caption block, plus the typed follow-up.
const SEEDED_MESSAGES: { role: "user" | "assistant"; channel: string; content: string }[] = [
  {
    role: "user",
    channel: "sms",
    content: "[Photo attached: An over-range microwave with a loose door handle.]",
  },
  {
    role: "user",
    channel: "sms",
    content:
      "This is my microwave and the handle is coming loose. Can you look up the direction and figure out how I tighten it",
  },
  {
    role: "assistant",
    channel: "sms",
    content:
      "That handle is held by two screws behind the door trim. Open the door, pop the top trim strip, and tighten both Phillips screws snugly.",
  },
  {
    role: "user",
    channel: "web",
    content: "We did 30 minutes of phonics this morning and Maya loved the letter game.",
  },
];

interface Check {
  name: string;
  query: string;
  /** A hit counts when its snippet contains this, case-insensitive. */
  expect: string;
  /** Semantic checks skip (not fail) without an embedding key. */
  needsEmbeddings: boolean;
}

const CHECKS: Check[] = [
  {
    name: "typed message found by the object word",
    query: "microwave",
    expect: "handle is coming loose",
    needsEmbeddings: false,
  },
  {
    name: "photo-only message found through its caption",
    query: "microwave",
    expect: "[photo attached:",
    needsEmbeddings: false,
  },
  {
    name: "detail phrasing finds the exchange",
    query: "loose handle",
    expect: "microwave",
    needsEmbeddings: false,
  },
  {
    name: "the parent's own sentence finds it (semantic arm)",
    query: "where is my chat about the microwave",
    expect: "microwave",
    needsEmbeddings: true,
  },
];

async function main(): Promise<number> {
  const familyRows = await sql<{ id: string }[]>`
    insert into public.families (name) values ('Recall eval (synthetic)')
    returning id
  `;
  const familyId = familyRows[0].id;
  const sessionId = `recall-eval-${Date.now()}`;
  console.log(`Seeded synthetic family ${familyId} (session ${sessionId})`);

  let failures = 0;
  try {
    // Embeddings are best-effort, exactly like production writes: null
    // rows stay FTS-only and the semantic checks report SKIP.
    let embeddingsAvailable = false;
    for (const [sequence, message] of SEEDED_MESSAGES.entries()) {
      const embedding = await embedText(message.content, {
        familyId,
        sessionId,
      });
      if (embedding) embeddingsAvailable = true;
      await sql`
        insert into public.conversation_messages
          (family_id, session_id, sequence, channel, role, content, embedding)
        values
          (${familyId}, ${sessionId}, ${sequence}, ${message.channel},
           ${message.role}, ${message.content}, ${embedding})
      `;
    }
    console.log(
      embeddingsAvailable
        ? "Embeddings live: semantic checks run."
        : "No embedding key: semantic checks will SKIP.",
    );

    for (const check of CHECKS) {
      if (check.needsEmbeddings && !embeddingsAvailable) {
        console.log(`SKIP  ${check.name}`);
        continue;
      }
      const hits = await recallPinned({
        familyId,
        query: check.query,
        scope: "chats",
        limit: 5,
      });
      const found = hits.some((hit) =>
        hit.snippet.toLowerCase().includes(check.expect.toLowerCase()),
      );
      if (found) {
        console.log(`PASS  ${check.name} (query: "${check.query}")`);
      } else {
        failures += 1;
        console.error(`FAIL  ${check.name} (query: "${check.query}")`);
        console.error(
          `      expected a snippet containing "${check.expect}"; got ${hits.length} hits:`,
        );
        for (const hit of hits) {
          console.error(`      - [${hit.when}, ${hit.where}] ${hit.snippet.slice(0, 100)}`);
        }
      }
    }

    // The tenancy probe: another family's recall must see none of this.
    const strangers = await sql<{ id: string }[]>`
      insert into public.families (name) values ('Recall eval bystander (synthetic)')
      returning id
    `;
    const strangerId = strangers[0].id;
    try {
      const crossFamily = await recallPinned({
        familyId: strangerId,
        query: "microwave",
        scope: "chats",
        limit: 5,
      });
      if (crossFamily.length === 0) {
        console.log("PASS  another family's recall sees nothing (isolation)");
      } else {
        failures += 1;
        console.error("FAIL  another family's recall returned this family's rows");
      }
    } finally {
      await sql`delete from public.families where id = ${strangerId}`;
    }
  } finally {
    if (keep) {
      console.log(`Kept synthetic family ${familyId} (--keep); delete it when done.`);
    } else {
      await sql`delete from public.families where id = ${familyId}`;
      console.log("Cleaned up the synthetic family.");
    }
  }

  return failures;
}

const failures = await main();
await sql.end({ timeout: 5 });
if (failures > 0) {
  console.error(`\n${failures} check(s) failed.`);
  process.exit(1);
}
console.log("\nAll recall checks passed.");
