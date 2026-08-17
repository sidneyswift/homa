import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import {
  deletionBillingDecision,
  retryableDeletionFailure,
  runAccountDeletionCleanup,
} from "./account-deletion";
import {
  deletionConfirmationFor,
  hasExactDeletionConfirmation,
} from "./account-deletion-confirmation";
import {
  canMarkApplePurchaseInterlockPhase,
  resolveApplePurchaseClaim,
  type PendingApplePurchaseClaim,
} from "./billing/apple-purchase-interlock";

const execFileAsync = promisify(execFile);

test("requires the exact family-specific deletion phrase", () => {
  const expected = deletionConfirmationFor("Rivera family");
  assert.equal(expected, "Delete Rivera family");
  assert.equal(hasExactDeletionConfirmation("Rivera family", expected), true);
  assert.equal(hasExactDeletionConfirmation("Rivera family", "delete Rivera family"), false);
  assert.equal(hasExactDeletionConfirmation("Rivera family", "Delete Rivera Family"), false);
});

test("cancels both an active trial and a paid Stripe subscription before deletion", () => {
  const decision = deletionBillingDecision([
    { provider: "stripe", provider_subscription_id: "sub_trial", status: "trialing" },
    { provider: "stripe", provider_subscription_id: "sub_paid", status: "active" },
  ]);
  assert.deepEqual(decision, {
    stripeSubscriptionIds: ["sub_trial", "sub_paid"],
    blockedProvider: null,
  });
});

test("requires the native store to stop an active native subscription", () => {
  const decision = deletionBillingDecision([
    { provider: "apple", provider_subscription_id: "original_transaction", status: "active" },
  ]);
  assert.equal(decision.blockedProvider, "apple");
  assert.deepEqual(decision.stripeSubscriptionIds, []);
});

test("a cleanup failure remains explicitly retryable", () => {
  assert.deepEqual(retryableDeletionFailure(new Error("private Blob unavailable")), {
    status: "retryable_failed",
    message: "private Blob unavailable",
  });
});

test("erases database access before artifact cleanup can become retryable", async () => {
  const calls: string[] = [];

  await assert.rejects(
    runAccountDeletionCleanup({
      finalize: false,
      eraseDatabaseRecords: async () => {
        calls.push("database");
        return [];
      },
      deleteArtifacts: async () => {
        calls.push("artifacts");
        throw new Error("private Blob unavailable");
      },
    }),
    /private Blob unavailable/u,
  );

  assert.deepEqual(calls, ["database", "artifacts"]);
});

test("waits through delegated uploads and sweeps again before completion", async () => {
  const artifacts = ["initial"];
  const sweep = async (finalize: boolean) => runAccountDeletionCleanup({
    finalize,
    eraseDatabaseRecords: async () => [],
    deleteArtifacts: async () => {
      const deleted = artifacts.length;
      artifacts.splice(0, artifacts.length);
      return [deleted];
    },
  });

  assert.deepEqual(await sweep(false), { artifactCount: 1, state: "draining" });
  artifacts.push("uploaded-with-an-already-issued-token");
  assert.deepEqual(await sweep(true), { artifactCount: 1, state: "verifying" });
  assert.deepEqual(artifacts, []);
});

test("atomically erases family access before artifact cleanup", async () => {
  const source = await readFile(new URL("./account-deletion.ts", import.meta.url), "utf8");
  assert.match(source, /delete from public\.agent_schedules where family_id/u);
  assert.match(source, /delete from auth\.sessions where user_id/u);
  assert.doesNotMatch(source, /delete from auth\.users/u);
  assert.match(source, /order by target\.user_id[\s\S]*for update of target, auth_user/u);
  assert.match(source, /set status = 'deleted'/u);
  assert.match(
    source,
    /set status = 'deleted'[\s\S]*await eraseFamilyRecordsInTransaction\(tx, familyId\)[\s\S]*status = 'waiting_for_artifacts'/u,
  );
  assert.match(source, /delete from public\.model_usage where family_id/u);
  assert.match(source, /delete from public\.email_sends where family_id/u);
  assert.match(source, /acknowledgment\.source = 'email_send'/u);
  assert.match(source, /from public\.family_phones phone[\s\S]*phone\.phone_e164 = lead\.phone_e164/u);
  assert.match(source, /final_cleanup_after = now\(\) \+ interval '6 hours 30 minutes'/u);
  assert.match(
    source,
    /HOMA_LESSON_READ_WRITE_TOKEN[\s\S]*familyBlobToken\(\)[\s\S]*for \(const token of tokens\)/u,
  );
});

test("commits the recovery fence before invoking the provider worker", async () => {
  const source = await readFile(new URL("./account-deletion.ts", import.meta.url), "utf8");
  const requestStart = source.indexOf("export async function requestAccountDeletion");
  const requestEnd = source.indexOf("async function deletePrivateLessonBlobs");
  const request = source.slice(requestStart, requestEnd);

  assert.match(request, /values \(\$\{input\.familyId\}, \$\{input\.userId\}, 'preparing'\)/u);
  assert.match(request, /snapshotFamilyArtifactPrefixes/u);
  assert.doesNotMatch(request, /dependencies\.reconcileStripe\(/u);
  assert.match(request, /return await runAccountDeletionJob/u);
  assert.match(request, /await dependencies\.acknowledgePreparationCommit\?\.\(\)/u);
  assert.match(
    request,
    /catch \(error\)[\s\S]*durableResultAfterRequestPreparationError/u,
  );
  assert.match(
    request,
    /if \(billing\.blockedProvider\)[\s\S]*pendingApplePurchaseDeletion\(existingJob\?\.id\)[\s\S]*blockedDeletion\(billing\.blockedProvider, existingJob\?\.id\)/u,
  );
});

test("a reclaimed deletion job fences every older worker write", async () => {
  const source = await readFile(new URL("./account-deletion.ts", import.meta.url), "utf8");
  const workerStart = source.indexOf("export async function runAccountDeletionJob");
  const workerEnd = source.indexOf("export async function retryPendingAccountDeletions");
  assert.notEqual(workerStart, -1);
  assert.notEqual(workerEnd, -1);
  const worker = source.slice(workerStart, workerEnd);

  assert.match(worker, /attempts = attempts \+ 1/u);
  assert.match(worker, /status, attempts[\s\S]*const leaseAttempt = job\.attempts/u);
  assert.match(worker, /status in \('preparing', 'waiting_for_artifacts', 'retryable_failed'\)/u);
  assert.match(worker, /job\.family_exists/u);
  assert.match(
    source,
    /where id = \$\{jobId\}[\s\S]*and status = 'running'[\s\S]*and attempts = \$\{leaseAttempt\}[\s\S]*for update/u,
  );

  assert.match(
    worker,
    /if \(!job\.family_id\)[\s\S]*status = 'complete'[\s\S]*completed_at = coalesce\(completed_at, now\(\)\)/u,
  );
  assert.match(
    source,
    /set status = 'preparing'[\s\S]*and status = 'running'[\s\S]*and attempts = \$\{leaseAttempt\}/u,
  );
  assert.match(source, /const authUserCount = await dependencies\.deleteAuthUsers/u);
  assert.match(source, /avatarCount, authUserCount/u);
  assert.match(
    worker,
    /catch \(error\)[\s\S]*return await durableResultAfterPreparationError\(job\.id\)/u,
  );
  assert.match(
    source,
    /async function durableResultAfterPreparationError[\s\S]*exists \([\s\S]*from public\.families family[\s\S]*!durable\.family_exists[\s\S]*return acceptedDeletion\(jobId\)/u,
  );
  assert.match(
    source,
    /durable\.status === "blocked"[\s\S]*durablyBlockedDeletion\(jobId\)/u,
  );
  assert.match(
    source,
    /blocked_provider[\s\S]*durable\.blocked_provider[\s\S]*blockedDeletion\(durable\.blocked_provider, jobId\)/u,
  );
});

test("pending deletion retries rotate by oldest last attempt", async () => {
  const source = await readFile(new URL("./account-deletion.ts", import.meta.url), "utf8");
  const migration = await readFile(
    new URL("../../../supabase/migrations/20260808171500_account_deletion_avatar_cleanup.sql", import.meta.url),
    "utf8",
  );
  const schedulerStart = source.indexOf("export async function retryPendingAccountDeletions");
  const schedulerEnd = source.indexOf("export async function sweepCompletedDeletionTombstones");
  const scheduler = source.slice(schedulerStart, schedulerEnd);

  assert.match(scheduler, /order by updated_at, requested_at, id/u);
  assert.match(
    migration,
    /account_deletion_jobs \(updated_at, requested_at, id\)[\s\S]*where status in \('preparing', 'waiting_for_artifacts', 'retryable_failed'\)/u,
  );
});

test("Apple purchase phases keep client cancellation behind the StoreKit boundary", () => {
  assert.equal(
    canMarkApplePurchaseInterlockPhase("prepared", "cancel_pending"),
    false,
  );
  assert.equal(
    canMarkApplePurchaseInterlockPhase("store_started", "cancel_pending"),
    true,
  );
  assert.equal(
    canMarkApplePurchaseInterlockPhase("cancel_pending", "cancel_pending"),
    true,
  );
  assert.equal(
    canMarkApplePurchaseInterlockPhase("canceled", "store_started"),
    false,
  );
});

test("Apple purchase claims bind a fresh attempt to its exact signed product", () => {
  const pendingClaim: PendingApplePurchaseClaim = {
    attemptId: "11111111-1111-4111-8111-111111111111",
    familyId: "22222222-2222-4222-8222-222222222222",
    productId: "com.thankshoma.homa.regular.monthly",
    state: "store_started",
  };

  assert.deepEqual(
    resolveApplePurchaseClaim({
      authenticatedFamilyId: pendingClaim.familyId,
      linkedFamilyId: null,
      pendingClaim,
      signedProductId: pendingClaim.productId,
    }),
    {
      kind: "fresh",
      familyId: pendingClaim.familyId,
      purchaseAttemptId: pendingClaim.attemptId,
    },
  );
  assert.deepEqual(
    resolveApplePurchaseClaim({
      authenticatedFamilyId: pendingClaim.familyId,
      linkedFamilyId: null,
      pendingClaim,
      signedProductId: "com.thankshoma.homa.regular.annual",
    }),
    { kind: "rejected", reason: "product-mismatch" },
  );
  assert.deepEqual(
    resolveApplePurchaseClaim({
      authenticatedFamilyId: pendingClaim.familyId,
      linkedFamilyId: pendingClaim.familyId,
      pendingClaim,
      signedProductId: "com.thankshoma.homa.regular.annual",
    }),
    {
      kind: "linked",
      familyId: pendingClaim.familyId,
      purchaseAttemptId: null,
    },
  );
});

test("Apple purchase and deletion share a durable race fence", async () => {
  const deletion = await readFile(
    new URL("./account-deletion.ts", import.meta.url),
    "utf8",
  );
  const wall = await readFile(new URL("./billing/wall.ts", import.meta.url), "utf8");
  const interlock = await readFile(
    new URL("./billing/apple-purchase-interlock.ts", import.meta.url),
    "utf8",
  );
  const confirmRoute = await readFile(
    new URL("../app/api/billing/apple/confirm/route.ts", import.meta.url),
    "utf8",
  );
  const webhookRoute = await readFile(
    new URL("../app/api/billing/apple/webhook/route.ts", import.meta.url),
    "utf8",
  );
  const interlockRoute = await readFile(
    new URL("../app/api/billing/apple/purchase-interlock/route.ts", import.meta.url),
    "utf8",
  );
  const interlockMigration = await readFile(
    new URL(
      "../../../supabase/migrations/20260808184500_apple_purchase_interlock.sql",
      import.meta.url,
    ),
    "utf8",
  );
  const mobileBilling = await readFile(
    new URL("../../mobile/src/lib/billing.ts", import.meta.url),
    "utf8",
  );
  const mobileGate = await readFile(
    new URL("../../mobile/src/components/billing-gate.tsx", import.meta.url),
    "utf8",
  );

  const lockHelper = deletion.slice(
    deletion.indexOf("async function lockDeletionFamily"),
    deletion.indexOf("function rejectedDeletion"),
  );
  assert.ok(lockHelper.indexOf("for update") >= 0);
  assert.ok(
    lockHelper.indexOf("for update")
      < lockHelper.indexOf("from public.apple_purchase_interlocks"),
  );
  assert.doesNotMatch(
    lockHelper.slice(0, lockHelper.indexOf("for update")),
    /apple_purchase_interlocks/u,
  );

  assert.match(
    interlock,
    /from public\.families family[\s\S]*for update[\s\S]*account_deletion_artifact_tombstones[\s\S]*apple_purchase_interlocks/u,
  );
  assert.match(
    interlock,
    /insert into public\.apple_purchase_interlocks[\s\S]*attempt_id, family_id, product_id, state[\s\S]*update public\.apple_purchase_interlocks[\s\S]*state = 'resolved'[\s\S]*created_at <= to_timestamp/u,
  );
  assert.match(
    interlock,
    /lower\(interlock\.attempt_id::text\) = lower\(\$\{appAccountToken\}\)/u,
  );
  assert.doesNotMatch(interlock, /delete from public\.apple_purchase_interlocks/u);
  assert.match(
    interlockMigration,
    /state in \([\s\S]*'prepared'[\s\S]*'store_started'[\s\S]*'cancel_pending'[\s\S]*'canceled'[\s\S]*'resolved'[\s\S]*apple_purchase_interlocks_one_active_family_idx[\s\S]*families_apple_purchase_interlock_guard/u,
  );
  assert.match(interlockRoute, /export async function GET/u);
  assert.match(interlockRoute, /export async function PATCH/u);
  assert.match(interlockRoute, /attemptId[\s\S]*beginApplePurchaseInterlock/u);
  assert.match(interlockRoute, /appleProductAvailableForNewPurchase\(productId\)/u);
  assert.match(
    interlockRoute,
    /return requireFamilyFromRequest\(request\)/u,
  );
  assert.doesNotMatch(
    interlockRoute,
    /requireFamilyFromBearer|await requireFamily\(\)/u,
  );
  assert.match(confirmRoute, /await requireFamilyFromRequest\(request\)/u);
  assert.doesNotMatch(
    confirmRoute,
    /requireFamilyFromBearer|await requireFamily\(\)/u,
  );
  assert.match(mobileBilling, /beginApplePurchase[\s\S]*purchase-interlock/u);
  assert.match(mobileBilling, /abandonApplePurchase[\s\S]*method: "DELETE"/u);
  assert.ok(
    mobileBilling.indexOf("persistApplePurchaseAttempt(persisted)")
      < mobileBilling.indexOf('method: "POST"'),
  );
  assert.match(mobileBilling, /resumeApplePurchaseConfirmation/u);
  const mobileCancellation = mobileBilling.slice(
    mobileBilling.indexOf("export async function abandonApplePurchase"),
    mobileBilling.indexOf("export async function markApplePurchaseStoreStarted"),
  );
  assert.ok(
    mobileCancellation.indexOf('method: "DELETE"')
      < mobileCancellation.indexOf("markApplePurchaseCancellationPending"),
  );
  assert.doesNotMatch(
    mobileCancellation.slice(0, mobileCancellation.indexOf('method: "DELETE"')),
    /cancel_pending/u,
  );
  assert.match(
    mobileBilling,
    /canonicalStoreKitFinishPurchase[\s\S]*id: purchase\.id[\s\S]*ids: purchase\.ids[\s\S]*isAutoRenewing: purchase\.isAutoRenewing[\s\S]*platform: purchase\.platform[\s\S]*productId: purchase\.productId[\s\S]*purchaseState: purchase\.purchaseState[\s\S]*purchaseToken: purchase\.purchaseToken[\s\S]*quantity: purchase\.quantity[\s\S]*store: purchase\.store[\s\S]*transactionDate: purchase\.transactionDate[\s\S]*transactionId: purchase\.transactionId/u,
  );
  const mobileJournalRead = mobileBilling.slice(
    mobileBilling.indexOf("async function readApplePurchaseAttempt"),
    mobileBilling.indexOf("async function persistApplePurchaseAttempt"),
  );
  assert.match(mobileJournalRead, /CORRUPTED_APPLE_PURCHASE_ATTEMPT_ID/u);
  assert.doesNotMatch(mobileJournalRead, /AsyncStorage\.removeItem/u);
  const mobileConfirmation = mobileBilling.slice(
    mobileBilling.indexOf("export async function confirmApplePurchase"),
    mobileBilling.indexOf("export async function resumeApplePurchaseConfirmation"),
  );
  assert.match(
    mobileConfirmation,
    /current\?\.attemptId\.toLowerCase\(\) === signedAttemptId[\s\S]*phase: "confirm_pending"[\s\S]*finishPurchase: canonicalStoreKitFinishPurchase\(finishPurchase\)[\s\S]*persistApplePurchaseAttempt\(confirmPending\)[\s\S]*method: "POST"/u,
  );
  assert.match(
    mobileConfirmation,
    /phase: "finish_pending"[\s\S]*persistApplePurchaseAttempt\(finishPending\)/u,
  );
  assert.doesNotMatch(mobileConfirmation, /clearApplePurchaseAttempt/u);
  assert.match(
    mobileBilling,
    /pendingApplePurchaseFinish[\s\S]*current\?\.phase !== "finish_pending"[\s\S]*completeApplePurchaseFinish[\s\S]*current\.phase !== "finish_pending"[\s\S]*clearApplePurchaseAttempt/u,
  );
  assert.ok(
    mobileGate.indexOf("await beginApplePurchase")
      < mobileGate.indexOf("await requestPurchase"),
  );
  assert.ok(
    mobileGate.indexOf("purchaseInFlightRef.current = true")
      < mobileGate.indexOf("await beginApplePurchase"),
  );
  assert.ok(
    mobileGate.indexOf("await markApplePurchaseStoreStarted")
      < mobileGate.indexOf("await requestPurchase"),
  );
  const purchaseErrorCallback = mobileGate.slice(
    mobileGate.indexOf("onPurchaseError:"),
    mobileGate.indexOf("const handlePurchase ="),
  );
  const exactPurchaseRequest = mobileGate.slice(
    mobileGate.indexOf("async function handleBuy"),
    mobileGate.indexOf("async function handleRestore"),
  );
  assert.doesNotMatch(purchaseErrorCallback, /abandonApplePurchase/u);
  assert.doesNotMatch(mobileGate, /purchaseSucceeded(?:Attempt)?Ref/u);
  assert.match(
    exactPurchaseRequest,
    /const attemptId = interlock\.attemptId[\s\S]*markApplePurchaseStoreStarted[\s\S]*abandonApplePurchase\(familyId, attemptId\)[\s\S]*requestPurchase[\s\S]*catch \{[\s\S]*abandonApplePurchase\(familyId, attemptId\)/u,
  );
  assert.doesNotMatch(exactPurchaseRequest, /abandonApplePurchase\(.*purchaseAttemptRef\.current/u);
  assert.match(mobileGate, /appAccountToken: attemptId/u);
  assert.equal(mobileGate.match(/useIAP\(/gu)?.length, 1);
  const storeKitBoundary = mobileGate.slice(
    mobileGate.indexOf("function StoreKitBillingBoundary"),
    mobileGate.indexOf("function PlanPicker"),
  );
  assert.ok(
    storeKitBoundary.indexOf("useIAP({")
      < storeKitBoundary.indexOf("if (gate.open)"),
  );
  assert.match(
    mobileGate,
    /storeKitPurchaseAttemptId[\s\S]*"appAccountToken" in purchase[\s\S]*purchase\.appAccountToken\.toLowerCase\(\)/u,
  );
  assert.match(
    storeKitBoundary,
    /confirmApplePurchase\([\s\S]*purchase,[\s\S]*await finishTransaction\(\{ purchase \}\)[\s\S]*completeApplePurchaseFinish\(familyId, result\.purchaseAttemptId\)[\s\S]*await onUnlocked\(\)/u,
  );
  assert.match(
    storeKitBoundary,
    /resumeApplePurchaseConfirmation\(familyId\)[\s\S]*pendingApplePurchaseFinish\(familyId\)[\s\S]*finishTransaction\(\{ purchase: pendingFinish\.purchase \}\)[\s\S]*completeApplePurchaseFinish\([\s\S]*pendingFinish\.attemptId[\s\S]*await onUnlocked\(\)/u,
  );
  assert.match(
    storeKitBoundary,
    /getPendingTransactionsIOS\(\)[\s\S]*recoverablePurchases = recoveryAttempt[\s\S]*storeKitPurchaseAttemptId\(purchase\)[\s\S]*recoveryAttempt\.attemptId\.toLowerCase\(\)[\s\S]*APPLE_PRODUCT_IDS\.includes\(purchase\.productId\)[\s\S]*handlePurchase\(purchase\)[\s\S]*catch \{[\s\S]*recoveringFamiliesRef\.current\.delete\(familyId\)/u,
  );
  const storeKitRecovery = storeKitBoundary.slice(
    storeKitBoundary.indexOf("const runApplePurchaseRecovery"),
    storeKitBoundary.indexOf("void Promise.resolve().then(runApplePurchaseRecovery)"),
  );
  assert.doesNotMatch(storeKitRecovery, /if \(!recoveryAttempt\) return/u);
  assert.match(
    storeKitBoundary,
    /Promise\.resolve\(\)\.then\(runApplePurchaseRecovery\)[\s\S]*AppState\.addEventListener\("change"[\s\S]*nextState === "active"[\s\S]*runApplePurchaseRecovery\(\)/u,
  );
  assert.match(
    exactPurchaseRequest,
    /const safelyCanceled = await abandonApplePurchase[\s\S]*safelyCanceled[\s\S]*Homa can't confirm whether the App Store finished this purchase/u,
  );

  assert.match(
    wall,
    /recordFamilyAppleSubscription[\s\S]*account_deletion_artifact_tombstones[\s\S]*as account_closing[\s\S]*if \(accountClosing\) throw new AppleFamilyUnavailableError/u,
  );
  assert.match(
    confirmRoute,
    /error instanceof AppleFamilyUnavailableError[\s\S]*reason: "account-closing"/u,
  );
  assert.match(
    wall,
    /recordVerifiedFamilyAppleSubscriptionStatus[\s\S]*apple_original_transaction_id = \$\{sub\.originalTransactionId\}[\s\S]*clearApplePurchaseInterlockAfterVerifiedTransaction/u,
  );
  assert.match(
    webhookRoute,
    /pendingApplePurchaseClaimForAttempt[\s\S]*resolveApplePurchaseClaim[\s\S]*claim\.kind === "fresh"[\s\S]*recordFamilyAppleSubscription/u,
  );
  assert.match(webhookRoute, /recordVerifiedFamilyAppleSubscriptionStatus/u);
  assert.match(
    confirmRoute,
    /resolveApplePurchaseClaim[\s\S]*claim\.kind === "fresh"[\s\S]*appleProductAvailableForNewPurchase/u,
  );
  assert.match(confirmRoute, /purchaseAttemptId: claim\.purchaseAttemptId/u);
  assert.match(confirmRoute, /purchaseDateMs: decoded\.purchaseDate/u);
  assert.doesNotMatch(confirmRoute, /legacyFamilyToken/u);
  assert.doesNotMatch(confirmRoute, /purchaseAttemptId: decoded\.appAccountToken/u);
});

test("every production family hard delete uses the guarded protocol", async () => {
  const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));
  const { stdout } = await execFileAsync("git", ["ls-files", "apps/web"] , {
    cwd: repoRoot,
  });
  const hardDeleteFiles: string[] = [];
  for (const relativePath of stdout.split("\n").filter(Boolean)) {
    if (
      !/\.(?:ts|tsx)$/u.test(relativePath)
      || /\.(?:test|spec)\.(?:ts|tsx)$/u.test(relativePath)
    ) {
      continue;
    }
    const source = await readFile(path.join(repoRoot, relativePath), "utf8");
    if (
      /delete\s+from\s+public\.families/iu.test(source)
      || /\.from\(["']families["']\)[\s\S]{0,160}?\.delete\(/u.test(source)
    ) {
      hardDeleteFiles.push(relativePath);
    }
  }
  assert.deepEqual(hardDeleteFiles.sort(), [
    "apps/web/lib/account-deletion.ts",
    "apps/web/lib/family-fold.ts",
  ]);

  const protocolMigration = await readFile(
    new URL(
      "../../../supabase/migrations/20260808170000_family_hard_delete_protocol.sql",
      import.meta.url,
    ),
    "utf8",
  );
  for (const protocol of [
    "account-deletion-v2",
    "family-fold-v2",
    "empty-anonymous-purge-v1",
  ]) {
    assert.match(protocolMigration, new RegExp(protocol, "u"));
  }
  assert.match(
    protocolMigration,
    /raise exception[\s\S]*family hard delete requires a recognized transaction protocol/u,
  );
  assert.match(
    protocolMigration,
    /empty-anonymous-purge-v1[\s\S]*anonymous family purge is paused pending durable cleanup/u,
  );
});
