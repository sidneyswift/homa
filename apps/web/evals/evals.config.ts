import { defineEvalConfig } from "eve/evals";

import { EVAL_FAMILY_FIXTURE_FLAG } from "../lib/family-context-eval-fixture";

/**
 * Eval sessions carry no auth attributes, so without this flag every
 * turn resolves the "no family set up, head to /app" fallback and the
 * agent (correctly) refuses to do family work; the 2026-07-24 routing
 * failures were exactly that. The flag gives eval sessions the synthetic
 * Walker family (lib/family-context-eval-fixture.ts). It is scoped to
 * the eval runner's process tree and is ignored on Vercel by the
 * fixture's own guard. An eval that needs the no-family state can unset
 * it in its own test body.
 */
process.env[EVAL_FAMILY_FIXTURE_FLAG] ??= "1";

/**
 * No shared judge or reporter yet. Routing evals use deterministic tool
 * assertions. The subject lesson workflow eval calls Homa's real model
 * directly with local tool stubs and grades the recorded workflow in code,
 * so it also needs no separate judge model.
 */
export default defineEvalConfig({});
