import { defineEvalConfig } from "eve/evals";

import {
  applyEvalIsolation,
  describeEvalIsolation,
} from "../lib/eval-isolation";
import { EVAL_FAMILY_FIXTURE_FLAG } from "../lib/family-context-eval-fixture";

/**
 * Eve discovers this file at evals/evals.config.ts after its first dotenv
 * load. Install the credential barrier before the server's second load
 * (#1143, lib/eval-isolation.ts). Model gateway credentials survive;
 * durable-write credentials cannot be restored. `pnpm eval:sandbox` supplies a
 * disposable Postgres for full-fidelity tool writes;
 * HOMA_EVAL_ALLOW_PROD_WRITES=1 is the loud opt-out.
 */
console.error(describeEvalIsolation(applyEvalIsolation(process.env)));

/**
 * Eval sessions carry no auth attributes, so without this flag every
 * turn resolves the "no family set up, head to /app" fallback and the
 * agent (correctly) refuses to do family work; the 2026-07-24 routing
 * failures were exactly that. The flag gives eval sessions the synthetic
 * Walker family (lib/family-context-eval-fixture.ts). Under
 * `pnpm eval:sandbox` it goes further: the sandbox database is seeded
 * with the Walker rows and the eve channel stamps eval sessions
 * family-pinned on them, so family-scoped tools run for real instead of
 * failing closed. It is scoped to the eval runner's process tree and is
 * ignored on Vercel by the fixture's own guard. An eval that needs the
 * no-family state can unset it in its own test body.
 */
process.env[EVAL_FAMILY_FIXTURE_FLAG] ??= "1";

/**
 * No shared judge or reporter yet. Routing evals use deterministic tool
 * assertions. The subject lesson workflow eval calls Homa's real model
 * directly with local tool stubs and grades the recorded workflow in code,
 * so it also needs no separate judge model. Five minutes bounds an eval
 * that forgot its own timeout; explicitly slow material evals keep their
 * reviewed per-eval limits because those override this default.
 */
export default defineEvalConfig({ timeoutMs: 300_000 });
