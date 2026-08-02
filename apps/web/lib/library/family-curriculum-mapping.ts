import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

import { MAP_SUBJECTS, type FourWeekPlan } from "@homa/core";
import { z } from "zod";

import { siteUrl } from "../map/email";
import { mapDb, type DbJson } from "../map/db";
import {
  applyPlanEdits,
  MAX_ACTIVITY_TEXT,
  type PlanEdit,
} from "../map/plan-edits";
import { familyAssetLibraryHref } from "./family-asset-reference";
import {
  getReadyFamilyCurriculum,
  type ReadyFamilyCurriculum,
} from "./family-curriculum-source";
import {
  extractFamilyAssetSourceDocument,
  type FamilyAssetSourceDocument,
} from "./family-asset-processing";

const MAX_DRAFT_AGE_MS = 24 * 60 * 60 * 1_000;
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1_000;
const SUBJECT_IDS = MAP_SUBJECTS.map((subject) => subject.id) as [
  string,
  ...string[],
];
const SUBJECT_NAMES = new Map(
  MAP_SUBJECTS.map((subject) => [subject.id, subject.displayName]),
);
const MAX_PLAN_SOURCE_TITLE = 180;
const MAX_CURRICULUM_MAPPING_REVISIONS = 100;

export const CURRICULUM_UNIT_KINDS = [
  "week",
  "lesson",
  "day",
  "chapter",
  "unit",
] as const;

export const CURRICULUM_UNIT_CONFIDENCES = ["high", "medium", "low"] as const;

export const curriculumUnitTopicSchema = z
  .object({
    name: z.string().trim().min(1).max(160),
    quote: z.string().min(1).max(500),
  })
  .strict();

export const proposedCurriculumUnitSchema = z
  .object({
    ordinal: z.number().int().min(1).max(5_000),
    unitLabel: z.string().trim().min(1).max(120),
    sourceLocator: z.string().trim().min(1).max(160),
    evidenceQuote: z.string().min(1).max(500),
    confidence: z.enum(CURRICULUM_UNIT_CONFIDENCES),
    subjectIds: z.array(z.enum(SUBJECT_IDS)).min(1).max(5),
    topics: z.array(curriculumUnitTopicSchema).min(1).max(8),
    summary: z.string().trim().min(1).max(500),
  })
  .strict();

export const proposedCurriculumPlacementSchema = z
  .object({
    unitOrdinal: z.number().int().min(1).max(5_000),
    childId: z.string().uuid(),
    subjectId: z.enum(SUBJECT_IDS),
    week: z.number().int().min(1).max(4),
    activityText: z.string().trim().min(1).max(MAX_ACTIVITY_TEXT),
  })
  .strict();

export const proposedCurriculumMappingSchema = z
  .object({
    sourceAssetId: z.string().uuid(),
    decompositionQuality: z.enum(["full", "partial"]),
    unitKind: z.enum(CURRICULUM_UNIT_KINDS),
    declaredUnitCount: z.number().int().min(1).max(5_000),
    notes: z.string().trim().min(1).max(500).nullable(),
    units: z.array(proposedCurriculumUnitSchema).min(1).max(120),
    placements: z.array(proposedCurriculumPlacementSchema).max(40),
  })
  .strict()
  .superRefine((proposal, context) => {
    const ordinals = proposal.units.map((unit) => unit.ordinal);
    if (new Set(ordinals).size !== ordinals.length) {
      context.addIssue({
        code: "custom",
        path: ["units"],
        message: "unit ordinals must be unique",
      });
    }
    if (ordinals.some((ordinal, index) => index > 0 && ordinal <= ordinals[index - 1])) {
      context.addIssue({
        code: "custom",
        path: ["units"],
        message: "units must be ordered by ordinal",
      });
    }
    if (
      proposal.decompositionQuality === "full" &&
      proposal.declaredUnitCount !== proposal.units.length
    ) {
      context.addIssue({
        code: "custom",
        path: ["declaredUnitCount"],
        message: "a full decomposition must include every declared unit",
      });
    }
    if (proposal.decompositionQuality === "partial" && !proposal.notes) {
      context.addIssue({
        code: "custom",
        path: ["notes"],
        message: "a partial decomposition must say what remains unread",
      });
    }
    const placementKeys = proposal.placements.map((placement) =>
      [
        placement.unitOrdinal,
        placement.childId,
        placement.subjectId,
        placement.week,
      ].join(":"),
    );
    if (new Set(placementKeys).size !== placementKeys.length) {
      context.addIssue({
        code: "custom",
        path: ["placements"],
        message: "the same unit cannot occupy the same child, subject, and week twice",
      });
    }
  });

export type ProposedCurriculumUnit = z.infer<typeof proposedCurriculumUnitSchema>;
export type ProposedCurriculumMapping = z.infer<
  typeof proposedCurriculumMappingSchema
>;

interface CurriculumPlanBaseVersion {
  childId: string;
  subjectId: string;
  updatedAt: string;
}

interface CurriculumSourceVersion {
  assetId: string;
  title: string;
  updatedAt: string;
}

interface CurriculumMappingRevisionSnapshot {
  revision: number;
  proposal: ProposedCurriculumMapping;
  action: "created" | "revised" | "restored";
  restoredFrom: number | null;
}

export interface CurriculumMappingDraftPayload {
  v: 1;
  draftId: string;
  familyId: string;
  createdAt: string;
  source: CurriculumSourceVersion;
  eligibleChildIds: string[];
  childNames: Record<string, string>;
  planBaseVersions: CurriculumPlanBaseVersion[];
  history: CurriculumMappingRevisionSnapshot[];
}

export interface CurriculumMappingPreviewUnit extends ProposedCurriculumUnit {
  subjectNames: string[];
}

export interface CurriculumMappingPreviewPlacement {
  unitOrdinal: number;
  unitLabel: string;
  childId: string;
  childName: string;
  subjectId: string;
  subjectName: string;
  week: number;
  activityText: string;
}

export interface CurriculumMappingPreview {
  draftId: string;
  revision: number;
  sourceAssetId: string;
  sourceTitle: string;
  decompositionQuality: "full" | "partial";
  unitKind: (typeof CURRICULUM_UNIT_KINDS)[number];
  declaredUnitCount: number;
  notes: string | null;
  units: CurriculumMappingPreviewUnit[];
  placements: CurriculumMappingPreviewPlacement[];
  restoredFrom: number | null;
}

export type CurriculumMappingDraftFailure =
  | { code: "source"; note: string }
  | { code: "needs_children"; note: string }
  | { code: "source_incomplete"; note: string }
  | { code: "invalid_evidence"; note: string; unitOrdinals: number[] }
  | { code: "invalid_assignment"; note: string }
  | { code: "missing_plan"; note: string }
  | { code: "plan_capacity"; note: string }
  | { code: "stale"; note: string };

interface EligibleChild {
  id: string;
  name: string;
}

interface CurriculumPlanRow {
  id: string;
  child_id: string;
  subject_id: string;
  plan: FourWeekPlan;
  progress: Record<string, boolean> | null;
  updated_at: string;
}

interface VerifiedDraftInputs {
  asset: ReadyFamilyCurriculum;
  eligibleChildren: EligibleChild[];
  plans: CurriculumPlanRow[];
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function curriculumPlannerSourceTitle(
  sourceTitle: string,
  unitLabel: string,
): string {
  const joined = `${sourceTitle} · ${unitLabel}`;
  if (joined.length <= MAX_PLAN_SOURCE_TITLE) return joined;
  const unit = unitLabel.slice(0, 72).trimEnd();
  const sourceLength = Math.max(
    1,
    MAX_PLAN_SOURCE_TITLE - unit.length - "… · ".length,
  );
  return `${sourceTitle.slice(0, sourceLength).trimEnd()}… · ${unit}`;
}

function draftSecret(explicit?: string): string {
  const secret = explicit ?? process.env.CRON_SECRET;
  if (!secret) throw new Error("CRON_SECRET is required for curriculum previews");
  return secret;
}

function draftKey(sessionId: string, secret?: string): Buffer {
  return createHmac("sha256", draftSecret(secret))
    .update(`homa-family-curriculum-draft-v1:${sessionId}`)
    .digest();
}

export function signCurriculumMappingDraft(
  payload: CurriculumMappingDraftPayload,
  sessionId: string,
  secret?: string,
): string {
  const body = Buffer.from(canonicalJson(payload)).toString("base64url");
  const signature = createHmac("sha256", draftKey(sessionId, secret))
    .update(body)
    .digest("base64url");
  return `${body}.${signature}`;
}

const planBaseVersionSchema = z.object({
  childId: z.string().uuid(),
  subjectId: z.enum(SUBJECT_IDS),
  updatedAt: z.string(),
});

const curriculumMappingRevisionSnapshotSchema = z.object({
  revision: z.number().int().min(1).max(MAX_CURRICULUM_MAPPING_REVISIONS),
  proposal: proposedCurriculumMappingSchema,
  action: z.enum(["created", "revised", "restored"]),
  restoredFrom: z.number().int().min(1).max(100).nullable(),
});

const curriculumMappingDraftPayloadSchema = z.object({
  v: z.literal(1),
  draftId: z.string().uuid(),
  familyId: z.string().uuid(),
  createdAt: z.iso.datetime(),
  source: z.object({
    assetId: z.string().uuid(),
    title: z.string(),
    updatedAt: z.string(),
  }),
  eligibleChildIds: z.array(z.string().uuid()).min(1).max(50),
  childNames: z.record(z.string(), z.string()),
  planBaseVersions: z.array(planBaseVersionSchema).max(40),
  history: z
    .array(curriculumMappingRevisionSnapshotSchema)
    .min(1)
    .max(MAX_CURRICULUM_MAPPING_REVISIONS),
});

type CurriculumMappingPreviewFailure =
  | CurriculumMappingDraftFailure
  | { code: "invalid"; note: string }
  | { code: "revision_limit"; note: string };

export function verifyCurriculumMappingDraft(
  token: string,
  sessionId: string,
  familyId: string,
  options: { secret?: string; now?: Date } = {},
): CurriculumMappingDraftPayload | null {
  const [body, signature, extra] = token.split(".");
  if (!body || !signature || extra !== undefined) return null;
  let expected: Buffer;
  try {
    expected = createHmac("sha256", draftKey(sessionId, options.secret))
      .update(body)
      .digest();
  } catch {
    return null;
  }
  let provided: Buffer;
  try {
    provided = Buffer.from(signature, "base64url");
  } catch {
    return null;
  }
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return null;
  }
  try {
    const parsed = curriculumMappingDraftPayloadSchema.safeParse(
      JSON.parse(Buffer.from(body, "base64url").toString("utf8")),
    );
    if (!parsed.success || parsed.data.familyId !== familyId) return null;
    const createdAt = Date.parse(parsed.data.createdAt);
    const now = (options.now ?? new Date()).getTime();
    if (
      !Number.isFinite(createdAt) ||
      createdAt > now + MAX_CLOCK_SKEW_MS ||
      now - createdAt > MAX_DRAFT_AGE_MS
    ) {
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

function currentSnapshot(
  payload: CurriculumMappingDraftPayload,
): CurriculumMappingRevisionSnapshot {
  return payload.history[payload.history.length - 1];
}

export function curriculumMappingPreviewFromDraft(
  payload: CurriculumMappingDraftPayload,
): CurriculumMappingPreview {
  const snapshot = currentSnapshot(payload);
  const units = new Map(snapshot.proposal.units.map((unit) => [unit.ordinal, unit]));
  return {
    draftId: payload.draftId,
    revision: snapshot.revision,
    sourceAssetId: payload.source.assetId,
    sourceTitle: payload.source.title,
    decompositionQuality: snapshot.proposal.decompositionQuality,
    unitKind: snapshot.proposal.unitKind,
    declaredUnitCount: snapshot.proposal.declaredUnitCount,
    notes: snapshot.proposal.notes,
    units: snapshot.proposal.units.map((unit) => ({
      ...unit,
      subjectNames: unit.subjectIds.map(
        (subjectId) => SUBJECT_NAMES.get(subjectId) ?? subjectId,
      ),
    })),
    placements: snapshot.proposal.placements.map((placement) => ({
      ...placement,
      unitLabel: units.get(placement.unitOrdinal)?.unitLabel ?? "Curriculum unit",
      childName: payload.childNames[placement.childId] ?? "Child",
      subjectName: SUBJECT_NAMES.get(placement.subjectId) ?? placement.subjectId,
    })),
    restoredFrom: snapshot.restoredFrom,
  };
}

function planKey(childId: string, subjectId: string): string {
  return `${childId}:${subjectId}`;
}

export function invalidCurriculumEvidenceOrdinals(
  proposal: ProposedCurriculumMapping,
  document: Extract<FamilyAssetSourceDocument, { ok: true }>,
): number[] {
  const sourceByLocator = new Map(
    document.segments.map((segment) => [segment.locator, segment.text]),
  );
  return proposal.units.flatMap((unit) => {
    const source = sourceByLocator.get(unit.sourceLocator);
    if (!source || !source.includes(unit.evidenceQuote)) return [unit.ordinal];
    if (unit.topics.some((topic) => !source.includes(topic.quote))) {
      return [unit.ordinal];
    }
    return [];
  });
}

function validateAssignments(
  proposal: ProposedCurriculumMapping,
  eligibleChildren: readonly EligibleChild[],
): CurriculumMappingDraftFailure | null {
  const eligibleIds = new Set(eligibleChildren.map((child) => child.id));
  const units = new Map(proposal.units.map((unit) => [unit.ordinal, unit]));
  for (const placement of proposal.placements) {
    const unit = units.get(placement.unitOrdinal);
    if (
      !unit ||
      !eligibleIds.has(placement.childId) ||
      !unit.subjectIds.includes(placement.subjectId)
    ) {
      return {
        code: "invalid_assignment",
        note:
          "Every Planner row must use one approved unit, one subject recorded on that unit, and one child already assigned to the original curriculum.",
      };
    }
  }
  return null;
}

function validatePlanCapacity(
  proposal: ProposedCurriculumMapping,
  plans: readonly CurriculumPlanRow[],
): CurriculumMappingDraftFailure | null {
  const byPlan = new Map(plans.map((plan) => [planKey(plan.child_id, plan.subject_id), plan]));
  const placementsByPlan = new Map<string, ProposedCurriculumMapping["placements"]>();
  for (const placement of proposal.placements) {
    const key = planKey(placement.childId, placement.subjectId);
    const list = placementsByPlan.get(key) ?? [];
    list.push(placement);
    placementsByPlan.set(key, list);
  }
  for (const [key, placements] of placementsByPlan) {
    const plan = byPlan.get(key);
    if (!plan) {
      return {
        code: "missing_plan",
        note:
          "One child and subject in this preview does not have an existing Planner plan. Open Planner and create that plan before trying again.",
      };
    }
    const edits: PlanEdit[] = placements.map((placement) => ({
      action: "add",
      week: placement.week,
      text: placement.activityText,
    }));
    const applied = applyPlanEdits(plan.plan, plan.progress ?? {}, edits);
    if (!applied.ok) {
      return {
        code: "plan_capacity",
        note: applied.failure.note,
      };
    }
  }
  return null;
}

async function loadVerifiedDraftInputs(
  familyId: string,
  proposal: ProposedCurriculumMapping,
): Promise<
  | { ok: true; verified: VerifiedDraftInputs }
  | { ok: false; failure: CurriculumMappingDraftFailure }
> {
  const ready = await getReadyFamilyCurriculum(familyId, proposal.sourceAssetId);
  if (!ready.ok) {
    return {
      ok: false,
      failure: {
        code: "source",
        note:
          "That Library item is not a ready curriculum original. Your file stayed unchanged.",
      },
    };
  }
  const document = await extractFamilyAssetSourceDocument(ready.asset);
  if (!document.ok) {
    return {
      ok: false,
      failure: {
        code: "source",
        note: "Homa could not reopen the curriculum text to verify this preview.",
      },
    };
  }
  if (proposal.decompositionQuality === "full" && document.truncated) {
    return {
      ok: false,
      failure: {
        code: "source_incomplete",
        note:
          "Homa did not read the whole original, so this cannot be called a full decomposition. Mark the preview partial and name what remains.",
      },
    };
  }
  const invalidEvidence = invalidCurriculumEvidenceOrdinals(proposal, document);
  if (invalidEvidence.length > 0) {
    return {
      ok: false,
      failure: {
        code: "invalid_evidence",
        note:
          "One or more unit quotes do not appear on the named source page or section. Fix or remove those units before previewing.",
        unitOrdinals: invalidEvidence,
      },
    };
  }

  const sql = mapDb();
  const eligibleChildren = await sql<EligibleChild[]>`
    select child.id, child.name
    from public.family_asset_children link
    join public.children child
      on child.id = link.child_id and child.family_id = link.family_id
    where link.family_id = ${familyId}
      and link.asset_id = ${ready.asset.id}
    order by child.created_at, child.id
  `;
  if (eligibleChildren.length === 0) {
    return {
      ok: false,
      failure: {
        code: "needs_children",
        note:
          "Choose who this curriculum is for in Library before Homa maps any of it to Planner.",
      },
    };
  }
  const assignmentFailure = validateAssignments(proposal, eligibleChildren);
  if (assignmentFailure) return { ok: false, failure: assignmentFailure };

  const requestedPlans = [
    ...new Map(
      proposal.placements.map((placement) => [
        planKey(placement.childId, placement.subjectId),
        { childId: placement.childId, subjectId: placement.subjectId },
      ]),
    ).values(),
  ];
  const requestedPlanKeys = new Set(
    requestedPlans.map((plan) => planKey(plan.childId, plan.subjectId)),
  );
  const planCandidates = requestedPlans.length === 0
    ? []
    : await sql<CurriculumPlanRow[]>`
        select plan.id, plan.child_id, plan.subject_id, plan.plan, plan.progress,
               plan.updated_at::text as updated_at
        from public.child_plans plan
        join public.children child on child.id = plan.child_id
        where child.family_id = ${familyId}
          and plan.child_id in ${sql(requestedPlans.map((plan) => plan.childId))}
          and plan.subject_id in ${sql(requestedPlans.map((plan) => plan.subjectId))}
      `;
  const plans = planCandidates.filter((plan) =>
    requestedPlanKeys.has(planKey(plan.child_id, plan.subject_id)),
  );
  const capacityFailure = validatePlanCapacity(proposal, plans);
  if (capacityFailure) return { ok: false, failure: capacityFailure };
  return {
    ok: true,
    verified: { asset: ready.asset, eligibleChildren, plans },
  };
}

function baseVersions(plans: readonly CurriculumPlanRow[]): CurriculumPlanBaseVersion[] {
  return plans
    .map((plan) => ({
      childId: plan.child_id,
      subjectId: plan.subject_id,
      updatedAt: plan.updated_at,
    }))
    .sort(
      (left, right) =>
        left.childId.localeCompare(right.childId) ||
        left.subjectId.localeCompare(right.subjectId),
    );
}

export async function createCurriculumMappingDraft(input: {
  familyId: string;
  sessionId: string;
  secret?: string;
  proposal: ProposedCurriculumMapping;
}): Promise<
  | { ok: true; draftToken: string; preview: CurriculumMappingPreview }
  | { ok: false; failure: CurriculumMappingDraftFailure }
> {
  const proposal = proposedCurriculumMappingSchema.parse(input.proposal);
  const loaded = await loadVerifiedDraftInputs(input.familyId, proposal);
  if (!loaded.ok) return loaded;
  const payload: CurriculumMappingDraftPayload = {
    v: 1,
    draftId: randomUUID(),
    familyId: input.familyId,
    createdAt: new Date().toISOString(),
    source: {
      assetId: loaded.verified.asset.id,
      title: loaded.verified.asset.title,
      updatedAt: loaded.verified.asset.updatedAt,
    },
    eligibleChildIds: loaded.verified.eligibleChildren.map((child) => child.id),
    childNames: Object.fromEntries(
      loaded.verified.eligibleChildren.map((child) => [child.id, child.name]),
    ),
    planBaseVersions: baseVersions(loaded.verified.plans),
    history: [
      {
        revision: 1,
        proposal,
        action: "created",
        restoredFrom: null,
      },
    ],
  };
  return {
    ok: true,
    draftToken: signCurriculumMappingDraft(payload, input.sessionId, input.secret),
    preview: curriculumMappingPreviewFromDraft(payload),
  };
}

export async function reviseCurriculumMappingDraft(input: {
  familyId: string;
  sessionId: string;
  secret?: string;
  draftToken: string;
  proposal: ProposedCurriculumMapping;
}): Promise<
  | { ok: true; draftToken: string; preview: CurriculumMappingPreview }
  | { ok: false; failure: CurriculumMappingPreviewFailure }
> {
  const previous = verifyCurriculumMappingDraft(
    input.draftToken,
    input.sessionId,
    input.familyId,
    { secret: input.secret },
  );
  if (!previous) {
    return {
      ok: false,
      failure: { code: "invalid", note: "This curriculum preview expired. Build a fresh one." },
    };
  }
  if (previous.history.length >= MAX_CURRICULUM_MAPPING_REVISIONS) {
    return {
      ok: false,
      failure: {
        code: "revision_limit",
        note:
          "This curriculum review reached its 100-version limit. Build a fresh review before making another change.",
      },
    };
  }
  const proposal = proposedCurriculumMappingSchema.parse(input.proposal);
  if (proposal.sourceAssetId !== previous.source.assetId) {
    return {
      ok: false,
      failure: {
        code: "invalid",
        note: "A revision cannot switch to a different Library original.",
      },
    };
  }
  const loaded = await loadVerifiedDraftInputs(input.familyId, proposal);
  if (!loaded.ok) return loaded;
  const sameBase =
    loaded.verified.asset.updatedAt === previous.source.updatedAt &&
    canonicalJson(loaded.verified.eligibleChildren.map((child) => child.id)) ===
      canonicalJson(previous.eligibleChildIds) &&
    canonicalJson(baseVersions(loaded.verified.plans)) ===
      canonicalJson(previous.planBaseVersions);
  if (!sameBase) {
    return {
      ok: false,
      failure: {
        code: "stale",
        note:
          "The curriculum, its child assignment, or one target plan changed while this preview was open. Build a fresh preview from what is saved now.",
      },
    };
  }
  const payload: CurriculumMappingDraftPayload = {
    ...previous,
    history: [
      ...previous.history,
      {
        revision: previous.history.length + 1,
        proposal,
        action: "revised",
        restoredFrom: null,
      },
    ],
  };
  return {
    ok: true,
    draftToken: signCurriculumMappingDraft(payload, input.sessionId, input.secret),
    preview: curriculumMappingPreviewFromDraft(payload),
  };
}

export function restoreCurriculumMappingDraft(input: {
  familyId: string;
  sessionId: string;
  secret?: string;
  draftToken: string;
  restoreRevision: number;
}):
  | { ok: true; draftToken: string; preview: CurriculumMappingPreview }
  | { ok: false; failure: CurriculumMappingPreviewFailure } {
  const previous = verifyCurriculumMappingDraft(
    input.draftToken,
    input.sessionId,
    input.familyId,
    { secret: input.secret },
  );
  const target = previous?.history.find(
    (entry) => entry.revision === input.restoreRevision,
  );
  if (!previous || !target) {
    return {
      ok: false,
      failure: {
        code: "invalid",
        note: "That earlier review version is no longer available.",
      },
    };
  }
  if (previous.history.length >= MAX_CURRICULUM_MAPPING_REVISIONS) {
    return {
      ok: false,
      failure: {
        code: "revision_limit",
        note:
          "This curriculum review reached its 100-version limit. Build a fresh review before restoring another version.",
      },
    };
  }
  const payload: CurriculumMappingDraftPayload = {
    ...previous,
    history: [
      ...previous.history,
      {
        ...target,
        revision: previous.history.length + 1,
        action: "restored",
        restoredFrom: target.revision,
      },
    ],
  };
  return {
    ok: true,
    draftToken: signCurriculumMappingDraft(payload, input.sessionId, input.secret),
    preview: curriculumMappingPreviewFromDraft(payload),
  };
}

export function curriculumUnitUrl(
  sourceUrl: string,
  draftId: string,
  ordinal: number,
): string {
  const parsed = new URL(sourceUrl);
  parsed.hash = `homa-unit-${draftId}-${ordinal}`;
  return parsed.toString();
}

export type ApproveCurriculumMappingOutcome =
  | {
      status: "approved" | "already_approved";
      draftId: string;
      revision: number;
      sourceAssetId: string;
      unitAssets: Array<{
        ordinal: number;
        id: string;
        title: string;
        sourceLocator: string;
        libraryUrl: string;
      }>;
      plannerTargets: CurriculumMappingPreviewPlacement[];
      sourceLibraryUrl: string;
      plannerUrl: string;
    }
  | { status: "invalid" }
  | { status: "stale" };

function parseApprovedUnitAssets(value: unknown): Array<{
  ordinal: number;
  id: string;
  title: string;
  sourceLocator: string;
}> {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const row = entry as Record<string, unknown>;
    return typeof row.ordinal === "number" &&
      typeof row.id === "string" &&
      typeof row.title === "string" &&
      typeof row.sourceLocator === "string"
      ? [{
          ordinal: row.ordinal,
          id: row.id,
          title: row.title,
          sourceLocator: row.sourceLocator,
        }]
      : [];
  });
}

const approvedPlannerTargetsSchema = z
  .array(
    z
      .object({
        unitOrdinal: z.number().int().min(1).max(5_000),
        unitLabel: z.string().min(1).max(120),
        childId: z.string().uuid(),
        childName: z.string().min(1).max(180),
        subjectId: z.string().min(1).max(80),
        subjectName: z.string().min(1).max(120),
        week: z.number().int().min(1).max(4),
        activityText: z.string().min(1).max(MAX_ACTIVITY_TEXT),
      })
      .strict(),
  )
  .max(40);

export function parseApprovedCurriculumPlannerTargets(
  value: unknown,
): CurriculumMappingPreviewPlacement[] {
  const parsed = approvedPlannerTargetsSchema.safeParse(value);
  return parsed.success ? parsed.data : [];
}

export async function approveCurriculumMappingDraft(input: {
  familyId: string;
  sessionId: string;
  secret?: string;
  draftToken: string;
}): Promise<ApproveCurriculumMappingOutcome> {
  const payload = verifyCurriculumMappingDraft(
    input.draftToken,
    input.sessionId,
    input.familyId,
    { secret: input.secret },
  );
  if (!payload) return { status: "invalid" };
  const snapshot = currentSnapshot(payload);
  const sql = mapDb();
  const result = await sql.begin(async (tx) => {
    await tx`
      select pg_advisory_xact_lock(
        hashtextextended(
          ${`curriculum-mapping:${input.familyId}:${payload.source.assetId}`},
          0
        )
      )
    `;
    const prior = await tx<
      Array<{
        final_revision: number;
        unit_asset_ids: unknown;
        planner_targets: unknown;
      }>
    >`
      select final_revision, unit_asset_ids, planner_targets
      from public.family_curriculum_mapping_approvals
      where draft_id = ${payload.draftId}
        and family_id = ${input.familyId}
      limit 1
    `;
    if (prior[0]) {
      return {
        status: "already_approved" as const,
        revision: prior[0].final_revision,
        unitAssets: parseApprovedUnitAssets(prior[0].unit_asset_ids),
        plannerTargets: parseApprovedCurriculumPlannerTargets(
          prior[0].planner_targets,
        ),
      };
    }

    const sourceRows = await tx<
      Array<{
        id: string;
        uploaded_by_user_id: string | null;
        atlas_id: string | null;
        title: string;
        original_name: string;
        url: string;
        download_url: string;
        media_type: string;
        byte_size: number | string;
        file_kind: string;
        authors: string[];
        publisher: string | null;
        language: string | null;
        content_sha256: string | null;
        updated_at: string;
      }>
    >`
      select id, uploaded_by_user_id, atlas_id, title, original_name, url,
             download_url, media_type, byte_size, file_kind, authors,
             publisher, language, content_sha256,
             updated_at::text as updated_at
      from public.family_assets
      where id = ${payload.source.assetId}
        and family_id = ${input.familyId}
        and parent_asset_id is null
        and resource_kind = 'curriculum'
        and status = 'ready'
        and deleted_at is null
      for update
    `;
    const source = sourceRows[0];
    if (!source || source.updated_at !== payload.source.updatedAt) {
      return { status: "stale" as const };
    }

    const childRows = await tx<EligibleChild[]>`
      select child.id, child.name
      from public.family_asset_children link
      join public.children child
        on child.id = link.child_id and child.family_id = link.family_id
      where link.family_id = ${input.familyId}
        and link.asset_id = ${source.id}
      order by child.created_at, child.id
      for update of child
    `;
    if (
      canonicalJson(childRows.map((child) => child.id)) !==
      canonicalJson(payload.eligibleChildIds)
    ) {
      return { status: "stale" as const };
    }

    const baseKeys = new Set(
      payload.planBaseVersions.map((base) => planKey(base.childId, base.subjectId)),
    );
    const planCandidates = baseKeys.size === 0
      ? []
      : await tx<CurriculumPlanRow[]>`
          select plan.id, plan.child_id, plan.subject_id, plan.plan, plan.progress,
                 plan.updated_at::text as updated_at
          from public.child_plans plan
          join public.children child on child.id = plan.child_id
          where child.family_id = ${input.familyId}
            and plan.child_id in ${tx(
              payload.planBaseVersions.map((base) => base.childId),
            )}
            and plan.subject_id in ${tx(
              payload.planBaseVersions.map((base) => base.subjectId),
            )}
          for update of plan
        `;
    const planRows = planCandidates.filter((plan) =>
      baseKeys.has(planKey(plan.child_id, plan.subject_id)),
    );
    const currentVersions = baseVersions(planRows);
    if (canonicalJson(currentVersions) !== canonicalJson(payload.planBaseVersions)) {
      return { status: "stale" as const };
    }
    if (
      validateAssignments(snapshot.proposal, childRows) ||
      validatePlanCapacity(snapshot.proposal, planRows)
    ) {
      return { status: "stale" as const };
    }

    const unitIds = new Map(
      snapshot.proposal.units.map((unit) => [unit.ordinal, randomUUID()]),
    );
    const unitAssets = snapshot.proposal.units.map((unit) => ({
      ordinal: unit.ordinal,
      id: unitIds.get(unit.ordinal)!,
      title: unit.unitLabel,
      sourceLocator: unit.sourceLocator,
    }));

    await tx`
      update public.family_assets
      set is_current_decomposition = false,
          updated_at = now()
      where family_id = ${input.familyId}
        and parent_asset_id = ${source.id}
        and is_current_decomposition
        and deleted_at is null
    `;

    const processedAt = new Date();
    const unitRows = snapshot.proposal.units.map((unit) => ({
      id: unitIds.get(unit.ordinal)!,
      family_id: input.familyId,
      uploaded_by_user_id: source.uploaded_by_user_id,
      parent_asset_id: source.id,
      atlas_id: source.atlas_id,
      ordinal: unit.ordinal,
      unit_label: unit.unitLabel,
      title: unit.unitLabel,
      original_name: source.original_name,
      url: curriculumUnitUrl(source.url, payload.draftId, unit.ordinal),
      download_url: source.download_url,
      media_type: source.media_type,
      byte_size: Number(source.byte_size),
      file_kind: source.file_kind,
      resource_kind: "curriculum",
      authors: source.authors,
      publisher: source.publisher,
      language: source.language,
      status: "ready",
      content_sha256: source.content_sha256,
      processed_at: processedAt,
      unit_kind: snapshot.proposal.unitKind,
      unit_source_locator: unit.sourceLocator,
      unit_confidence: unit.confidence,
      unit_summary: unit.summary,
      decomposition_draft_id: payload.draftId,
      is_current_decomposition: true,
    }));
    await tx`
      insert into public.family_assets ${tx(
        unitRows,
        "id",
        "family_id",
        "uploaded_by_user_id",
        "parent_asset_id",
        "atlas_id",
        "ordinal",
        "unit_label",
        "title",
        "original_name",
        "url",
        "download_url",
        "media_type",
        "byte_size",
        "file_kind",
        "resource_kind",
        "authors",
        "publisher",
        "language",
        "status",
        "content_sha256",
        "processed_at",
        "unit_kind",
        "unit_source_locator",
        "unit_confidence",
        "unit_summary",
        "decomposition_draft_id",
        "is_current_decomposition",
      )}
    `;

    const childLinkRows = snapshot.proposal.units.flatMap((unit) =>
      payload.eligibleChildIds.map((childId) => ({
        family_id: input.familyId,
        asset_id: unitIds.get(unit.ordinal)!,
        child_id: childId,
      })),
    );
    await tx`
      insert into public.family_asset_children ${tx(
        childLinkRows,
        "family_id",
        "asset_id",
        "child_id",
      )}
    `;

    const tagRows = snapshot.proposal.units.flatMap((unit) => [
      ...unit.subjectIds.map((subjectId) => ({
        family_id: input.familyId,
        asset_id: unitIds.get(unit.ordinal)!,
        kind: "subject",
        value: SUBJECT_NAMES.get(subjectId) ?? subjectId,
        catalog_id: subjectId,
        quote: unit.evidenceQuote,
        source_locator: unit.sourceLocator,
        source: "model",
      })),
      ...unit.topics.map((topic) => ({
        family_id: input.familyId,
        asset_id: unitIds.get(unit.ordinal)!,
        kind: "topic",
        value: topic.name,
        catalog_id: null,
        quote: topic.quote,
        source_locator: unit.sourceLocator,
        source: "model",
      })),
    ]);
    await tx`
      insert into public.family_asset_tags ${tx(
        tagRows,
        "family_id",
        "asset_id",
        "kind",
        "value",
        "catalog_id",
        "quote",
        "source_locator",
        "source",
      )}
    `;

    const plansByKey = new Map(
      planRows.map((plan) => [planKey(plan.child_id, plan.subject_id), plan]),
    );
    const placementsByPlan = new Map<string, typeof snapshot.proposal.placements>();
    const planLinkRows: Array<{
      family_id: string;
      asset_id: string;
      child_id: string;
      subject_id: string;
      week: number;
      activity_index: number;
      activity_text: string;
      source_title: string;
      source_locator: string;
    }> = [];
    for (const placement of snapshot.proposal.placements) {
      const key = planKey(placement.childId, placement.subjectId);
      const list = placementsByPlan.get(key) ?? [];
      list.push(placement);
      placementsByPlan.set(key, list);
    }
    for (const [key, placements] of placementsByPlan) {
      const plan = plansByKey.get(key);
      if (!plan) {
        throw new Error("curriculum mapping plan disappeared after preflight");
      }
      const nextIndexByWeek = new Map(
        plan.plan.weeks.map((week) => [week.week, week.activities.length]),
      );
      const links: Array<{
        assetId: string;
        week: number;
        activityIndex: number;
        activityText: string;
        sourceTitle: string;
        sourceLocator: string;
      }> = [];
      const edits: PlanEdit[] = placements.map((placement) => {
        const unit = snapshot.proposal.units.find(
          (candidate) => candidate.ordinal === placement.unitOrdinal,
        )!;
        const activityIndex = nextIndexByWeek.get(placement.week) ?? 0;
        nextIndexByWeek.set(placement.week, activityIndex + 1);
        const assetId = unitIds.get(unit.ordinal)!;
        links.push({
          assetId,
          week: placement.week,
          activityIndex,
          activityText: placement.activityText,
          sourceTitle: curriculumPlannerSourceTitle(source.title, unit.unitLabel),
          sourceLocator: unit.sourceLocator,
        });
        return {
          action: "add",
          week: placement.week,
          text: placement.activityText,
          sourceFamilyAssetIds: [assetId],
        };
      });
      const applied = applyPlanEdits(plan.plan, plan.progress ?? {}, edits);
      if (!applied.ok) {
        throw new Error("curriculum mapping capacity changed after preflight");
      }
      await tx`
        update public.child_plans
        set plan = ${tx.json(applied.result.plan as unknown as DbJson)},
            progress = ${tx.json(applied.result.progress as unknown as DbJson)},
            updated_at = now()
        where id = ${plan.id}
      `;
      planLinkRows.push(
        ...links.map((link) => ({
          family_id: input.familyId,
          asset_id: link.assetId,
          child_id: plan.child_id,
          subject_id: plan.subject_id,
          week: link.week,
          activity_index: link.activityIndex,
          activity_text: link.activityText,
          source_title: link.sourceTitle,
          source_locator: link.sourceLocator,
        })),
      );
    }
    if (planLinkRows.length > 0) {
      await tx`
        insert into public.family_asset_plan_links ${tx(
          planLinkRows,
          "family_id",
          "asset_id",
          "child_id",
          "subject_id",
          "week",
          "activity_index",
          "activity_text",
          "source_title",
          "source_locator",
        )}
      `;
    }

    const preview = curriculumMappingPreviewFromDraft(payload);
    await tx`
      insert into public.family_curriculum_mapping_approvals (
        draft_id, family_id, source_asset_id, final_revision,
        decomposition_quality, unit_kind, declared_unit_count,
        unit_asset_ids, planner_targets, revision_history
      ) values (
        ${payload.draftId}, ${input.familyId}, ${source.id}, ${snapshot.revision},
        ${snapshot.proposal.decompositionQuality}, ${snapshot.proposal.unitKind},
        ${snapshot.proposal.declaredUnitCount},
        ${tx.json(unitAssets as unknown as DbJson)},
        ${tx.json(preview.placements as unknown as DbJson)},
        ${tx.json(payload.history as unknown as DbJson)}
      )
    `;
    await tx`
      update public.families set updated_at = now() where id = ${input.familyId}
    `;
    return {
      status: "approved" as const,
      revision: snapshot.revision,
      unitAssets,
      plannerTargets: preview.placements,
    };
  });

  if (result.status === "stale") return result;
  return {
    status: result.status,
    draftId: payload.draftId,
    revision: result.revision,
    sourceAssetId: payload.source.assetId,
    sourceLibraryUrl: `${siteUrl()}${familyAssetLibraryHref(payload.source.assetId)}`,
    plannerUrl: `${siteUrl()}/app/planner`,
    unitAssets: result.unitAssets.map((unit) => ({
      ...unit,
      libraryUrl: `${siteUrl()}${familyAssetLibraryHref(unit.id)}`,
    })),
    plannerTargets: result.plannerTargets,
  };
}
