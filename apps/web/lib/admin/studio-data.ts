import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { adminDb } from "./db";
import { ageYears } from "./format";
import {
  parseSkillPackage,
  type SkillReferenceCitation,
} from "../materials/skill-package";

/**
 * The material studio tab's data (/admin/studio, direction lab
 * 2026-07-18-material-studio-admin-directions.html). Three reads:
 * sandbox families for the run composer, the run ledger joined to the
 * materials each session produced (generation->>sessionId is the link
 * create_printable already stores for the founder deep view), and the
 * skill package straight from the filesystem, because fleet skills ARE
 * files (founder ruling 2026-07-15).
 *
 * db.ts laws apply: sequential awaits, ::text casts, ::int counts,
 * json aggregates as text.
 */

export interface StudioChildOption {
  id: string;
  name: string;
  ageYears: number | null;
}

export interface StudioFamilyOption {
  id: string;
  name: string;
  children: StudioChildOption[];
}

export async function listSandboxFamilies(): Promise<StudioFamilyOption[]> {
  const sql = adminDb();
  const rows = await sql<
    { id: string; name: string; children_json: string | null }[]
  >`
    select f.id, f.name,
      (select json_agg(json_build_object(
         'id', c.id, 'name', c.name,
         'birth_month', to_char(c.birth_month, 'YYYY-MM-DD'))
         order by c.created_at)
       from public.children c where c.family_id = f.id)::text as children_json
    from public.families f
    where f.sandbox and coalesce(f.status, 'open') <> 'deleted'
    order by f.created_at desc
    limit 20
  `;
  return rows.map((row) => {
    const parsed = row.children_json
      ? (JSON.parse(row.children_json) as {
          id: string;
          name: string;
          birth_month: string | null;
        }[])
      : [];
    return {
      id: row.id,
      name: row.name,
      children: parsed.map((child) => ({
        id: child.id,
        name: child.name,
        ageYears: child.birth_month ? ageYears(child.birth_month) : null,
      })),
    };
  });
}

export interface StudioRunMaterial {
  id: string;
  title: string;
  kind: string;
  status: string;
  path: string | null;
  pageCount: number;
  previewUrl: string;
  pdfUrl: string;
  reviewPassed: boolean;
  reviewIssues: string[];
  createdAt: string;
}

export interface StudioRunRow {
  id: string;
  familyId: string;
  familyName: string;
  childName: string | null;
  request: string;
  sessionId: string | null;
  status: "started" | "completed" | "failed";
  error: string | null;
  startedBy: string;
  createdAt: string;
  feedback: string | null;
  feedbackTags: string[];
  feedbackAt: string | null;
  materials: StudioRunMaterial[];
}

type AdminSql = ReturnType<typeof adminDb>;

interface StudioRunDbRow {
  id: string;
  family_id: string;
  family_name: string;
  child_name: string | null;
  request: string;
  session_id: string | null;
  status: "started" | "completed" | "failed";
  error: string | null;
  started_by: string;
  created_at: string;
  feedback: string | null;
  /** JSON text (db.ts law: fetch_types off means a raw text[] arrives as
   * a Postgres array literal string, so the query casts to json::text). */
  feedback_tags: string | null;
  feedback_at: string | null;
}

/** Materials per session id via the generation->>sessionId provenance
 * create_printable stores. Sequential caller keeps the db.ts laws. */
async function materialsBySessionIds(
  sql: AdminSql,
  sessionIds: string[],
): Promise<Map<string, StudioRunMaterial[]>> {
  const bySession = new Map<string, StudioRunMaterial[]>();
  if (sessionIds.length === 0) return bySession;
  const materials = await sql<
    {
      id: string;
      session_id: string;
      title: string;
      kind: string;
      status: string;
      gen_path: string | null;
      page_count: string | null;
      preview_url: string;
      pdf_url: string;
      review_pass: string | null;
      review_issues: string | null;
      created_at: string;
    }[]
  >`
    select m.id, m.generation->>'sessionId' as session_id, m.title, m.kind,
           m.status, m.generation->'input'->>'path' as gen_path,
           (m.generation->>'pageCount')::text as page_count,
           m.preview_url, m.pdf_url,
           m.generation->'review'->>'pass' as review_pass,
           (m.generation->'review'->'issues')::text as review_issues,
           m.created_at::text as created_at
    from public.materials m
    where m.generation->>'sessionId' in ${sql(sessionIds)}
    order by m.created_at asc
  `;
  for (const material of materials) {
    const list = bySession.get(material.session_id) ?? [];
    const parsedIssues = material.review_issues
      ? (JSON.parse(material.review_issues) as string[])
      : [];
    const parsedPages = Number.parseInt(material.page_count ?? "", 10);
    list.push({
      id: material.id,
      title: material.title,
      kind: material.kind,
      status: material.status,
      path: material.gen_path,
      pageCount: Number.isFinite(parsedPages) && parsedPages > 1 ? parsedPages : 1,
      previewUrl: material.preview_url,
      pdfUrl: material.pdf_url,
      reviewPassed: material.review_pass !== "false",
      reviewIssues: parsedIssues,
      createdAt: material.created_at,
    });
    bySession.set(material.session_id, list);
  }
  return bySession;
}

function toStudioRunRow(
  run: StudioRunDbRow,
  materialsBySession: Map<string, StudioRunMaterial[]>,
): StudioRunRow {
  return {
    id: run.id,
    familyId: run.family_id,
    familyName: run.family_name,
    childName: run.child_name,
    request: run.request,
    sessionId: run.session_id,
    status: run.status,
    error: run.error,
    startedBy: run.started_by,
    createdAt: run.created_at,
    feedback: run.feedback,
    feedbackTags: run.feedback_tags
      ? (JSON.parse(run.feedback_tags) as string[])
      : [],
    feedbackAt: run.feedback_at,
    materials: run.session_id
      ? (materialsBySession.get(run.session_id) ?? [])
      : [],
  };
}

/** Newest runs with the materials their sessions produced. Returns null
 * when the ledger table has not been migrated yet, so the page can show
 * a labeled setup note instead of crashing (additive-may-lead law). */
const RUN_COLUMNS_SQL = `r.id, r.family_id, f.name as family_name, c.name as child_name,
  r.request, r.session_id, r.status, r.error, r.started_by,
  r.created_at::text as created_at, r.feedback,
  to_json(r.feedback_tags)::text as feedback_tags,
  r.feedback_at::text as feedback_at`;

export async function listStudioRuns(limit: number): Promise<StudioRunRow[] | null> {
  const sql = adminDb();
  let runs: StudioRunDbRow[];
  try {
    runs = await sql<StudioRunDbRow[]>`
      select ${sql.unsafe(RUN_COLUMNS_SQL)}
      from public.materials_studio_runs r
      join public.families f on f.id = r.family_id
      left join public.children c on c.id = r.child_id and c.family_id = r.family_id
      order by r.created_at desc
      limit ${limit}
    `;
  } catch (error) {
    if ((error as { code?: string }).code === "42P01") return null;
    throw error;
  }

  const sessionIds = runs
    .map((run) => run.session_id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
  const materialsBySession = await materialsBySessionIds(sql, sessionIds);
  return runs.map((run) => toStudioRunRow(run, materialsBySession));
}

/** One run with its materials, for /admin/studio/runs/[runId]. Null when
 * the run is gone or the ledger table is not migrated yet. */
export async function getStudioRunDetail(runId: string): Promise<StudioRunRow | null> {
  const sql = adminDb();
  let runs: StudioRunDbRow[];
  try {
    runs = await sql<StudioRunDbRow[]>`
      select ${sql.unsafe(RUN_COLUMNS_SQL)}
      from public.materials_studio_runs r
      join public.families f on f.id = r.family_id
      left join public.children c on c.id = r.child_id and c.family_id = r.family_id
      where r.id = ${runId}
    `;
  } catch (error) {
    if ((error as { code?: string }).code === "42P01") return null;
    throw error;
  }
  const run = runs[0];
  if (!run) return null;
  const materialsBySession = await materialsBySessionIds(
    sql,
    run.session_id ? [run.session_id] : [],
  );
  return toStudioRunRow(run, materialsBySession);
}

export interface FleetMaterialRow {
  id: string;
  title: string;
  familyName: string;
  sandbox: boolean;
  kind: string;
  source: string;
  status: string;
  reviewPassed: boolean;
  previewUrl: string;
  createdAt: string;
}

/** What the skill is doing for real families, newest first, so lab
 * results can be judged against reality. */
export async function listRecentFleetMaterials(limit: number): Promise<FleetMaterialRow[]> {
  const sql = adminDb();
  const rows = await sql<
    {
      id: string;
      title: string;
      family_name: string;
      sandbox: boolean;
      kind: string;
      source: string;
      status: string;
      review_pass: string | null;
      preview_url: string;
      created_at: string;
    }[]
  >`
    select m.id, m.title, f.name as family_name, f.sandbox, m.kind, m.source,
           m.status, m.generation->'review'->>'pass' as review_pass,
           m.preview_url, m.created_at::text as created_at
    from public.materials m
    join public.families f on f.id = m.family_id
    order by m.created_at desc
    limit ${limit}
  `;
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    familyName: row.family_name,
    sandbox: row.sandbox,
    kind: row.kind,
    source: row.source,
    status: row.status,
    reviewPassed: row.review_pass !== "false",
    previewUrl: row.preview_url,
    createdAt: row.created_at,
  }));
}

export interface SkillPackageView {
  /** The frontmatter description, the skill's routing contract. */
  description: string;
  /** The SKILL.md body (after frontmatter), verbatim. */
  body: string;
  lineCount: number;
  /** ## headings in body order. */
  sections: string[];
  /** File names under references/, .png only. */
  referenceImages: string[];
  /** Every references/<file> the body cites: which section reaches for
   * it, the "study it for" excerpt, and whether the file exists. */
  citations: SkillReferenceCitation[];
  /** Files under references/ that no section cites (dead weight). */
  uncitedFiles: string[];
}

/** cwd is apps/web in the Next runtime (the report-writer.md pattern)
 * and the repo root under scripts/admin-console-smoke.mts; accept both. */
function skillDir(): string {
  const fromAppRoot = path.join(process.cwd(), "agent", "skills", "materials-studio");
  if (existsSync(fromAppRoot)) return fromAppRoot;
  return path.join(process.cwd(), "apps", "web", "agent", "skills", "materials-studio");
}

/** The names the reference-image route may serve; read fresh per call so
 * a newly shipped reference appears without a code change. */
export async function listSkillReferenceImages(): Promise<string[]> {
  try {
    const entries = await readdir(path.join(skillDir(), "references"));
    return entries.filter((name) => /^[a-z0-9-]+\.png$/.test(name)).sort();
  } catch {
    return [];
  }
}

export function skillReferenceImagePath(fileName: string): string {
  return path.join(skillDir(), "references", fileName);
}

export async function readSkillPackage(): Promise<SkillPackageView | null> {
  let raw: string;
  try {
    raw = await readFile(path.join(skillDir(), "SKILL.md"), "utf8");
  } catch {
    return null;
  }
  const referenceImages = await listSkillReferenceImages();
  const parsed = parseSkillPackage(raw, referenceImages);
  return {
    description: parsed.description,
    body: parsed.body,
    lineCount: parsed.lineCount,
    sections: parsed.sections,
    referenceImages,
    citations: parsed.citations,
    uncitedFiles: parsed.uncitedFiles,
  };
}
