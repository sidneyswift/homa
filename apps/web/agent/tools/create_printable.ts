import { randomUUID } from "node:crypto";

import { defineDynamic } from "eve/tools";
import { z } from "zod";

import {
  defineBoundedTool,
  TOOL_DEADLINE,
} from "../../lib/agent-tool-deadline";
import { MissingFamilyContextError, resolveAgentAccess } from "../../lib/agent-db";
import {
  acceptedOfferDestinationStillCurrent,
  acceptedOfferDeliveryIdFromAttributes,
  completeAcceptedOfferFulfillment,
  reserveAcceptedOfferFulfillment,
  validateAcceptedOfferFulfillmentRecipient,
} from "../../lib/conversation-continuity/offer-fulfillment";
import { emitFamilyAssetUsed } from "../../lib/library/family-asset-events";
import { resolveMaterialFamilySources } from "../../lib/library/family-asset-provenance";
import {
  familyAssetReferencesForSurface,
  MAX_FAMILY_ASSET_REFERENCES,
} from "../../lib/library/family-asset-reference";
import { emitMapEvent } from "../../lib/map/events";
import { siteUrl } from "../../lib/map/email";
import {
  blobConfigured,
  childAgeYearsForFamily,
  insertMaterialRowPinned,
  isFamilyArtifactUrl,
  MATERIAL_KINDS,
  uploadMaterialArtifacts,
  type MaterialKind,
  type MaterialSource,
} from "../../lib/materials/artifact-store";
import {
  getMaterialCaller,
  getMaterialPinned,
  type MaterialSummary,
} from "../../lib/materials/library";
import {
  geometryToolNotes,
  provenCutoffPages,
  underfillNotesApplyTo,
} from "../../lib/materials/page-geometry";
import { reviewArtifact } from "../../lib/materials/review-artifact";
import {
  hasPageBreakMarkup,
  imagePageBody,
  joinPageBodies,
  printableSlug,
  selectMaterialPages,
  stripCdataWrapper,
  validatePrintableHtml,
  wrapPrintableDocument,
} from "../../lib/materials/page-shell";
import {
  PREVIEW_PAGE_CAP,
  RendererUnavailableError,
  renderPrintableHtml,
  SUBJECT_LESSON_RENDER_POLICY,
} from "../../lib/materials/render-page";
import { buildRenderProvenance } from "../../lib/materials/render-provenance";
import { materialSaveFailureNote } from "../../lib/materials/save-failure-note";
import { usageChannelFromAttributes } from "../../lib/model-usage";
import {
  suppressInTurnGeneration,
  type GenerationGateAttributes,
} from "../../lib/onboarding/generation-gate";
import { sendSmsProgressTextOnce } from "../../lib/sms-progress";
import { readSubjectLessonTrustedContext } from "../../lib/subject-lessons/dispatch-input";
import { claimSubjectLessonWorksheetEffectPinned } from "../../lib/subject-lessons/store";
import { resolveSubjectLessonWorksheetEffect } from "../../lib/subject-lessons/worksheet-effect";
import { sendHomaSms } from "../../lib/voice/telnyx-api";

/**
 * The materials studio's press (MS-2/MS-3, replacing create_worksheet):
 * turns pages the model designed into the real artifact the parent
 * holds. Three creation paths through one pipeline: `html` (the model
 * composed one page), `pageImageUrl` (the image model drew the whole
 * page; generate_image made the URL), or `pages` (a multi-page packet:
 * fresh page HTML, page images, and this family's existing materials by
 * id, in any mix). Either way: letter PDF + per-page JPEG previews via
 * Chromium, bytes to Blob, a materials row with metadata and lineage, a
 * vision review of the rendered pages before delivery, and on SMS the
 * artifacts texted straight back.
 *
 * No template on purpose (founder rulings 2026-07-09/10): layout, style,
 * characters, difficulty, and PATH are the model's to choose per child.
 * Code owns tenancy, the brand-law gate, the D7 footer, and the review
 * gate on delivery. No daily materials cap on purpose (founder ruling
 * 2026-07-12, "no 20 a day cap"): series like an A-to-Z worksheet set
 * must build without an artificial stop; usage stays visible through
 * the model_usage ledger.
 *
 * Packets exist because of the Llanes incident (2026-07-17): a parent
 * asked for four weekly lessons as one PDF, the model smuggled them
 * through the single-page path with page-break CSS, and the pipeline
 * (preview + review, both page-one-only then) reported a working PDF as
 * broken. The pages path is the honest contract: every page gets its
 * own box, preview, and review.
 */

/** PDF pages per packet; longer programs ship as volumes. */
const MAX_PACKET_PAGES = 12;

/** Stay under the materials.html column's 120k check constraint. */
const MAX_STORED_HTML_CHARS = 118_000;

const PAGE_BREAK_NOTE =
  "Page-break CSS inside one page's html cannot paginate: every page is an exact letter-size box and overflow is cut. For a multi-page packet, call again with pages (one entry per page: html, pageImageUrl, or fromMaterialId) and each entry gets its own page, preview, and quality check.";

const packetPageInput = z.object({
  html: z
    .string()
    .min(40)
    .max(30_000)
    .optional()
    .describe("This page's complete content as HTML with its own <style> block, same contract as the top-level html field."),
  pageImageUrl: z
    .string()
    .optional()
    .describe("A generate_image URL of this ENTIRE page (shape 'portrait')."),
  fromMaterialId: z
    .uuid()
    .optional()
    .describe("Reuse an existing material of this family as this page (id from find_materials or an earlier create result). Its stored page content is placed exactly as made; a multi-page material contributes all its pages unless pageIndex names one."),
  pageIndex: z
    .int()
    .min(1)
    .max(MAX_PACKET_PAGES)
    .optional()
    .describe("With fromMaterialId, reuse only THIS page of that material, numbered the way the parent counts (1 is the first page). This is how you revise one page of a packet: keep every unchanged page as its own fromMaterialId + pageIndex entry and write html for only the page she asked about. Omit to take all of the material's pages."),
});

export const createPrintableInputSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1)
    .max(90)
    .describe("Short name for the material, e.g. 'Skye's Big O Practice'."),
  kind: z
    .enum(MATERIAL_KINDS)
    .optional()
    .describe("What this is. Defaults to 'worksheet' for one page and 'packet' for a multi-page pages build."),
  skill: z
    .string()
    .trim()
    .max(120)
    .optional()
    .describe("What it practices, e.g. 'letter O tracing'."),
  subject: z
    .string()
    .trim()
    .max(80)
    .optional()
    .describe("The school subject, e.g. 'handwriting', 'math'."),
  curriculum: z
    .string()
    .trim()
    .max(120)
    .optional()
    .describe("The curriculum style it follows, e.g. 'Handwriting Without Tears', when the family uses one."),
  theme: z
    .string()
    .trim()
    .max(120)
    .optional()
    .describe("The personalization hook, e.g. 'Paw Patrol rescue'."),
  characters: z
    .array(z.string().trim().min(1).max(60))
    .max(6)
    .optional()
    .describe("Named characters on the page, e.g. ['Skye']. Spell them the way the family does."),
  childId: z
    .uuid()
    .optional()
    .describe("The child it is for (id from the family context block). Omit for family-wide material."),
  childName: z
    .string()
    .trim()
    .max(60)
    .optional()
    .describe("The child's first name exactly as the family context spells it; printed in the tiny footer."),
  html: z
    .string()
    .min(40)
    .max(100_000)
    .optional()
    .describe(
      "PATH 1: the COMPLETE page content as HTML with its own <style> block (Google Fonts <link>s welcome). Placed inside a letter-size (8.5x11in) shell that owns @page and the footer, leaving a 7.3in wide x 9.5in tall content area for your HTML (0.6in side margins, 0.55in top, 0.95in reserved at the bottom for the footer). Content past that box is cut, not shrunk to fit, so size and space your layout to that exact area. One page only: no page-break CSS (use pages for packets). No <script>.",
    ),
  pageImageUrl: z
    .string()
    .optional()
    .describe(
      "PATH 2: a generate_image URL of the ENTIRE page (use shape 'portrait'). The shell fits it to letter size.",
    ),
  pages: z
    .array(packetPageInput)
    .min(2)
    .max(MAX_PACKET_PAGES)
    .optional()
    .describe(
      `PATH 3: a multi-page packet, one entry per page in print order (max ${MAX_PACKET_PAGES} pages; ship longer programs as volumes). Each entry carries exactly one of html, pageImageUrl, or fromMaterialId; mix freely (e.g. a fresh cover page + four existing lessons by id). To revise ONE page of a packet, do NOT retype the others: send an entry per page, each unchanged page as fromMaterialId + pageIndex pointing at the version you are revising, and html for only the page she asked about. Provide exactly one of html, pageImageUrl, or pages.`,
    ),
  pageRoles: z
    .array(z.enum(["child", "answer_key", "parent_guide", "other"]))
    .min(1)
    .max(MAX_PACKET_PAGES)
    .optional()
    .describe(
      "One deterministic role per rendered PDF page, in print order. Include this whenever a packet has an answer key or parent-only page so native printing can exclude it without guessing from page text.",
    ),
  revisesId: z
    .uuid()
    .optional()
    .describe("When this is a revision, the id of the version it replaces (from the earlier create result). Keeps the version chain intact."),
  sourceFamilyAssetIds: z
    .array(z.uuid())
    .max(MAX_FAMILY_ASSET_REFERENCES)
    .optional()
    .describe(
      "Exact Family Library asset ids returned by get_family_asset that grounded this material. Omit on a revision to inherit its prior sources; pass an empty array only to deliberately clear them.",
    ),
  requestSummary: z
    .string()
    .trim()
    .max(600)
    .optional()
    .describe("One or two sentences of what the parent actually asked for, used by the automatic quality check."),
});

export type CreatePrintableInput = z.infer<
  typeof createPrintableInputSchema
>;

export interface PrintableGenerationInput {
  title: string;
  kind: MaterialKind;
  skill: string | null;
  subject: string | null;
  curriculum: string | null;
  theme: string | null;
  characters: string[];
  childName: string | null;
  requestSummary: string | null;
  revisesId: string | null;
  sourceFamilyAssetIds: string[];
  path: "html" | "pageImageUrl" | "pages";
  lessonId?: string;
}

export function subjectLessonPrintableRestriction(
  input: CreatePrintableInput,
  attributes: unknown,
): string | null {
  const trustedLesson = readSubjectLessonTrustedContext(attributes);
  if (!trustedLesson) return null;
  const kind = input.kind ?? "worksheet";
  const hasNavigationMarkup =
    typeof input.html === "string"
    && (
      /<(?:base|iframe|frame|frameset|portal)(?:\s|>)/iu.test(input.html)
      || /<meta\b(?=[^>]*\bhttp-equiv\s*=\s*["']?\s*refresh\b)[^>]*>/iu
        .test(input.html)
    );
  const isHtmlOnly =
    typeof input.html === "string"
    && input.pageImageUrl === undefined
    && input.pages === undefined
    && !hasNavigationMarkup
    && !/<(?:img|image|picture|source|object|embed|video)(?:\s|>)/iu.test(
      input.html,
    )
    && !/\burl\s*\(/iu.test(input.html)
    && !/\bdata:image\//iu.test(input.html)
    && !/\btype\s*=\s*["']image["']/iu.test(input.html)
    && !/\bposter\s*=\s*["'][^"']+["']/iu.test(input.html);
  return (
    kind === "worksheet"
    && input.childId === trustedLesson.childId
    && input.childName === trustedLesson.childName
    && input.subject === trustedLesson.subjectId
    && input.skill === trustedLesson.targetStatement
    && isHtmlOnly
  )
    ? null
    : "Use an HTML-only subject lesson worksheet with the exact trusted child, subject, and target using the canonical subject ID, without image, navigation markup, CSS url(...), pageImageUrl, or a multi-page pages packet.";
}

/**
 * Produces the durable, HTML-free input receipt. A lesson id may enter only
 * through a fully validated subject lesson session, never through tool input.
 */
export function buildPrintableGenerationInput(
  input: CreatePrintableInput,
  path: "html" | "pageImageUrl" | "pages",
  attributes: unknown,
): PrintableGenerationInput {
  const trustedLesson = readSubjectLessonTrustedContext(attributes);
  return {
    title: input.title,
    kind: input.kind ?? "worksheet",
    skill: input.skill ?? null,
    subject: input.subject ?? null,
    curriculum: input.curriculum ?? null,
    theme: input.theme ?? null,
    characters: input.characters ?? [],
    childName: input.childName ?? null,
    requestSummary: input.requestSummary ?? null,
    revisesId: input.revisesId ?? null,
    sourceFamilyAssetIds: input.sourceFamilyAssetIds ?? [],
    path,
    ...(trustedLesson ? { lessonId: trustedLesson.lessonId } : {}),
  };
}

interface ResolvedPage {
  body: string;
  source: MaterialSource;
  /**
   * True when this page was authored on THIS call (html or a fresh page
   * image), false when it was carried over unchanged by fromMaterialId.
   * On a packet revision the carried pages are the ones she did not
   * complain about, so this is the signal for which pages the reviewer
   * must actually look at (gh#346).
   */
  fresh: boolean;
}

/** The packet's stored source: one path's value when uniform, else hybrid. */
function aggregateSource(pages: readonly ResolvedPage[]): MaterialSource {
  const sources = new Set(pages.map((page) => page.source));
  if (sources.size === 1) return pages[0].source;
  return "hybrid";
}

function htmlPageSource(body: string): MaterialSource {
  return /<img\s/i.test(body) ? "hybrid" : "html";
}

const createPrintable = defineBoundedTool({
  description:
    "Render printable material you designed (worksheet, coloring page, flash cards, poster, a multi-page packet, any material) into one real PDF plus per-page previews the parent sees where she is (chat card on web, texted picture on SMS). Three paths: pass your own page HTML, pass a generate_image URL of the whole page, or pass pages to build a multi-page packet (fresh pages and existing materials by id, in any mix, one PDF out). Load the materials-studio skill before your first material of a conversation; it owns the draft, revise (revisesId), and approve (mark_material_final) loop.",
  deadlineMs: TOOL_DEADLINE.render,
  repeatable: false,
  inputSchema: createPrintableInputSchema,
  async execute(input, ctx) {
    let access;
    try {
      access = await resolveAgentAccess(ctx.session.auth.current?.attributes);
    } catch (error) {
      if (error instanceof MissingFamilyContextError) {
        return { created: false, note: error.message };
      }
      throw error;
    }
    const { familyId } = access;
    const attributes = ctx.session.auth.current?.attributes as
      | {
          channel?: string;
          phoneNumber?: string;
          memberUserId?: string;
          acceptedOfferDeliveryId?: string;
        }
      | undefined;
    const sourceOfferDeliveryId =
      acceptedOfferDeliveryIdFromAttributes(attributes);
    const expectedRecipientMemberUserId =
      typeof attributes?.memberUserId === "string"
        ? attributes.memberUserId
        : null;
    if (sourceOfferDeliveryId) {
      const recipientMemberUserId =
        await validateAcceptedOfferFulfillmentRecipient({
          familyId,
          sourceDeliveryId: sourceOfferDeliveryId,
          expectedRecipientMemberUserId,
        });
      if (
        !expectedRecipientMemberUserId ||
        recipientMemberUserId !== expectedRecipientMemberUserId
      ) {
        return {
          created: false,
          note: "This accepted offer no longer has the same current adult recipient, so Homa did not create the material.",
        };
      }
    }
    const trustedLesson = readSubjectLessonTrustedContext(attributes);
    const subjectLessonRestriction = subjectLessonPrintableRestriction(
      input,
      attributes,
    );
    if (subjectLessonRestriction) {
      return { created: false, note: subjectLessonRestriction };
    }

    const sourceResolution = await resolveMaterialFamilySources({
      familyId,
      requestedAssetIds: input.sourceFamilyAssetIds,
      revisesMaterialId: input.revisesId,
    });
    if (!sourceResolution.ok) {
      return {
        created: false,
        note:
          sourceResolution.reason === "too-many-sources"
            ? `A material can cite at most ${MAX_FAMILY_ASSET_REFERENCES} Family Library sources. Choose the sources that directly grounded this output.`
            : "One of those Family Library source ids is not active in this family. Find and open the source again before creating the material.",
      };
    }
    const familySources = sourceResolution.sources;

    if (!blobConfigured()) {
      return {
        created: false,
        note: "The materials studio is not configured on this deployment (no artifact store). Tell the parent you cannot make the printable right now.",
      };
    }

    const inputHtml =
      typeof input.html === "string" ? stripCdataWrapper(input.html) : undefined;
    const paths = [
      typeof inputHtml === "string",
      typeof input.pageImageUrl === "string",
      Array.isArray(input.pages),
    ].filter(Boolean).length;
    if (paths !== 1) {
      return {
        created: false,
        note: "Provide exactly one of html (you composed one page), pageImageUrl (the image model drew the whole page), or pages (a multi-page packet).",
      };
    }

    // Resolve every page to a body the shell can box. Model-supplied
    // URLs and ids are re-scoped inside the authenticated family here;
    // nothing model-chosen crosses the tenancy wall unchecked.
    const resolvedPages: ResolvedPage[] = [];
    /** Materials already read on this call, by id. See the fetch below. */
    const materialCache = new Map<string, MaterialSummary | null>();
    if (typeof inputHtml === "string") {
      if (hasPageBreakMarkup(inputHtml)) {
        return { created: false, note: PAGE_BREAK_NOTE };
      }
      resolvedPages.push({
        body: inputHtml,
        source: htmlPageSource(inputHtml),
        fresh: true,
      });
    } else if (typeof input.pageImageUrl === "string") {
      if (!isFamilyArtifactUrl(input.pageImageUrl, familyId)) {
        return {
          created: false,
          note: "pageImageUrl must be a URL generate_image returned for this family. Generate the page image first, then pass its URL.",
        };
      }
      resolvedPages.push({
        body: imagePageBody(new URL(input.pageImageUrl).toString()),
        source: "image",
        fresh: true,
      });
    } else {
      for (const [index, page] of (input.pages ?? []).entries()) {
        const position = `pages[${index}]`;
        const pagePaths = [
          typeof page.html === "string",
          typeof page.pageImageUrl === "string",
          typeof page.fromMaterialId === "string",
        ].filter(Boolean).length;
        if (pagePaths !== 1) {
          return {
            created: false,
            note: `${position} needs exactly one of html, pageImageUrl, or fromMaterialId.`,
          };
        }
        // pageIndex modifies fromMaterialId; it cannot select a page of
        // html you are writing here. Rejected per entry rather than in
        // the schema so the other pages still parse.
        if (page.pageIndex !== undefined && typeof page.fromMaterialId !== "string") {
          return {
            created: false,
            note: `${position}: pageIndex only works with fromMaterialId, to take one page of an existing material. Drop it.`,
          };
        }
        if (typeof page.html === "string") {
          const body = stripCdataWrapper(page.html);
          if (hasPageBreakMarkup(body)) {
            return { created: false, note: `${position}: ${PAGE_BREAK_NOTE}` };
          }
          resolvedPages.push({ body, source: htmlPageSource(body), fresh: true });
          continue;
        }
        if (typeof page.pageImageUrl === "string") {
          if (!isFamilyArtifactUrl(page.pageImageUrl, familyId)) {
            return {
              created: false,
              note: `${position}: pageImageUrl must be a URL generate_image returned for this family.`,
            };
          }
          resolvedPages.push({
            body: imagePageBody(new URL(page.pageImageUrl).toString()),
            source: "image",
            fresh: true,
          });
          continue;
        }
        const materialId = page.fromMaterialId as string;
        // Fetched once per material, not once per entry. The revision
        // shape pageIndex exists for points every unchanged page at the
        // SAME id, so a one-page edit to a twelve-page packet asks for
        // it eleven times; without this that is eleven identical round
        // trips to the pooler inside one deadline. Cache is per call, so
        // it cannot serve a stale row across turns, and it sits after
        // the tenancy-scoped read so every id is still re-scoped inside
        // the authenticated family exactly once.
        let material = materialCache.get(materialId) ?? null;
        if (!materialCache.has(materialId)) {
          material =
            access.mode === "pinned"
              ? await getMaterialPinned(familyId, materialId)
              : await getMaterialCaller(access.db, familyId, materialId);
          materialCache.set(materialId, material);
        }
        if (!material || !material.html) {
          return {
            created: false,
            note: `${position}: fromMaterialId is not one of this family's materials. Use an id from find_materials or an earlier create result.`,
          };
        }
        if (material.status === "superseded") {
          return {
            created: false,
            note: `${position}: "${material.title}" was superseded when a later version was approved. Use the final instead; find_materials returns it.`,
          };
        }
        const selected = selectMaterialPages(material.html, page.pageIndex);
        if (!selected.ok) {
          return {
            created: false,
            note: `${position}: "${material.title}" has ${selected.pageCount} page${selected.pageCount === 1 ? "" : "s"}, so there is no page ${page.pageIndex}. Pages count from 1.`,
          };
        }
        for (const body of selected.bodies) {
          resolvedPages.push({ body, source: material.source, fresh: false });
        }
      }
      if (resolvedPages.length > MAX_PACKET_PAGES) {
        return {
          created: false,
          note: `That packet works out to ${resolvedPages.length} pages; the cap is ${MAX_PACKET_PAGES} per document. Split it into volumes (for example weeks 1 to 6 and weeks 7 to 12) and make each volume its own packet.`,
        };
      }
      if (resolvedPages.length < 2) {
        return {
          created: false,
          note: "pages resolved to fewer than 2 pages. For one page, pass html or pageImageUrl directly.",
        };
      }
    }

    const storedHtml = joinPageBodies(resolvedPages.map((page) => page.body));
    if (storedHtml.length > MAX_STORED_HTML_CHARS) {
      return {
        created: false,
        note: "This packet's pages add up past the storage cap for one material. Split it into two volumes and make each its own packet.",
      };
    }

    const metadataText = [
      input.title,
      input.skill,
      input.subject,
      input.curriculum,
      input.theme,
      ...(input.characters ?? []),
      input.childName,
      input.requestSummary,
    ]
      .filter(Boolean)
      .join(" ");
    const gateFailure = validatePrintableHtml(storedHtml, metadataText);
    if (gateFailure) {
      return { created: false, note: gateFailure };
    }

    const channel = usageChannelFromAttributes(attributes);

    if (trustedLesson) {
      const worksheetEffect = resolveSubjectLessonWorksheetEffect(
        await claimSubjectLessonWorksheetEffectPinned({
          familyId: trustedLesson.familyId,
          lessonId: trustedLesson.lessonId,
          childId: trustedLesson.childId,
          attempt: trustedLesson.attempt,
          revisesId: input.revisesId ?? null,
        }),
      );
      switch (worksheetEffect.status) {
        case "create":
          break;
        case "completed":
          return {
            created: true,
            done: true,
            material: worksheetEffect.material,
            review: null,
            sentByText: false,
            note: "The completed worksheet receipt was reused without another render or provider call.",
          };
        case "refused":
          return {
            created: false,
            note: "This worksheet effect is already in flight or uncertain. Do not call create_printable again in this attempt. An explicit parent Retry may start a new attempt.",
          };
        default: {
          const exhaustive: never = worksheetEffect;
          throw new Error(
            `Unhandled worksheet effect result: ${String(exhaustive)}`,
          );
        }
      }
    }

    // Render + review + upload is the slow part of an HTML-only build.
    // This fallback shares the progress window with send_heads_up and
    // generate_image.
    if (channel === "sms" && attributes?.phoneNumber) {
      await sendSmsProgressTextOnce({
        familyId,
        phoneNumber: attributes.phoneNumber,
      });
    }

    const startedAt = Date.now();
    const kind =
      input.kind ?? (resolvedPages.length > 1 ? "packet" : "worksheet");
    const source = aggregateSource(resolvedPages);
    const document = wrapPrintableDocument(
      resolvedPages.map((page) => page.body),
      input.childName ?? "",
    );

    let rendered;
    try {
      rendered = trustedLesson
        ? await renderPrintableHtml(document, SUBJECT_LESSON_RENDER_POLICY)
        : await renderPrintableHtml(document);
    } catch (error) {
      if (error instanceof RendererUnavailableError) {
        return { created: false, note: error.message };
      }
      console.error(
        "create_printable render failed:",
        error instanceof Error ? error.message : "unknown",
      );
      return {
        created: false,
        note: "Rendering hiccuped (often a slow image URL or heavy CSS). Simplify the page slightly and call this again once.",
      };
    }

    // Founder ruling `cutoff-page-is-a-block` (2026-07-29): when Homa's
    // own check can PROVE a page is physically cut off, she does not
    // deliver it, she rebuilds and says she caught a problem. A proof is
    // exactly this measurement, never the vision reviewer's doubts,
    // which still ship with an honest note. Returning here costs one
    // render and skips the review call, and because nothing has been
    // uploaded or inserted yet it leaves no orphan blob and no stranded
    // draft. The skill's two-strike rule is the escape hatch: after two
    // failed rebuilds of the same page, stop and ask her.
    //
    // Scoped to FRESH pages only, the same distinction selectPagesForReview
    // already draws: a packet revision carries the untouched pages forward
    // via fromMaterialId, and those were already final once. Blocking on
    // one of them would refuse a one-page fix over a page nobody touched
    // and nobody asked about, on a document that was already shipped.
    const freshGeometry = rendered.pageGeometry.filter(
      (page) => resolvedPages[page.page - 1]?.fresh ?? true,
    );
    const cutoffPages = provenCutoffPages(freshGeometry);
    if (cutoffPages.length > 0) {
      const overflowNotes = geometryToolNotes(freshGeometry).join(" ");
      return {
        created: false,
        note: `Not sent: the renderer measured ${
          cutoffPages.length === 1
            ? `page ${cutoffPages[0]}`
            : `pages ${cutoffPages.join(", ")}`
        } running off the paper, so this version would print cut off. ${overflowNotes} Fix that and call this again; tell her you caught a problem with the page and are fixing it, never that the tool failed.`,
      };
    }

    // The studio's own eyes: the reviewer sees the actual pixels of
    // every page against the brief; the agent decides what to do with
    // the verdict. A null review (disabled or unavailable) never blocks
    // anything.
    //
    // The age comes from the child row, not the model: two reviewer
    // criteria ("wrong difficulty for the stated age", and judging a
    // page against what this child can physically do) were unsatisfiable
    // while the brief carried no age at all.
    const childAgeYears = await childAgeYearsForFamily(familyId, input.childId);
    const brief = [
      `Title: ${input.title}`,
      `Kind: ${kind}`,
      input.skill ? `Practices: ${input.skill}` : null,
      input.theme ? `Theme: ${input.theme}` : null,
      input.characters?.length ? `Characters: ${input.characters.join(", ")}` : null,
      input.childName ? `Child's name as spelled: ${input.childName}` : null,
      childAgeYears !== null ? `The child is ${childAgeYears}` : null,
      input.requestSummary ? `The parent asked for: ${input.requestSummary}` : null,
    ]
      .filter(Boolean)
      .join("\n");
    const review = await reviewArtifact({
      familyId,
      channel,
      // Changed pages first: on a packet revision the pages carried over
      // by fromMaterialId are the ones she did not complain about, and
      // reviewing those instead of the page she asked about is how a
      // revision shipped "passed" with the fixed page unseen (gh#346).
      pages: rendered.pageJpegs.map((data, index) => ({
        data,
        pageNumber: index + 1,
        fresh: resolvedPages[index]?.fresh ?? true,
      })),
      pageCount: rendered.pageCount,
      brief,
      pageGeometry: rendered.pageGeometry,
      underfillNotes: underfillNotesApplyTo(kind),
    });
    let materialId: string = randomUUID();
    let reservedSourceDeliveryId: string | null = null;
    if (sourceOfferDeliveryId) {
      try {
        if (review !== null && !review.pass) {
          const recipientMemberUserId =
            await validateAcceptedOfferFulfillmentRecipient({
              familyId,
              sourceDeliveryId: sourceOfferDeliveryId,
              expectedRecipientMemberUserId,
            });
          if (
            !expectedRecipientMemberUserId ||
            recipientMemberUserId !== expectedRecipientMemberUserId
          ) {
            return {
              created: false,
              note: "This accepted offer no longer has the same current adult recipient, so Homa did not create the material.",
            };
          }
        } else {
          const reservation = await reserveAcceptedOfferFulfillment({
            familyId,
            sourceDeliveryId: sourceOfferDeliveryId,
            expectedRecipientMemberUserId,
            kind: "material",
            referenceId: materialId,
          });
          if (!reservation.eligible || !reservation.recipientMemberUserId) {
            return {
              created: false,
              note: "This accepted offer no longer has the same current adult recipient, so Homa did not create the material.",
            };
          }
          // `wrote` only when THIS call created the reservation. On any
          // later call for the same accepted offer the insert above is a
          // no-op and the query returns the EXISTING reference, which is
          // the id of the material the first call already inserted.
          // Adopting it made the insert below collide on the primary key,
          // so once a family accepted a morning-brief offer and got one
          // material, every further material in that session failed with
          // `duplicate key value violates unique constraint
          // "worksheets_pkey"` and she simply got nothing. Four in a row
          // for one family on 2026-07-28, surfaced by the tool-failure
          // alert the same day it was built (gh#372).
          if (reservation.wrote && reservation.referenceId) {
            materialId = reservation.referenceId;
            reservedSourceDeliveryId = sourceOfferDeliveryId;
          }
        }
      } catch (error) {
        console.error(
          "create_printable fulfillment reservation failed:",
          error instanceof Error ? error.message : "unknown",
        );
        return {
          created: false,
          note: "Homa could not verify the accepted offer's exact recipient, so the material was not created.",
        };
      }
    }

    const { pdfUrl, previewUrl, pagePreviewUrls } = await uploadMaterialArtifacts({
      familyId,
      slug: printableSlug(input.title),
      pdf: rendered.pdf,
      // Rendering now rasterizes every page so the reviewer can see them
      // all (gh#368), but what the parent keeps is still capped. Without
      // this slice a 12-page packet would quietly start storing twice
      // the previews it did yesterday.
      pageJpegs: rendered.pageJpegs.slice(0, PREVIEW_PAGE_CAP),
    });

    // Provenance for the founder deep view: the tool's input metadata
    // (never the html, which lives on the row already), the session that
    // made it, and the review verdict beside the output. pageCount and
    // the per-page previews ride here too (no schema change; the card,
    // scrollback, and Binder read them from generation).
    if (input.pageRoles && input.pageRoles.length !== rendered.pageCount) {
      return {
        created: false,
        note: `pageRoles has ${input.pageRoles.length} entries, but the rendered PDF has ${rendered.pageCount} pages. Send exactly one closed role per page.`,
      };
    }
    const generation = {
      sessionId: ctx.session.id,
      turnId: ctx.session.turn.id,
      channel,
      pageCount: rendered.pageCount,
      ...(rendered.pageCount > 1 ? { pagePreviewUrls } : {}),
      ...(input.pageRoles ? { pageRoles: input.pageRoles } : {}),
      familySources,
      input: buildPrintableGenerationInput(
        input,
        input.pages ? "pages" : input.pageImageUrl ? "pageImageUrl" : "html",
        attributes,
      ),
      review,
      // What it took to turn the stored html into these page images. The
      // html on the row is only the page bodies, so without the shell
      // fingerprint a later re-render cannot be told apart from a
      // different render (gh#328 render-pair archiver).
      render: buildRenderProvenance({
        renderer: rendered.renderer,
        rendererVersion: rendered.rendererVersion,
        previewPageCap: PREVIEW_PAGE_CAP,
      }),
      // Deterministic geometry alongside the model review (gh#349): a
      // small array of numbers per page, cheap to keep, and the durable
      // counterpart to the QC verdict for later history and analysis.
      pageGeometry: rendered.pageGeometry,
    };

    // The durable record (Postgres is truth; html is what a future
    // session revises, re-themes, or compiles into a packet instead of
    // re-imagining the pages).
    if (access.mode === "pinned") {
      const inserted = await insertMaterialRowPinned({
        id: materialId,
        familyId,
        childId: input.childId ?? null,
        title: input.title,
        kind,
        skill: input.skill ?? null,
        subject: input.subject ?? null,
        curriculum: input.curriculum ?? null,
        theme: input.theme ?? null,
        characters: input.characters ?? [],
        pdfUrl,
        previewUrl,
        html: storedHtml,
        source,
        revises: input.revisesId ?? null,
        sourceOfferDeliveryId: reservedSourceDeliveryId,
        sourceAuthorizationDeliveryId: sourceOfferDeliveryId,
        sourceOfferRecipientMemberUserId:
          expectedRecipientMemberUserId,
        channel,
        ...(trustedLesson
          ? {
              subjectLessonId: trustedLesson.lessonId,
              subjectLessonAttempt: trustedLesson.attempt,
              subjectLessonSubjectId: trustedLesson.subjectId,
              subjectLessonTargetStatement: trustedLesson.targetStatement,
            }
          : {
              subjectLessonId: null,
              subjectLessonAttempt: null,
              subjectLessonSubjectId: null,
              subjectLessonTargetStatement: null,
            }),
        generation,
      });
      if (!inserted.ok) {
        return { created: false, note: inserted.note };
      }
      materialId = inserted.id;
    } else {
      // Caller path: RLS walls the family; revisesId is verified by an
      // RLS-scoped read (a foreign id is simply invisible).
      if (input.revisesId) {
        const { data: revisesRow } = await access.db
          .from("materials")
          .select("id")
          .eq("id", input.revisesId)
          .eq("family_id", familyId)
          .maybeSingle();
        if (!revisesRow) {
          return {
            created: false,
            note: "That revisesId is not one of this family's materials. Use an id from an earlier create result, or leave it off.",
          };
        }
      }
      const { data: insertedRow, error: insertError } = await access.db
        .from("materials")
        .insert({
          id: materialId as ReturnType<typeof randomUUID>,
          family_id: familyId,
          child_id: input.childId ?? null,
          title: input.title,
          kind,
          skill: input.skill ?? null,
          subject: input.subject ?? null,
          curriculum: input.curriculum ?? null,
          theme: input.theme ?? null,
          characters: input.characters ?? [],
          pdf_url: pdfUrl,
          preview_url: previewUrl,
          html: storedHtml,
          source,
          revises: input.revisesId ?? null,
          channel,
          source_offer_delivery_id: reservedSourceDeliveryId,
          generation,
        })
        .select("id")
        .single();
      if (insertError || !insertedRow) {
        return {
          created: false,
          note: materialSaveFailureNote(
            insertError,
            input.childId !== undefined,
          ),
        };
      }
      materialId = insertedRow.id;
    }

    for (const familySource of familySources) {
      try {
        await emitFamilyAssetUsed({
          familyId,
          assetId: familySource.id,
          useKind: "material",
        });
      } catch (error) {
        console.error(
          "family Library material-use event failed:",
          error instanceof Error ? error.message : "unknown",
        );
      }
    }

    // SMS delivery, gated on the review: a page the reviewer flagged
    // never lands on her phone; revise first. The number comes from
    // channel auth, never the model (anti-relay law).
    const reviewPassed = review === null || review.pass;
    if (reservedSourceDeliveryId) {
      try {
        await completeAcceptedOfferFulfillment({
          familyId,
          sourceDeliveryId: reservedSourceDeliveryId,
          kind: "material",
          referenceId: materialId,
        });
      } catch (error) {
        console.error(
          "create_printable fulfillment attribution failed:",
          error instanceof Error ? error.message : "unknown",
        );
      }
    }
    let sentByText = false;
    let previewSentByText = false;
    if (channel === "sms" && reviewPassed && attributes?.phoneNumber) {
      const materialSmsIntro = `${input.title} is ready to print:`;
      const smsDestination = attributes.phoneNumber;
      const acceptedOfferSmsDestinationIsCurrent = async () =>
        !sourceOfferDeliveryId ||
        (await acceptedOfferDestinationStillCurrent({
          familyId,
          sourceDeliveryId: sourceOfferDeliveryId,
          expectedRecipientMemberUserId,
          channel: "sms",
          destination: smsDestination,
        }));
      if (await acceptedOfferSmsDestinationIsCurrent()) {
        previewSentByText = await sendHomaSms(
          smsDestination,
          materialSmsIntro,
          [previewUrl, pdfUrl],
        );
      }
      sentByText = previewSentByText;
      if (!sentByText && (await acceptedOfferSmsDestinationIsCurrent())) {
        sentByText = await sendHomaSms(
          smsDestination,
          `${materialSmsIntro} ${pdfUrl}`,
        );
      }
    }

    await emitMapEvent("materials.created", {
      family_id: familyId,
      ...(input.childId ? { child_id: input.childId } : {}),
      channel,
      kind,
      source,
      page_count: rendered.pageCount,
      reviewed: review !== null,
      ...(review !== null ? { review_passed: review.pass } : {}),
      sent_by_text: sentByText,
      duration_ms: Date.now() - startedAt,
    });

    const pagesNote =
      rendered.pageCount > 1
        ? ` All ${rendered.pageCount} pages are inside the one PDF; the card pages through the previews.`
        : "";
    const deliveryNote =
      channel === "subject_lesson"
        ? "The worksheet is saved as a draft for this lesson. Read the quality check and attach only when it passed or was unavailable."
        : channel === "sms"
        ? reviewPassed
          ? sentByText
            ? previewSentByText
              ? `The preview and printable link were submitted by text.${pagesNote} Follow with ONE short text naming the child and the skill, and invite tweaks.`
              : `The printable link was submitted by text.${pagesNote} Follow with ONE short text naming the child and the skill, and invite tweaks.`
            : "The material is made and saved, but text delivery failed. Tell her it's ready in her Homa chat on the web, and offer to tweak anything."
          : "NOT texted to her yet: fix the issues below (call again with revisesId set to this id), then the passing version sends."
        : reviewPassed
          ? `The card with the preview and print button is already visible in chat.${pagesNote} Tell her it's ready in one warm sentence (child + skill), and invite tweaks; never paste the links.`
          : "This version is NOT shown to her: a flagged draft never renders as a card, on any channel. Fix the issues below (call again with revisesId set to this id); only a passing version appears, and only then is there anything to tell her.";
    // Every page is reviewed now (gh#368), but a chunk that times out
    // still leaves its pages unseen, and a document past REVIEW_MAX_PAGES
    // outruns coverage entirely. Name the exact pages rather than letting
    // the agent claim more coverage than the reviewer had: "it passed the
    // quality check" was said to a parent for four days about pages
    // nobody had looked at (gh#346).
    const reviewedNumbers = review?.reviewedPages ?? [];
    const unreviewedCount = rendered.pageCount - reviewedNumbers.length;
    const coverageNote =
      review !== null && unreviewedCount > 0
        ? ` Checked only ${
            reviewedNumbers.length === 1
              ? `page ${reviewedNumbers[0]}`
              : `pages ${reviewedNumbers.join(", ")}`
          } of ${rendered.pageCount}; the other ${unreviewedCount} ${
            unreviewedCount === 1 ? "page is" : "pages are"
          } unchecked, so do not tell her the whole document passed.`
        : "";
    // Problems on pages that had no reviewer at all before gh#368. They
    // never hold the document back (founder ruling 2026-07-30): she sees
    // it, hears which page, and decides. Naming the page is the whole
    // value, so these are passed through verbatim and never collapsed
    // into "there were some issues".
    const advisoryIssues = review?.advisoryIssues ?? [];
    const advisoryNote =
      advisoryIssues.length > 0
        ? ` On later pages the check also found: ${advisoryIssues.join(
            "; ",
          )}. This version IS shown to her. Tell her which page in one plain sentence and offer to fix it; do not rebuild until she says yes, and do not call it a technical problem.`
        : "";
    const reviewNote =
      review === null
        ? " The quality check did not run for this version (it is off, timed out, or errored), so nothing has looked at these pages: say it is ready without claiming it was checked."
        : review.pass
          ? ` Quality check passed on the pages it saw.${coverageNote}${advisoryNote}`
          : ` Quality check found issues: ${review.issues.join("; ")}.${coverageNote}${advisoryNote}`;
    // Deterministic, from the renderer's own measurements, so a blank
    // band or a cut edge never depends on the vision model noticing it
    // (gh#349). It used to be the ONLY fact available about pages past
    // the preview cap; since gh#368 every page is also rendered and
    // reviewed, so these numbers now corroborate an image rather than
    // stand in for one.
    const geometryNotes = geometryToolNotes(rendered.pageGeometry, {
      underfillNotes: underfillNotesApplyTo(kind),
    });
    const geometryNoteText =
      geometryNotes.length > 0 ? ` ${geometryNotes.join(" ")}` : "";

    return {
      created: true,
      done: true,
      material: {
        id: materialId,
        title: input.title,
        kind,
        skill: input.skill ?? null,
        childName: input.childName ?? null,
        previewUrl,
        pdfUrl,
        pageCount: rendered.pageCount,
        ...(rendered.pageCount > 1 ? { pagePreviewUrls } : {}),
        ...(input.pageRoles ? { pageRoles: input.pageRoles } : {}),
        status: "draft",
        revisesId: input.revisesId ?? null,
        reviewPassed: review === null ? null : review.pass,
        pageGeometry: rendered.pageGeometry,
        sources: familyAssetReferencesForSurface(familySources, {
          siteRoot: siteUrl(),
        }),
      },
      review,
      sentByText,
      note: trustedLesson
        ? `${deliveryNote}${reviewNote}${geometryNoteText}`
        : `${deliveryNote}${reviewNote}${geometryNoteText} When the parent approves a version, call mark_material_final with this id.`,
    };
  },
});

// During web onboarding this tool does not exist (generation-gate.ts):
// a render there holds the parent's first conversation open on a still
// screen, and the background first making is the honest path. The
// agent-job build session that renders that making keeps the tool.
export default defineDynamic({
  // step.started, never turn.started: a dynamic TOOL resolved on
  // turn.started is persisted as durable metadata and replayed on later
  // steps by looking its execute up in an in-memory step registry. These
  // tools have no bundler-generated step function, so eve registers a
  // fallback into `globalThis` at resolve time, and any later step that
  // lands on a different lambda isolate finds nothing and drops the tool
  // with only a log line. The model then simply does not have it, which
  // reads to the parent as "my tool is not connected" (2026-07-26/27,
  // gh#345). step.started re-resolves live every step and carries the
  // real closure, which is what eve documents for framework tools.
  events: {
    "step.started": (_event, ctx) => {
      const attributes = ctx.session.auth.current?.attributes as
        | GenerationGateAttributes
        | undefined;
      if (suppressInTurnGeneration(attributes)) return null;
      return createPrintable;
    },
  },
});
