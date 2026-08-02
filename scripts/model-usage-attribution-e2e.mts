import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { EVAL_FIXTURE_FAMILY_ID } from "../apps/web/lib/family-context-eval-fixture";
import { mapDb } from "../apps/web/lib/map/db";

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const materialId = "10000000-0000-4000-8000-000000000252";
const sessionId = "model-usage-e2e-session";
const turnId = "model-usage-e2e-turn";
const sql = mapDb();

try {
  await sql`
    insert into public.materials
      (id, family_id, title, kind, pdf_url, preview_url, html, generation)
    values
      (${materialId}, ${EVAL_FIXTURE_FAMILY_ID}, 'Usage attribution packet',
       'worksheet', 'https://eval.invalid/packet.pdf',
       'https://eval.invalid/packet.jpg', '<p>Count the stars.</p>',
       ${sql.json({ sessionId, turnId })})
  `;

  await sql`
    insert into public.model_usage
      (family_id, surface, channel, model, modality, input_tokens,
       output_tokens, session_id, turn_id, resource_kind, resource_id)
    values
      (${EVAL_FIXTURE_FAMILY_ID}, 'chat', 'web', 'anthropic/claude-sonnet-5',
       'text', 100000, 10000, ${sessionId}, ${turnId}, null, null),
      (${EVAL_FIXTURE_FAMILY_ID}, 'materials_image', 'web', 'openai/gpt-image-2',
       'image', 10000, 10000, ${sessionId}, ${turnId}, null, null),
      (${EVAL_FIXTURE_FAMILY_ID}, 'materials_review', 'web',
       'anthropic/claude-sonnet-5', 'text', 10000, 1000, null, null,
       'material', ${materialId}),
      (${EVAL_FIXTURE_FAMILY_ID}, 'embedding', 'web',
       'openai/text-embedding-3-small', 'embedding', 999999, 0,
       'another-session', 'another-turn', null, null)
  `;

  const report = spawnSync(
    "pnpm",
    [
      "exec",
      "tsx",
      path.join(repoRoot, "scripts/usage-report.mts"),
      "--material",
      materialId,
    ],
    {
      cwd: path.join(repoRoot, "apps/web"),
      env: process.env,
      encoding: "utf8",
    },
  );

  assert.equal(report.status, 0, report.stderr || report.stdout);
  assert.match(report.stdout, /chat\s+anthropic\/claude-sonnet-5\s+calls=1/u);
  assert.match(report.stdout, /materials_image\s+openai\/gpt-image-2\s+calls=1/u);
  assert.match(report.stdout, /materials_review\s+anthropic\/claude-sonnet-5\s+calls=1/u);
  assert.doesNotMatch(report.stdout, /embedding/u);
  assert.match(report.stdout, /estimated total: \$\d+\.\d{2}/u);
  console.log(report.stdout.trim());
  console.log("model usage attribution e2e: PASS");
} finally {
  await sql.end();
}
