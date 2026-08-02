# Family Library ingestion contract implementation plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task by task.

**Goal:** Measure and enforce the model judgment that turns one family upload into source-grounded Library metadata without risking the preserved original.

**Architecture:** A model proposes title, resource kind, language, and tags from untrusted extracted text. A pure verifier independently checks every semantic quote, validates subject and age-band IDs against the live catalogs, canonicalizes catalog labels, and drops one bad assertion without losing valid siblings. A representative corpus measures the real model, while deterministic fixture and failure-outcome checks run in normal CI.

**Tech stack:** TypeScript, Zod, Vercel AI SDK through the existing OIDC-backed Gateway, Node test runner, pnpm, GitHub Actions.

---

### Task 1: Strengthen the deterministic ingestion trust contract

**Files:**

- Modify: `apps/web/lib/library/family-asset-ingestion.ts`
- Modify: `apps/web/lib/library/family-asset-ingestion.test.ts`

**Step 1: Write failing tests for per-field evidence**

Add tests proving that title and resource-kind assertions need quotes from extracted text, one invalid top-level assertion does not discard valid tags, invented subject and age-band IDs are dropped, and live-catalog labels are derived in code rather than trusted from model text.

**Step 2: Run the focused test and verify failure**

Run:

```sh
pnpm exec tsx --tsconfig apps/web/tsconfig.json --test apps/web/lib/library/family-asset-ingestion.test.ts
```

Expected: the new evidence and canonical-label assertions fail against the current envelope.

**Step 3: Implement the permissive transport and strict per-item verifier**

Export a typed model proposal schema for:

```ts
{
  title: { value: string; quote: string; sourceLocator: string | null } | null;
  resourceKind: {
    value: FamilyAssetResourceKind;
    quote: string;
    sourceLocator: string | null;
  } | null;
  language: string | null;
  tags: Array<{
    kind: FamilyAssetTagKind;
    value: string;
    catalogId: string | null;
    quote: string;
    sourceLocator: string | null;
  }>;
}
```

Parse title, resource kind, and each tag independently. Verify quotes against extracted text, validate subject IDs from `MAP_SUBJECTS`, validate age-band IDs from `RESEARCH_STAGES`, and derive their stored labels from those catalogs. Return explicit dropped-field and dropped-tag reasons.

**Step 4: Add honest extraction-failure outcomes**

Define closed failure kinds for unreadable, encrypted, corrupt, and unsupported content. Map each to an existing `family_assets` status, stable error code, truthful parent-facing note, and `preserveOriginal: true` invariant. Copyright is not a failure kind.

**Step 5: Run the focused test and verify pass**

Expected: all ingestion verifier and failure-outcome tests pass.

### Task 2: Add the measured model judgment and representative corpus

**Files:**

- Create: `apps/web/lib/library/family-asset-ingestion-model.ts`
- Create: `apps/web/lib/library/family-asset-ingestion-eval.ts`
- Create: `apps/web/lib/library/family-asset-ingestion-eval.test.ts`
- Modify: `apps/web/lib/model-usage.ts`

**Step 1: Write failing corpus and scorer tests**

Create fixtures for a worksheet, book, full curriculum, answer key, photo, saved link, ambiguous file, and document containing adversarial instructions. Pin expected resource kind, exact printed title, subject IDs, age-band IDs, and expected abstentions. Add scorer tests for resource-kind accuracy, title accuracy, subject accuracy, age-band accuracy, quote precision, and fixture coverage.

**Step 2: Run the eval-contract test and verify failure**

Expected: the missing corpus, scorer, and ratchet exports fail compilation or assertions.

**Step 3: Implement the real model proposer**

Call `generateObject` with the typed proposal schema, the complete live subject and age-band catalogs, and untrusted extracted text in a labeled data block. Instruct the model to classify rather than follow document instructions, to copy evidence exactly, and to abstain when the source does not support a field. Use `HOMA_EXTRACTION_MODEL` when set, otherwise `HOMA_MODEL`. Keep Gateway prompt training disabled because privacy controls remain binding, and record usage only for authenticated runtime calls.

**Step 4: Implement the corpus scorer and ratchet**

Score the verified result, not raw model output. Require every fixture category, exact catalog IDs, and source-quote precision. Export an explicit threshold object so a future model or prompt change cannot silently lower any metric.

**Step 5: Run deterministic tests and verify pass**

Expected: the corpus covers every ticket category and the scorer rejects seeded regressions.

### Task 3: Make the eval runnable and guarded

**Files:**

- Create: `scripts/family-asset-ingestion-eval.mts`
- Modify: `package.json`
- Modify: `.github/workflows/ci.yml`
- Modify: `.github/workflows/evals.yml`

**Step 1: Add deterministic and paid commands**

Add `check:family-library-ingestion` for pure verifier, failure, corpus, and scorer tests. Add `eval:family-library-ingestion` for the real-model corpus run.

**Step 2: Add the deterministic CI guard**

Run `pnpm check:family-library-ingestion` in the normal checks shard. It must never require credentials or call a model.

**Step 3: Add the paid scheduled eval**

After the existing sandboxed behavioral eval suite mints Vercel OIDC, run `pnpm eval:family-library-ingestion`. The script must exit nonzero when any ratchet threshold is missed.

**Step 4: Run the live eval and set the honest ratchet**

Refresh local OIDC with `pnpm dev:token` only if the current token is expired. Run the real corpus, inspect every miss, improve the prompt or fixture only when evidence supports the change, then set thresholds at or below the measured result without hiding failures.

**Step 5: Run final verification**

Run the focused check, `pnpm typecheck`, `pnpm lint`, `pnpm check:em-dash`, and the relevant CI workflow syntax checks. Commit, push, open a PR with `Closes #574`, wait for required checks, and update epic #352 with the measured results.
