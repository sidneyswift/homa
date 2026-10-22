import { recordCronRun } from "../admin/heartbeat";
import { sendSkillsOutageEmail } from "../map/email";
import { mapDb } from "../map/db";

/**
 * Skills health (gh#1237): notice within the hour when Homa's fleet skills
 * stop loading, tell the founder, and redeploy when a hook is configured.
 *
 * Every fleet skill lives in eve's sandbox template. When a session fails
 * to start from that template with any 404 or 410, eve deletes it, and
 * every load_skill and read_file then fails with "Sandbox template ... is
 * not provisioned for backend" until a production build recreates it.
 * From 2026-10-13 to 2026-10-22 that took every skill down for every
 * family for nine days, and the first anyone heard was a parent's
 * WhatsApp. The failures were in agent_tool_calls the whole time; nothing
 * read them.
 *
 * The signal is that exact error from eve's own code, not interpreted
 * text. "Down" means the most recent skill call in the window failed that
 * way; a success after the last failure means it already recovered and
 * nobody needs waking.
 *
 * Never throws: the hourly cron runs this first so a failing job after it
 * cannot hide it, and a broken health check must not break the cron.
 */

/** eve's SandboxTemplateNotProvisionedError message, as agent_tool_calls
 * stores it. */
const NOT_PROVISIONED_PATTERN = "%is not provisioned for backend%";
const WINDOW_MS = 2 * 60 * 60 * 1000;
/** One email per outage stretch, not one per hourly tick. */
const ALERT_EVERY_MS = 6 * 60 * 60 * 1000;
/** A build takes about 4 minutes; a redeploy that did not fix it should
 * not loop every hour. */
const REDEPLOY_EVERY_MS = 3 * 60 * 60 * 1000;
const REDEPLOY_TIMEOUT_MS = 10_000;

export interface SkillLoadWindow {
  failures: number;
  families: number;
  firstFailureAt: Date | null;
  lastFailureAt: Date | null;
  lastSuccessAt: Date | null;
}

export type SkillsVerdict = "healthy" | "down" | "recovered";

export function skillsVerdict(window: SkillLoadWindow): SkillsVerdict {
  if (window.failures === 0 || window.lastFailureAt === null) return "healthy";
  if (window.lastSuccessAt !== null && window.lastSuccessAt > window.lastFailureAt) {
    return "recovered";
  }
  return "down";
}

/** Whether an action last taken at `last` may run again at `now`. */
export function isDue(last: Date | null, now: Date, everyMs: number): boolean {
  return last === null || now.getTime() - last.getTime() >= everyMs;
}

export type RedeployOutcome =
  | "triggered"
  | "failed"
  | "not_configured"
  | "recently_triggered"
  | "not_needed";

export interface SkillsHealthResult {
  verdict: SkillsVerdict | "unknown";
  failures: number;
  families: number;
  alerted: boolean;
  redeploy: RedeployOutcome;
}

/** The founder email, in plain words. Exported for the test. */
export function skillsOutageEmailLines(input: {
  window: SkillLoadWindow;
  redeploy: RedeployOutcome;
  lastRedeployAt: Date | null;
}): string[] {
  const since = input.window.firstFailureAt?.toISOString().slice(0, 16).replace("T", " ");
  const families = `${input.window.families} ${input.window.families === 1 ? "family" : "families"}`;
  const redeployLine: Record<RedeployOutcome, string> = {
    triggered:
      "A production redeploy started automatically. Skills come back when it finishes, in about 4 minutes. If this email comes again, the redeploy did not fix it.",
    failed:
      "The automatic redeploy did not start. Redeploy production from the Vercel dashboard.",
    not_configured:
      "No redeploy hook is set (HOMA_SKILLS_REDEPLOY_HOOK_URL), so nothing restarts this on its own. Redeploy production from the Vercel dashboard.",
    recently_triggered: `A redeploy already started at ${input.lastRedeployAt?.toISOString().slice(0, 16).replace("T", " ")} UTC and skills still fail. Check that build's log.`,
    not_needed: "",
  };
  return [
    `Since ${since} UTC, ${input.window.failures} skill loads failed for ${families}. Homa still replies, but anything that needs a skill (materials, Planner, research briefs) runs without its instructions.`,
    "The skills live in eve's sandbox, which was removed after a session failed to start from it. Only a production build puts it back.",
    redeployLine[input.redeploy],
    "The runtime log line starting with \"eve: dropping sandbox template\" holds the error that removed it.",
  ].filter((line) => line.length > 0);
}

export interface SkillsHealthDeps {
  readWindow(since: Date, now: Date): Promise<SkillLoadWindow>;
  lastAlertAt(): Promise<Date | null>;
  lastRedeployAt(): Promise<Date | null>;
  sendAlert(to: string, subject: string, lines: string[]): Promise<boolean>;
  triggerRedeploy(hookUrl: string): Promise<boolean>;
  recordRedeploy(outcome: "triggered" | "failed", window: SkillLoadWindow): Promise<void>;
  log(line: string): void;
}

function toDate(value: string | Date | null): Date | null {
  if (value === null) return null;
  return value instanceof Date ? value : new Date(value);
}

const defaultDeps: SkillsHealthDeps = {
  async readWindow(since, now) {
    const sql = mapDb();
    const [row] = await sql<{
      failures: number;
      families: number;
      first_failure_at: string | null;
      last_failure_at: string | null;
      last_success_at: string | null;
    }[]>`
      select
        count(*) filter (where is_error and result::text ilike ${NOT_PROVISIONED_PATTERN})::int as failures,
        count(distinct family_id) filter (where is_error and result::text ilike ${NOT_PROVISIONED_PATTERN})::int as families,
        min(created_at) filter (where is_error and result::text ilike ${NOT_PROVISIONED_PATTERN}) as first_failure_at,
        max(created_at) filter (where is_error and result::text ilike ${NOT_PROVISIONED_PATTERN}) as last_failure_at,
        max(created_at) filter (where is_error is not true) as last_success_at
      from public.agent_tool_calls
      where tool in ('load_skill', 'read_file')
        and created_at >= ${since}
        and created_at <= ${now}
    `;
    return {
      failures: row?.failures ?? 0,
      families: row?.families ?? 0,
      firstFailureAt: toDate(row?.first_failure_at ?? null),
      lastFailureAt: toDate(row?.last_failure_at ?? null),
      lastSuccessAt: toDate(row?.last_success_at ?? null),
    };
  },
  async lastAlertAt() {
    const sql = mapDb();
    const [row] = await sql<{ at: string | null }[]>`
      select max(created_at) as at from public.email_sends
      where kind = 'skills_outage_alert' and status = 'submitted'
    `;
    return toDate(row?.at ?? null);
  },
  async lastRedeployAt() {
    const sql = mapDb();
    const [row] = await sql<{ at: string | null }[]>`
      select max(created_at) as at from public.cron_runs
      where job = 'skills_self_heal' and counts->>'redeploy' = 'triggered'
    `;
    return toDate(row?.at ?? null);
  },
  sendAlert: sendSkillsOutageEmail,
  async triggerRedeploy(hookUrl) {
    try {
      const response = await fetch(hookUrl, {
        method: "POST",
        signal: AbortSignal.timeout(REDEPLOY_TIMEOUT_MS),
      });
      return response.ok;
    } catch {
      return false;
    }
  },
  async recordRedeploy(outcome, window) {
    await recordCronRun("skills_self_heal", outcome === "triggered", {
      redeploy: outcome,
      failures: window.failures,
      families: window.families,
    });
  },
  log: (line) => console.error(line),
};

export async function checkSkillsHealth(input: {
  now?: Date;
  env?: Partial<Record<"HOMA_ADMIN_DIGEST_EMAIL" | "HOMA_SKILLS_REDEPLOY_HOOK_URL", string>>;
  deps?: Partial<SkillsHealthDeps>;
} = {}): Promise<SkillsHealthResult> {
  const now = input.now ?? new Date();
  const env = input.env ?? process.env;
  const deps = { ...defaultDeps, ...input.deps };
  try {
    const window = await deps.readWindow(new Date(now.getTime() - WINDOW_MS), now);
    const verdict = skillsVerdict(window);
    const base = { verdict, failures: window.failures, families: window.families };
    if (verdict !== "down") return { ...base, alerted: false, redeploy: "not_needed" };

    deps.log(
      `skills-health: DOWN, ${window.failures} load_skill/read_file failures for ${window.families} families since ${window.firstFailureAt?.toISOString()}`,
    );

    const hookUrl = env.HOMA_SKILLS_REDEPLOY_HOOK_URL?.trim();
    const lastRedeployAt = await deps.lastRedeployAt();
    let redeploy: RedeployOutcome;
    if (!hookUrl) {
      redeploy = "not_configured";
    } else if (!isDue(lastRedeployAt, now, REDEPLOY_EVERY_MS)) {
      redeploy = "recently_triggered";
    } else {
      redeploy = (await deps.triggerRedeploy(hookUrl)) ? "triggered" : "failed";
      await deps.recordRedeploy(redeploy, window);
    }

    let alerted = false;
    const to = env.HOMA_ADMIN_DIGEST_EMAIL?.trim();
    if (to && isDue(await deps.lastAlertAt(), now, ALERT_EVERY_MS)) {
      alerted = await deps.sendAlert(
        to,
        "Homa skills are failing to load",
        skillsOutageEmailLines({ window, redeploy, lastRedeployAt }),
      );
    }
    return { ...base, alerted, redeploy };
  } catch (error) {
    deps.log(
      `skills-health: check failed: ${error instanceof Error ? error.message : "unknown"}`,
    );
    return { verdict: "unknown", failures: 0, families: 0, alerted: false, redeploy: "not_needed" };
  }
}
