import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import postgres from "postgres";

import {
  EVAL_FIXTURE_FAMILY_ID,
  EVAL_FIXTURE_LIBRARY_ASSET_ID,
} from "../apps/web/lib/family-context-eval-fixture";
import {
  approveCurriculumMappingDraft,
  signCurriculumMappingDraft,
  type CurriculumMappingDraftPayload,
  type ProposedCurriculumMapping,
} from "../apps/web/lib/library/family-curriculum-mapping";
import { getPlanBoard } from "../apps/web/lib/map/store";

const databaseUrl = process.env.HOMA_EVAL_DATABASE_URL;
if (!databaseUrl) {
  throw new Error("Run through `pnpm eval:sandbox --exec ...`.");
}

const sql = postgres(databaseUrl, { prepare: false, max: 1 });
const sessionId = "family-curriculum-mapping-e2e";
const secret = "family-curriculum-mapping-e2e-secret";
const scienceSubject = "science";

function planJson() {
  return {
    subjectId: scienceSubject,
    subjectName: "Science",
    childAgeLabel: "6-year-old",
    startingLine: "Enjoys observing plants and animals.",
    targets: ["Notice patterns in living things"],
    weeks: [1, 2, 3, 4].map((week) => ({
      week,
      focus: `Science focus for week ${week}.`,
      activities: [`Existing science activity for week ${week}.`],
    })),
    styleNote: null,
    bankVersion: "curriculum-mapping-e2e",
  };
}

function proposal(sourceAssetId: string): ProposedCurriculumMapping {
  return {
    sourceAssetId,
    decompositionQuality: "full",
    unitKind: "week",
    declaredUnitCount: 2,
    notes: null,
    units: [
      {
        ordinal: 1,
        unitLabel: "Week 1",
        sourceLocator: "Page 8",
        evidenceQuote: "Week 1: Living things",
        confidence: "high",
        subjectIds: [scienceSubject],
        topics: [{ name: "living things", quote: "Living things" }],
        summary: "Observe what living things need.",
      },
      {
        ordinal: 2,
        unitLabel: "Week 2",
        sourceLocator: "Page 12",
        evidenceQuote: "Week 2: Growing plants",
        confidence: "medium",
        subjectIds: [scienceSubject],
        topics: [{ name: "plant growth", quote: "Growing plants" }],
        summary: "Record changes in one growing plant.",
      },
    ],
    placements: [],
  };
}

try {
  const [maya] = await sql<{ id: string; name: string }[]>`
    select id, name
    from public.children
    where family_id = ${EVAL_FIXTURE_FAMILY_ID}
      and name = 'Maya'
    limit 1
  `;
  assert.ok(maya, "the eval fixture includes Maya");

  await sql`
    insert into public.child_plans (
      child_id, subject_id, plan, bank_version, progress, retest_at
    ) values (
      ${maya.id}, ${scienceSubject}, ${sql.json(planJson())},
      'curriculum-mapping-e2e', '{}'::jsonb, now() + interval '28 days'
    )
  `;

  const [source] = await sql<{ id: string; title: string; updated_at: string }[]>`
    select id, title, updated_at::text as updated_at
    from public.family_assets
    where id = ${EVAL_FIXTURE_LIBRARY_ASSET_ID}
      and family_id = ${EVAL_FIXTURE_FAMILY_ID}
  `;
  const [plan] = await sql<{
    id: string;
    updated_at: string;
  }[]>`
    select id, updated_at::text as updated_at
    from public.child_plans
    where child_id = ${maya.id}
      and subject_id = ${scienceSubject}
  `;
  assert.ok(source && plan);

  const firstProposal = proposal(source.id);
  firstProposal.placements = [
    {
      unitOrdinal: 1,
      childId: maya.id,
      subjectId: scienceSubject,
      week: 1,
      activityText: "Read Week 1 and complete the living-things observation.",
    },
    {
      unitOrdinal: 2,
      childId: maya.id,
      subjectId: scienceSubject,
      week: 2,
      activityText: "Read Week 2 and record the plant's changes.",
    },
  ];
  const firstPayload: CurriculumMappingDraftPayload = {
    v: 1,
    draftId: randomUUID(),
    familyId: EVAL_FIXTURE_FAMILY_ID,
    createdAt: new Date().toISOString(),
    source: {
      assetId: source.id,
      title: source.title,
      updatedAt: source.updated_at,
    },
    eligibleChildIds: [maya.id],
    childNames: { [maya.id]: maya.name },
    planBaseVersions: [
      {
        childId: maya.id,
        subjectId: scienceSubject,
        updatedAt: plan.updated_at,
      },
    ],
    history: [
      {
        revision: 1,
        proposal: firstProposal,
        action: "created",
        restoredFrom: null,
      },
    ],
  };
  const firstToken = signCurriculumMappingDraft(firstPayload, sessionId, secret);
  const approved = await approveCurriculumMappingDraft({
    familyId: EVAL_FIXTURE_FAMILY_ID,
    sessionId,
    secret,
    draftToken: firstToken,
  });
  assert.equal(approved.status, "approved");
  assert.ok(approved.status === "approved");
  assert.equal(approved.unitAssets.length, 2);
  assert.equal(approved.plannerTargets.length, 2);

  const units = await sql<
    Array<{
      id: string;
      parent_asset_id: string;
      ordinal: number;
      unit_source_locator: string;
      is_current_decomposition: boolean;
    }>
  >`
    select id, parent_asset_id, ordinal, unit_source_locator,
           is_current_decomposition
    from public.family_assets
    where family_id = ${EVAL_FIXTURE_FAMILY_ID}
      and decomposition_draft_id = ${firstPayload.draftId}
    order by ordinal
  `;
  assert.deepEqual(units.map((unit) => unit.ordinal), [1, 2]);
  assert.ok(units.every((unit) => unit.parent_asset_id === source.id));
  assert.ok(units.every((unit) => unit.is_current_decomposition));

  const childLinks = await sql<{ asset_id: string; child_id: string }[]>`
    select asset_id, child_id
    from public.family_asset_children
    where family_id = ${EVAL_FIXTURE_FAMILY_ID}
      and asset_id in ${sql(units.map((unit) => unit.id))}
    order by asset_id
  `;
  assert.equal(childLinks.length, 2);
  assert.ok(childLinks.every((link) => link.child_id === maya.id));

  const unitTags = await sql<
    Array<{ asset_id: string; kind: string; quote: string; source_locator: string }>
  >`
    select asset_id, kind, quote, source_locator
    from public.family_asset_tags
    where family_id = ${EVAL_FIXTURE_FAMILY_ID}
      and asset_id in ${sql(units.map((unit) => unit.id))}
    order by asset_id, kind
  `;
  assert.equal(unitTags.length, 4);
  assert.ok(unitTags.every((tag) => tag.quote.length > 0));
  assert.ok(unitTags.every((tag) => tag.source_locator.startsWith("Page ")));

  const planLinks = await sql<
    Array<{
      asset_id: string;
      week: number;
      activity_index: number;
      source_title: string;
      source_locator: string;
    }>
  >`
    select asset_id, week, activity_index, source_title, source_locator
    from public.family_asset_plan_links
    where family_id = ${EVAL_FIXTURE_FAMILY_ID}
      and child_id = ${maya.id}
      and subject_id = ${scienceSubject}
    order by week, activity_index
  `;
  assert.equal(planLinks.length, 2);
  assert.deepEqual(planLinks.map((link) => link.week), [1, 2]);
  assert.deepEqual(planLinks.map((link) => link.source_title), [
    `${source.title} · Week 1`,
    `${source.title} · Week 2`,
  ]);
  assert.deepEqual(planLinks.map((link) => link.source_locator), ["Page 8", "Page 12"]);

  const schedules = await sql<{ count: number }[]>`
    select count(*)::int as count
    from public.plan_activity_schedule
    where family_id = ${EVAL_FIXTURE_FAMILY_ID}
      and child_id = ${maya.id}
      and subject_id = ${scienceSubject}
  `;
  assert.equal(schedules[0]?.count, 0);

  const board = await getPlanBoard(EVAL_FIXTURE_FAMILY_ID, maya.id);
  const science = board?.plans.find((candidate) => candidate.subjectId === scienceSubject);
  assert.equal(
    science?.activitySources["1.1"]?.[0]?.title,
    `${source.title} · Week 1`,
  );
  assert.equal(science?.activitySources["1.1"]?.[0]?.sourceLocator, "Page 8");
  assert.equal(science?.activitySources["2.1"]?.[0]?.sourceLocator, "Page 12");

  const repeated = await approveCurriculumMappingDraft({
    familyId: EVAL_FIXTURE_FAMILY_ID,
    sessionId,
    secret,
    draftToken: firstToken,
  });
  assert.equal(repeated.status, "already_approved");
  const [afterRepeat] = await sql<{ count: number }[]>`
    select count(*)::int as count
    from public.family_assets
    where family_id = ${EVAL_FIXTURE_FAMILY_ID}
      and decomposition_draft_id = ${firstPayload.draftId}
  `;
  assert.equal(afterRepeat?.count, 2);

  const stalePayload: CurriculumMappingDraftPayload = {
    ...firstPayload,
    draftId: randomUUID(),
  };
  const stale = await approveCurriculumMappingDraft({
    familyId: EVAL_FIXTURE_FAMILY_ID,
    sessionId,
    secret,
    draftToken: signCurriculumMappingDraft(stalePayload, sessionId, secret),
  });
  assert.equal(stale.status, "stale");
  const [afterStale] = await sql<{ count: number }[]>`
    select count(*)::int as count
    from public.family_assets
    where family_id = ${EVAL_FIXTURE_FAMILY_ID}
      and decomposition_draft_id = ${stalePayload.draftId}
  `;
  assert.equal(afterStale?.count, 0);

  const secondProposal = proposal(source.id);
  secondProposal.units = [
    {
      ...secondProposal.units[0],
      unitLabel: "Opening week",
      summary: "Begin with the curriculum's opening observation.",
    },
  ];
  secondProposal.declaredUnitCount = 1;
  const secondPayload: CurriculumMappingDraftPayload = {
    v: 1,
    draftId: randomUUID(),
    familyId: EVAL_FIXTURE_FAMILY_ID,
    createdAt: new Date().toISOString(),
    source: firstPayload.source,
    eligibleChildIds: [maya.id],
    childNames: { [maya.id]: maya.name },
    planBaseVersions: [],
    history: [
      {
        revision: 1,
        proposal: secondProposal,
        action: "created",
        restoredFrom: null,
      },
    ],
  };
  const replacement = await approveCurriculumMappingDraft({
    familyId: EVAL_FIXTURE_FAMILY_ID,
    sessionId,
    secret,
    draftToken: signCurriculumMappingDraft(secondPayload, sessionId, secret),
  });
  assert.equal(replacement.status, "approved");
  const allUnits = await sql<
    Array<{ decomposition_draft_id: string; is_current_decomposition: boolean }>
  >`
    select decomposition_draft_id, is_current_decomposition
    from public.family_assets
    where family_id = ${EVAL_FIXTURE_FAMILY_ID}
      and parent_asset_id = ${source.id}
      and deleted_at is null
  `;
  assert.equal(
    allUnits.filter((unit) => unit.decomposition_draft_id === firstPayload.draftId).length,
    2,
  );
  assert.ok(
    allUnits
      .filter((unit) => unit.decomposition_draft_id === firstPayload.draftId)
      .every((unit) => !unit.is_current_decomposition),
  );
  assert.equal(
    allUnits.filter(
      (unit) =>
        unit.decomposition_draft_id === secondPayload.draftId &&
        unit.is_current_decomposition,
    ).length,
    1,
  );
  const [preservedPlanLinks] = await sql<{ count: number }[]>`
    select count(*)::int as count
    from public.family_asset_plan_links
    where family_id = ${EVAL_FIXTURE_FAMILY_ID}
      and asset_id in ${sql(units.map((unit) => unit.id))}
  `;
  assert.equal(preservedPlanLinks?.count, 2);

  console.log("PASS  family-curriculum-mapping atomic-unit-and-planner-write");
  console.log("PASS  family-curriculum-mapping exact-source-provenance-and-no-dates");
  console.log("PASS  family-curriculum-mapping idempotent-and-stale-safe");
  console.log("PASS  family-curriculum-mapping replacement-preserves-history");
} finally {
  await sql.end({ timeout: 5 });
}
