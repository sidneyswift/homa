import { defineEvalConfig } from "eve/evals";

/**
 * No shared judge or reporter yet. Routing evals use deterministic tool
 * assertions. The subject lesson workflow eval calls Homa's real model
 * directly with local tool stubs and grades the recorded workflow in code,
 * so it also needs no separate judge model.
 */
export default defineEvalConfig({});
