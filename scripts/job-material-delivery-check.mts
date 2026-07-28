/**
 * Proves the dispatched-material delivery gate does what its ruling says
 * (`voice-dispatch-sandbox-gate`, 2026-07-28), against real data, without
 * sending anything.
 *
 * Read-only by construction: it calls the same two functions
 * `deliverJobMilestone` calls (`mayAttachMaterials`, `jobMaterialMediaUrls`)
 * and never touches the SMS transport, so running it cannot text a parent.
 *
 * Run it in two places:
 *   1. Before flipping HOMA_JOB_MATERIAL_DELIVERY_ENABLED, to confirm a
 *      sandbox family resolves real media and a real family resolves none.
 *   2. After flipping it, to confirm real families now resolve media.
 *
 * It does NOT prove a text arrived on a phone. Nothing here can. That step
 * is a human watching a `+homatest` build finish, and it is the step the
 * gate exists to force.
 *
 *   pnpm check:job-material-delivery
 *
 * Env: apps/web/.env.local (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_DB_PASSWORD).
 * Exit codes: 0 = the gate behaves as ruled, 1 = it does not, 2 = missing env
 * or no data to check against.
 */

import path from "node:path";
import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";

import { mapDb } from "../apps/web/lib/map/db";
import {
  jobMaterialMediaUrls,
  mayAttachMaterials,
} from "../apps/web/lib/jobs/milestone";
import { jobMaterialDeliveryEnabled } from "../apps/web/lib/jobs/flag";

const REPO_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

try {
  loadEnvFile(path.join(REPO_ROOT, "apps/web/.env.local"));
} catch {
  // Fine when the vars arrive via the environment.
}

const FLAG = "HOMA_JOB_MATERIAL_DELIVERY_ENABLED";

let failures = 0;

function check(label: string, ok: boolean, detail?: string): void {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  (${detail})` : ""}`);
}

interface Candidate {
  familyId: string;
  jobId: string;
  title: string;
  artifacts: number;
}

/** One job per sandbox posture that actually produced a material, so the
 * check runs against whatever the fleet really has rather than fixed ids. */
async function candidate(sandbox: boolean): Promise<Candidate | null> {
  const sql = mapDb();
  const rows = await sql<
    { family_id: string; job_id: string; title: string; artifacts: string }[]
  >`
    select j.family_id, j.id as job_id, j.title, count(a.id)::text as artifacts
    from public.agent_jobs j
    join public.families f on f.id = j.family_id
    join public.agent_job_stage_artifacts a
      on a.job_id = j.id and a.family_id = j.family_id and a.kind = 'material'
    where f.sandbox = ${sandbox}
    group by j.family_id, j.id, j.title
    order by max(a.created_at) desc
    limit 1
  `;
  const row = rows[0];
  return row
    ? {
        familyId: row.family_id,
        jobId: row.job_id,
        title: row.title,
        artifacts: Number(row.artifacts),
      }
    : null;
}

async function main(): Promise<void> {
  const flagOn = jobMaterialDeliveryEnabled();
  console.log(`${FLAG} is ${flagOn ? 'set to "true": delivery is OPEN to real families' : "unset: delivery is SANDBOX ONLY"}\n`);

  const sandbox = await candidate(true);
  const real = await candidate(false);

  if (!sandbox && !real) {
    console.error(
      "No job has produced a material artifact yet, so there is nothing to check.",
    );
    process.exit(2);
  }

  if (sandbox) {
    console.log(`sandbox family ${sandbox.familyId}`);
    console.log(`  job "${sandbox.title}" (${sandbox.artifacts} artifact(s))`);
    check("sandbox family is cleared regardless of the flag", await mayAttachMaterials(sandbox.familyId));
    const urls = await jobMaterialMediaUrls(sandbox.familyId, sandbox.jobId);
    for (const url of urls) console.log(`    ${url.slice(0, 48)} ... ${url.slice(-14)}`);
    check("sandbox job resolves at least one media url", urls.length > 0, `${urls.length} url(s)`);
    check("no more than two materials ride on one text", urls.length <= 4, `${urls.length} url(s)`);
    check(
      "a preview image leads, so the picture is what lands",
      urls.length === 0 || /\.(jpg|jpeg|png)$/i.test(urls[0] ?? ""),
      urls[0]?.slice(-4),
    );
  } else {
    console.log("no sandbox family has produced a material yet; skipping that half");
  }

  if (real) {
    console.log(`\nreal family ${real.familyId}`);
    console.log(`  job "${real.title}" (${real.artifacts} artifact(s))`);
    const cleared = await mayAttachMaterials(real.familyId);
    check(
      flagOn ? "real family is cleared, because the flag is on" : "real family is held back by the gate",
      cleared === flagOn,
      `cleared=${cleared}`,
    );
    const urls = await jobMaterialMediaUrls(real.familyId, real.jobId);
    check(
      flagOn ? "real family resolves media" : "real family resolves nothing",
      flagOn ? urls.length > 0 : urls.length === 0,
      `${urls.length} url(s)`,
    );
  } else {
    console.log("\nno real family has produced a material yet; skipping that half");
  }

  // With the flag off, the gate is the sandbox read and an unknown id must
  // fail closed. With the flag on, delivery is open fleet-wide and the gate
  // short-circuits before that read, so the guarantee moves down a layer:
  // the media query is family-scoped, so an unknown family still resolves
  // nothing and no material can ride on a text it does not belong to.
  const unknown = "00000000-0000-0000-0000-000000000000";
  console.log("\nunknown family");
  if (flagOn) {
    check(
      "an unknown family resolves no media even with the flag on",
      (await jobMaterialMediaUrls(unknown, sandbox?.jobId ?? real?.jobId ?? unknown)).length === 0,
    );
  } else {
    check("an id that is not a family fails closed", (await mayAttachMaterials(unknown)) === false);
  }

  console.log(
    failures === 0
      ? "\njob-material-delivery-check: the gate behaves as ruled."
      : `\njob-material-delivery-check: ${failures} check(s) failed.`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(2);
});
