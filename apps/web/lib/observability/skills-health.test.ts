import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  checkSkillsHealth,
  isDue,
  skillsOutageEmailLines,
  skillsVerdict,
  type SkillLoadWindow,
  type SkillsHealthDeps,
} from "./skills-health";

/**
 * Skills health (gh#1237). From 2026-10-13 to 2026-10-22 every fleet skill
 * failed to load for every family, the failures sat in agent_tool_calls
 * the whole time, and the first alert was a parent's WhatsApp. These pin
 * when the hourly check wakes the founder, when it redeploys, and that it
 * never repeats either every hour.
 */

const NOW = new Date("2026-10-14T12:00:00.000Z");
const hoursAgo = (hours: number) => new Date(NOW.getTime() - hours * 60 * 60 * 1000);

const DOWN: SkillLoadWindow = {
  failures: 14,
  families: 3,
  firstFailureAt: hoursAgo(1.5),
  lastFailureAt: hoursAgo(0.2),
  lastSuccessAt: null,
};

function harness(overrides: Partial<SkillsHealthDeps> & { window?: SkillLoadWindow } = {}) {
  const calls = {
    redeploys: [] as string[],
    recorded: [] as string[],
    emails: [] as { to: string; subject: string; lines: string[] }[],
    logs: [] as string[],
  };
  const deps: SkillsHealthDeps = {
    readWindow: async () => overrides.window ?? DOWN,
    lastAlertAt: async () => null,
    lastRedeployAt: async () => null,
    sendAlert: async (to, subject, lines) => {
      calls.emails.push({ to, subject, lines });
      return true;
    },
    triggerRedeploy: async (hookUrl) => {
      calls.redeploys.push(hookUrl);
      return true;
    },
    recordRedeploy: async (outcome) => {
      calls.recorded.push(outcome);
    },
    log: (line) => {
      calls.logs.push(line);
    },
    ...overrides,
  };
  return { deps, calls };
}

const ENV = {
  HOMA_ADMIN_DIGEST_EMAIL: "founder@example.test",
  HOMA_SKILLS_REDEPLOY_HOOK_URL: "https://api.vercel.com/v1/integrations/deploy/hook",
};

describe("skillsVerdict", () => {
  it("is healthy with no not-provisioned failures", () => {
    assert.equal(skillsVerdict({ ...DOWN, failures: 0, lastFailureAt: null }), "healthy");
  });

  it("is down when the last skill call failed", () => {
    assert.equal(skillsVerdict(DOWN), "down");
    assert.equal(skillsVerdict({ ...DOWN, lastSuccessAt: hoursAgo(1) }), "down");
  });

  it("is recovered when a skill loaded after the last failure", () => {
    assert.equal(skillsVerdict({ ...DOWN, lastSuccessAt: hoursAgo(0.1) }), "recovered");
  });
});

describe("isDue", () => {
  it("runs the first time and again only after the interval", () => {
    const threeHours = 3 * 60 * 60 * 1000;
    assert.equal(isDue(null, NOW, threeHours), true);
    assert.equal(isDue(hoursAgo(1), NOW, threeHours), false);
    assert.equal(isDue(hoursAgo(3), NOW, threeHours), true);
  });
});

describe("checkSkillsHealth", () => {
  it("redeploys once and emails the founder when skills are down", async () => {
    const { deps, calls } = harness();
    const result = await checkSkillsHealth({ now: NOW, env: ENV, deps });
    assert.deepEqual(result, {
      verdict: "down",
      failures: 14,
      families: 3,
      alerted: true,
      redeploy: "triggered",
    });
    assert.deepEqual(calls.redeploys, [ENV.HOMA_SKILLS_REDEPLOY_HOOK_URL]);
    assert.deepEqual(calls.recorded, ["triggered"]);
    assert.equal(calls.emails.length, 1);
    assert.equal(calls.emails[0].to, ENV.HOMA_ADMIN_DIGEST_EMAIL);
    assert.match(calls.emails[0].lines.join("\n"), /redeploy started automatically/u);
    assert.equal(calls.logs.length, 1);
  });

  it("does not redeploy again within three hours of the last redeploy", async () => {
    const { deps, calls } = harness({ lastRedeployAt: async () => hoursAgo(1) });
    const result = await checkSkillsHealth({ now: NOW, env: ENV, deps });
    assert.equal(result.redeploy, "recently_triggered");
    assert.deepEqual(calls.redeploys, []);
    assert.deepEqual(calls.recorded, []);
    assert.match(calls.emails[0].lines.join("\n"), /already started at 2026-10-14 11:00 UTC/u);
  });

  it("emails without redeploying when no hook is configured", async () => {
    const { deps, calls } = harness();
    const result = await checkSkillsHealth({
      now: NOW,
      env: { HOMA_ADMIN_DIGEST_EMAIL: ENV.HOMA_ADMIN_DIGEST_EMAIL },
      deps,
    });
    assert.equal(result.redeploy, "not_configured");
    assert.deepEqual(calls.redeploys, []);
    assert.match(calls.emails[0].lines.join("\n"), /Redeploy production from the Vercel dashboard/u);
  });

  it("records and reports a redeploy hook that did not start", async () => {
    const { deps, calls } = harness({ triggerRedeploy: async () => false });
    const result = await checkSkillsHealth({ now: NOW, env: ENV, deps });
    assert.equal(result.redeploy, "failed");
    assert.deepEqual(calls.recorded, ["failed"]);
    assert.match(calls.emails[0].lines.join("\n"), /did not start/u);
  });

  it("emails at most once per six hours", async () => {
    const { deps, calls } = harness({ lastAlertAt: async () => hoursAgo(2) });
    const result = await checkSkillsHealth({ now: NOW, env: ENV, deps });
    assert.equal(result.alerted, false);
    assert.equal(calls.emails.length, 0);
    assert.equal(result.redeploy, "triggered");
  });

  it("still redeploys when no founder address is set", async () => {
    const { deps, calls } = harness();
    const result = await checkSkillsHealth({
      now: NOW,
      env: { HOMA_SKILLS_REDEPLOY_HOOK_URL: ENV.HOMA_SKILLS_REDEPLOY_HOOK_URL },
      deps,
    });
    assert.equal(result.redeploy, "triggered");
    assert.equal(calls.emails.length, 0);
  });

  it("does nothing when healthy or already recovered", async () => {
    for (const window of [
      { ...DOWN, failures: 0, families: 0, firstFailureAt: null, lastFailureAt: null },
      { ...DOWN, lastSuccessAt: hoursAgo(0.1) },
    ]) {
      const { deps, calls } = harness({ window });
      const result = await checkSkillsHealth({ now: NOW, env: ENV, deps });
      assert.equal(result.alerted, false);
      assert.equal(result.redeploy, "not_needed");
      assert.deepEqual(calls.redeploys, []);
      assert.deepEqual(calls.emails, []);
    }
  });

  it("never throws, so the hourly cron always finishes", async () => {
    const { deps, calls } = harness({
      readWindow: async () => {
        throw new Error("database unavailable");
      },
    });
    const result = await checkSkillsHealth({ now: NOW, env: ENV, deps });
    assert.equal(result.verdict, "unknown");
    assert.match(calls.logs[0], /database unavailable/u);
  });
});

describe("skillsOutageEmailLines", () => {
  it("says when it started, who it hit, and what happens next, in plain words", () => {
    const lines = skillsOutageEmailLines({
      window: DOWN,
      redeploy: "not_configured",
      lastRedeployAt: null,
    });
    assert.match(lines[0], /Since 2026-10-14 10:30 UTC, 14 skill loads failed for 3 families/u);
    assert.match(lines.join("\n"), /eve: dropping sandbox template/u);
    assert.equal(lines.some((line) => line.length === 0), false);
  });

  it("uses no em dash (house law)", () => {
    for (const redeploy of ["triggered", "failed", "not_configured", "recently_triggered"] as const) {
      const lines = skillsOutageEmailLines({ window: DOWN, redeploy, lastRedeployAt: hoursAgo(1) });
      assert.doesNotMatch(lines.join("\n"), /—/u);
    }
  });
});
