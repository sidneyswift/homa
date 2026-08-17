import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  approveMonthPlanDraft,
  proposedMonthPlanSchema,
  resumeMonthPlanDraft,
  restoreMonthPlanDraft,
  signMonthPlanDraft,
  type ProposedMonthPlan,
  verifyMonthPlanDraft,
} from "./month-plan-draft";

const FAMILY_ID = "00000000-0000-4000-8000-000000000001";
const CHILD_ID = "00000000-0000-4000-8000-000000000002";
const DRAFT_ID = "00000000-0000-4000-8000-000000000003";
const SESSION_ID = "session-private-to-the-runtime";
const SECRET = "server-only-month-plan-secret";
const NOW = new Date("2026-08-01T21:00:00.000Z");

const plan: ProposedMonthPlan = {
  monthStart: "2026-09-01",
  title: "September",
  children: [
    {
      childId: CHILD_ID,
      childName: "Maya",
      targets: ["Read with growing confidence"],
      weeks: [1, 2, 3, 4].map((week) => ({
        week,
        focus: "reading",
        activities: [
          {
            text: "Read together for fifteen minutes.",
            scheduledDate: week === 1 ? "2026-09-01" : null,
            reusedMaterialId: null,
          },
        ],
      })),
      unresolvedChoices: [],
    },
  ],
  unscheduledItems: [],
};

const payload = {
  v: 1 as const,
  draftId: DRAFT_ID,
  familyId: FAMILY_ID,
  createdAt: "2026-08-01T20:00:00.000Z",
  baseVersions: [{ childId: CHILD_ID, updatedAt: null }],
  history: [
    {
      revision: 1,
      plan,
      conflicts: [],
      action: "created" as const,
      restoredFrom: null,
    },
  ],
};

function concurrentApprovalDb() {
  let held = false;
  const waiters: Array<() => void> = [];
  let currentVersion: string | null = null;
  let planWrites = 0;

  async function acquire() {
    if (!held) {
      held = true;
      return;
    }
    await new Promise<void>((resolve) => waiters.push(resolve));
  }

  function release() {
    const next = waiters.shift();
    if (next) next();
    else held = false;
  }

  const db = Object.assign(
    async () => [] as unknown[],
    {
      async begin<T>(run: (tx: unknown) => Promise<T>): Promise<T> {
        let ownsLock = false;
        const tx = Object.assign(
          async (strings: TemplateStringsArray) => {
            const query = strings.join("?");
            if (query.includes("pg_advisory_xact_lock")) {
              await acquire();
              ownsLock = true;
              return [];
            }
            if (query.includes("insert into public.child_plans")) {
              planWrites += 1;
              currentVersion = `written-${planWrites}`;
              return [];
            }
            if (query.includes("from public.child_plans")) {
              return currentVersion
                ? [{ child_id: CHILD_ID, updated_at: currentVersion }]
                : [];
            }
            if (query.includes("from public.children")) {
              return [{ id: CHILD_ID, birth_month: "2020-01-01" }];
            }
            return [];
          },
          { json: (value: unknown) => value },
        );
        try {
          return await run(tx);
        } finally {
          if (ownsLock) release();
        }
      },
    },
  );
  return { db, planWrites: () => planWrites };
}

describe("month plan draft tokens", () => {
  it("round-trips only in the same family and session", () => {
    const token = signMonthPlanDraft(payload, SESSION_ID, SECRET);
    const verify = (sessionId: string, familyId: string, secret = SECRET) =>
      verifyMonthPlanDraft(token, sessionId, familyId, { secret, now: NOW });
    assert.deepEqual(verify(SESSION_ID, FAMILY_ID), payload);
    assert.equal(verify("another-session", FAMILY_ID), null);
    assert.equal(verify(SESSION_ID, FAMILY_ID, "wrong-server-secret"), null);
    assert.equal(
      verify(SESSION_ID, "00000000-0000-4000-8000-000000000099"),
      null,
    );
  });

  it("rejects a token whose plan bytes were changed", () => {
    const token = signMonthPlanDraft(payload, SESSION_ID, SECRET);
    const [body, signature] = token.split(".");
    const changed = `${body.slice(0, -1)}A.${signature}`;
    assert.equal(
      verifyMonthPlanDraft(changed, SESSION_ID, FAMILY_ID, { secret: SECRET, now: NOW }),
      null,
    );
  });

  it("rejects expired previews and previews minted too far in the future", () => {
    const token = signMonthPlanDraft(payload, SESSION_ID, SECRET);
    assert.equal(
      verifyMonthPlanDraft(token, SESSION_ID, FAMILY_ID, {
        secret: SECRET,
        now: new Date("2026-08-03T20:00:00.000Z"),
      }),
      null,
    );
    const future = signMonthPlanDraft(
      { ...payload, createdAt: "2026-08-02T00:00:00.000Z" },
      SESSION_ID,
      SECRET,
    );
    assert.equal(
      verifyMonthPlanDraft(future, SESSION_ID, FAMILY_ID, { secret: SECRET, now: NOW }),
      null,
    );
  });

  it("fails closed when the server secret is unavailable", () => {
    assert.throws(
      () => signMonthPlanDraft(payload, SESSION_ID, ""),
      /CRON_SECRET is required/u,
    );
    const token = signMonthPlanDraft(payload, SESSION_ID, SECRET);
    assert.equal(
      verifyMonthPlanDraft(token, SESSION_ID, FAMILY_ID, {
        secret: "",
        now: NOW,
      }),
      null,
    );
  });

  it("blocks approval before database access while a choice remains", async () => {
    const unresolved = {
      ...structuredClone(payload),
      createdAt: new Date().toISOString(),
    };
    unresolved.history[0].plan.children[0].unresolvedChoices = [
      "Choose whether art belongs on Tuesday or Wednesday.",
    ];
    const token = signMonthPlanDraft(unresolved, SESSION_ID, SECRET);
    assert.deepEqual(
      await approveMonthPlanDraft({
        familyId: FAMILY_ID,
        sessionId: SESSION_ID,
        secret: SECRET,
        draftToken: token,
      }),
      { status: "unresolved" },
    );
  });

  it("lets only one of two concurrent first-month drafts write", async () => {
    const createdAt = new Date().toISOString();
    const draftA = signMonthPlanDraft(
      { ...payload, createdAt, draftId: "00000000-0000-4000-8000-00000000000a" },
      SESSION_ID,
      SECRET,
    );
    const draftB = signMonthPlanDraft(
      { ...payload, createdAt, draftId: "00000000-0000-4000-8000-00000000000b" },
      SESSION_ID,
      SECRET,
    );
    const fixture = concurrentApprovalDb();
    const outcomes = await Promise.all(
      [draftA, draftB].map(async (draftToken) =>
        await approveMonthPlanDraft({
          familyId: FAMILY_ID,
          sessionId: SESSION_ID,
          secret: SECRET,
          draftToken,
          db: fixture.db as never,
        }),
      ),
    );
    assert.deepEqual(
      outcomes.map((outcome) => outcome.status).sort(),
      ["approved", "stale"],
    );
    assert.equal(fixture.planWrites(), 1);
  });

  it("restores an earlier revision by appending to one history", () => {
    const token = signMonthPlanDraft(
      {
        ...payload,
        createdAt: new Date().toISOString(),
        history: [
          payload.history[0],
          {
            ...payload.history[0],
            revision: 2,
            action: "revised",
            plan: { ...plan, title: "September, lighter Fridays" },
          },
        ],
      },
      SESSION_ID,
      SECRET,
    );
    const restored = restoreMonthPlanDraft({
      familyId: FAMILY_ID,
      sessionId: SESSION_ID,
      draftToken: token,
      restoreRevision: 1,
      secret: SECRET,
    });
    assert.ok(restored);
    assert.equal(restored.preview.revision, 3);
    assert.equal(restored.preview.title, "September");
    assert.equal(restored.preview.restoredFrom, 1);
    const verified = verifyMonthPlanDraft(restored.draftToken, SESSION_ID, FAMILY_ID, {
      secret: SECRET,
    });
    assert.equal(verified?.history.length, 3);
  });

  it("rebinds one stored draft to a fresh session without changing its lineage", () => {
    const reopenedAt = new Date("2026-08-04T14:00:00.000Z");
    const resumed = resumeMonthPlanDraft({
      familyId: FAMILY_ID,
      sessionId: "fresh-eve-session",
      secret: SECRET,
      payload,
      now: reopenedAt,
    });
    assert.ok(resumed);
    assert.equal(resumed.preview.draftId, DRAFT_ID);
    assert.equal(resumed.preview.revision, 1);
    const verified = verifyMonthPlanDraft(
      resumed.draftToken,
      "fresh-eve-session",
      FAMILY_ID,
      { secret: SECRET, now: reopenedAt },
    );
    assert.equal(verified?.createdAt, reopenedAt.toISOString());
    assert.deepEqual(verified?.history, payload.history);
    assert.equal(
      verifyMonthPlanDraft(resumed.draftToken, SESSION_ID, FAMILY_ID, {
        secret: SECRET,
        now: reopenedAt,
      }),
      null,
    );
  });

  it("refuses to rebind a stored draft for another family", () => {
    assert.equal(
      resumeMonthPlanDraft({
        familyId: "00000000-0000-4000-8000-000000000099",
        sessionId: "fresh-eve-session",
        secret: SECRET,
        payload,
      }),
      null,
    );
  });
});

describe("month plan proposal schema", () => {
  it("requires all four numbered weeks exactly once", () => {
    assert.equal(proposedMonthPlanSchema.safeParse(plan).success, true);
    const duplicate = structuredClone(plan);
    duplicate.children[0].weeks[3].week = 3;
    assert.equal(proposedMonthPlanSchema.safeParse(duplicate).success, false);
  });

  it("rejects unbounded activity copy and non-month starts", () => {
    const long = structuredClone(plan);
    long.children[0].weeks[0].activities[0].text = "x".repeat(501);
    assert.equal(proposedMonthPlanSchema.safeParse(long).success, false);
    assert.equal(
      proposedMonthPlanSchema.safeParse({ ...plan, monthStart: "2026-09-02" }).success,
      false,
    );
  });
});
