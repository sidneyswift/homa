import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";
import path from "node:path";

/**
 * Founder console smoke check (MJ-14): runs every /admin data module
 * against the configured database and prints counts only, never names,
 * emails, or content. Use it after schema changes or before flipping
 * HOMA_ADMIN_EMAILS on, the same posture as check:isolation.
 *
 * Usage: pnpm admin:smoke
 * Env: reads apps/web/.env.local (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_DB_PASSWORD).
 */

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
try {
  loadEnvFile(path.join(repoRoot, "apps/web/.env.local"));
} catch {
  // Fine in CI, where the vars arrive via the environment.
}

const { getFamilySnapshots } = await import("../apps/web/lib/admin/roster-data");
const { getFleetOverview } = await import("../apps/web/lib/admin/overview-data");
const { getPulseDays } = await import("../apps/web/lib/admin/pulse-data");
const { getFunnelData } = await import("../apps/web/lib/admin/funnel-data");
const { getFamilyDetail } = await import("../apps/web/lib/admin/family-detail-data");
const { listChatFamilies, getFamilyThread } = await import("../apps/web/lib/admin/chats-data");
const { listSessions, getSessionDetail } = await import("../apps/web/lib/admin/sessions-data");
const { getFamilyTasks, getFamilyBrain, getFamilyMaterialsDeep, getFamilyProgressDeep } =
  await import("../apps/web/lib/admin/family-deep-data");
const { getFamilyScreenData } = await import("../apps/web/lib/admin/screen-data");

let failed = false;

function pass(name: string, extra: string) {
  console.log(`PASS  ${name}: ${extra}`);
}

function fail(name: string, error: unknown) {
  failed = true;
  console.error(`FAIL  ${name}:`, error instanceof Error ? error.message : error);
}

try {
  const snapshots = await getFamilySnapshots();
  const stages = new Map<string, number>();
  for (const snapshot of snapshots) {
    stages.set(snapshot.stage, (stages.get(snapshot.stage) ?? 0) + 1);
  }
  pass(
    "roster snapshots",
    `${snapshots.length} families with accounts · stages ${JSON.stringify(Object.fromEntries(stages))}`,
  );

  const overview = await getFleetOverview(7);
  pass(
    "fleet overview (7d)",
    `active ${overview.activeFamilies} · signups ${overview.newSignups.length} · runs ${JSON.stringify(overview.runCounts)} · deliveries ${JSON.stringify(overview.deliveryCounts)} · morningOffers ${JSON.stringify(overview.morningOfferFunnel)} · userMessages ${overview.userMessages} · emailSends ${JSON.stringify(overview.emailCounts)} · handledAlerts ${overview.handledAlerts.length} · cronLastAt ${overview.cronLastAt ?? "none"}`,
  );

  const pulse = await getPulseDays(14);
  pass(
    "pulse (14d)",
    `${pulse.length} days · ${pulse.reduce((sum, day) => sum + day.items.length, 0)} items`,
  );

  const funnel = await getFunnelData(28);
  pass(
    "funnel (28d)",
    `stages ${funnel.stages.map((stage) => `${stage.key}=${stage.count}`).join(" ")} · pipeline ${funnel.pipeline.map((node) => `${node.key}=${node.count}`).join(" ")} · cohorts ${funnel.cohorts.length}`,
  );

  if (snapshots.length > 0) {
    const detail = await getFamilyDetail(snapshots[0].id);
    if (!detail) throw new Error("newest family detail came back null");
    pass(
      "family detail (newest)",
      `stage ${detail.stage} · kids ${detail.kids.length} · members ${detail.members.length} · runs ${detail.runs.length} · deliveries ${detail.deliveries.length} · emailSends ${detail.emailSends.length} · events ${detail.recentEvents.length}`,
    );
  } else {
    pass("family detail", "skipped, no families with accounts yet");
  }

  // Deep view modules (2026-07-13): counts only, same privacy posture.
  const chatFamilies = await listChatFamilies();
  pass("chat families", `${chatFamilies.length} rows`);
  const talker = chatFamilies.find((family) => family.messagesTotal > 0);
  if (talker) {
    const thread = await getFamilyThread(talker.id, { limit: 50 });
    pass("family thread (newest talker)", `${thread.length} messages`);
  } else {
    pass("family thread", "skipped, no messages yet");
  }

  const sessions = await listSessions({ limit: 20 });
  pass("sessions list", `${sessions.length} rows`);
  const firstSession = sessions.find((session) => session.sessionId);
  if (firstSession?.sessionId) {
    const sessionDetail = await getSessionDetail(firstSession.sessionId);
    if (!sessionDetail) throw new Error("newest session detail came back null");
    pass(
      "session detail (newest)",
      `messages ${sessionDetail.messages.length} · toolCalls ${sessionDetail.toolCalls.length} · snapshots ${sessionDetail.snapshots.length} · usage ${sessionDetail.usage.length} · deliveries ${sessionDetail.deliveries.length}`,
    );
  } else {
    pass("session detail", "skipped, no sessions yet");
  }

  if (snapshots.length > 0) {
    const familyId = snapshots[0].id;
    const tasks = await getFamilyTasks(familyId);
    pass("family tasks", `schedules ${tasks.schedules.length} · runs ${tasks.runs.length}`);
    const brain = await getFamilyBrain(familyId);
    pass(
      "family brain",
      `memories ${brain.memories.length} · snapshot ${brain.latestSnapshot ? "yes" : "none"} · reviews ${brain.reviews.length}`,
    );
    const materials = await getFamilyMaterialsDeep(familyId);
    pass("family materials", `${materials.length} rows`);
    const progress = await getFamilyProgressDeep(familyId);
    pass(
      "family progress",
      progress
        .map((kid) => `kid ${kid.childId.slice(0, 6)}: subjects ${kid.view?.subjects.length ?? 0} eras ${kid.eras.length}`)
        .join(" · ") || "no kids",
    );
    const screen = await getFamilyScreenData(familyId);
    if (!screen) throw new Error("screen data came back null");
    pass(
      "her screen",
      `kids ${screen.children.length} · reports ${screen.reports.size} · plans ${screen.plans.length} · binder ${screen.binder.length}`,
    );
  }
} catch (error) {
  fail("admin console smoke", error);
}

process.exit(failed ? 1 : 0);
